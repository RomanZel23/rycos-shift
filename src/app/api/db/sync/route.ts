import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  User,
  ConstructionSite,
  DiscussedTopicTemplate,
  TenantSettings,
  DailyReport,
  PdfTemplate,
} from "@/types";
import { optimizeReportForStorage } from "@/lib/supabase-storage";
import { storagePathFromRef } from "@/lib/storage-paths";
import {
  REPORTS_TABLE,
  REPORT_COLUMNS,
  ReportRow,
  rowToDailyReport,
  dailyReportToRow,
} from "@/lib/report-mapper";
import { forbidden, requireUser, withRefreshedSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Akcje zmieniające konfigurację systemu — wyłącznie dla administratora. */
const ADMIN_ONLY_ACTIONS = new Set([
  "SYNC_USERS",
  "DELETE_USER",
  "SYNC_SITES",
  "DELETE_SITE",
  "SYNC_TOPICS",
  "DELETE_TOPIC",
  "SYNC_SETTINGS",
  "SYNC_PDF_TEMPLATES",
]);

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        isConnected: false,
        message: "Supabase klucz nie jest jeszcze skonfigurowany w zmiennych środowiskowych",
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: true, isConnected: false });
    }

    // Pobierz dane z tabel Supabase równolegle
    const [usersRes, sitesRes, topicsRes, settingsRes, reportsRes, templatesRes] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: true }),
      supabase.from("construction_sites").select("*").order("name", { ascending: true }),
      supabase.from("topic_templates").select("*").order("created_at", { ascending: true }),
      supabase.from("tenant_settings").select("*").limit(1).maybeSingle(),
      supabase.from(REPORTS_TABLE).select(REPORT_COLUMNS).order("report_date", { ascending: false }),
      supabase.from("pdf_templates").select("*").order("created_at", { ascending: true }),
    ]);

    // Mapowanie tabeli users
    const users: User[] = (usersRes.data || []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      isForeman: row.is_foreman,
      isAdmin: row.is_admin,
      login: row.login,
      createdAt: row.created_at,
    }));

    // Mapowanie placów budowy
    const sites: ConstructionSite[] = (sitesRes.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      active: row.active,
    }));

    // Mapowanie szablonów tematów
    const topics: DiscussedTopicTemplate[] = (topicsRes.data || []).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
    }));

    // Mapowanie ustawień instancji
    let settings: TenantSettings | null = null;
    if (settingsRes.data) {
      const s = settingsRes.data;
      settings = {
        tenantId: s.tenant_id,
        organizationName: s.organization_name,
        logoText: s.logo_text,
        logoSubtitle: s.logo_subtitle,
        startShiftEmailRecipients: s.start_shift_email_recipients || [],
        endShiftEmailRecipients: s.end_shift_email_recipients || [],
        resendFromEmail: s.resend_from_email,
      };
    }

    // Mapowanie raportów — cała logika (ścieżka w buckecie -> /api/files)
    // siedzi w report-mapper, żeby był jeden punkt prawdy dla wszystkich route'ów.
    const reports: DailyReport[] = ((reportsRes.data || []) as unknown as ReportRow[]).map(
      rowToDailyReport
    );

    // Mapowanie szablonów PDF
    const pdfTemplates: PdfTemplate[] = (templatesRes.data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      reportType: row.report_type,
      name: row.name,
      htmlContent: row.html_content,
      active: row.active,
      updatedAt: row.updated_at,
    }));

    return withRefreshedSession(
      NextResponse.json({
        success: true,
        isConnected: true,
        data: {
          users: users.length > 0 ? users : null,
          sites: sites.length > 0 ? sites : null,
          topics: topics.length > 0 ? topics : null,
          settings,
          reports,
          pdfTemplates,
        },
      }),
      auth.context
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd połączenia z Supabase";
    console.error("Supabase fetch error:", err);
    return NextResponse.json({ success: false, isConnected: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        isConnected: false,
        message: "Dane zapisane lokalnie (Supabase nie jest podłączony)",
      });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: true, isConnected: false });
    }

    const body = await req.json();
    const { action, report, users, sites, topics, settings, pdfTemplates } = body;

    // Zarządzanie użytkownikami, placami, tematami, ustawieniami i szablonami
    // to operacje administracyjne. Zapis własnego raportu może zrobić każdy
    // zalogowany pracownik.
    if (ADMIN_ONLY_ACTIONS.has(action) && !auth.context.user.isAdmin) {
      return forbidden();
    }

    // 1. Dosłanie raportu z kolejki offline. Nowe raporty idą przez /api/reports
    // (multipart + wysyłka maila); tutaj lądują tylko te, którym zapis padł
    // przy składaniu — dlatego status zostaje FAILED, a mail wysyła się ręcznie
    // z Archiwum po odzyskaniu łączności.
    if (action === "SAVE_REPORT" && report) {
      const optimized = await optimizeReportForStorage(report);
      const pdfPath = storagePathFromRef(optimized.pdfDataUrl);

      const { error } = await supabase.from(REPORTS_TABLE).upsert(
        dailyReportToRow(optimized, {
          pdfPath: pdfPath || "",
          status: "FAILED",
          sentToEmails: [],
          errorMessage:
            optimized.errorMessage ||
            "Raport dosłany z urządzenia po utracie łączności — e-mail nie został wysłany.",
          createdBy: auth.context.user.id,
          createdByName: `${auth.context.user.firstName} ${auth.context.user.lastName}`.trim(),
        }),
        { onConflict: "id" }
      );

      if (error) {
        console.error("Supabase save report error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Raport dosłany z urządzenia. Wyślij go mailem z zakładki Archiwum.",
        optimizedReport: optimized,
      });
    }

    // 2. Zapis/Synchronizacja Użytkowników
    if (action === "SYNC_USERS" && Array.isArray(users)) {
      const activeIds = users.map((u: User) => u.id).filter(Boolean);
      if (activeIds.length > 0) {
        // Usuń z Supabase użytkowników, którzy zostali usunięci w aplikacji
        await supabase
          .from("users")
          .delete()
          .not("id", "in", `(${activeIds.map((id) => `"${id}"`).join(",")})`);

        const mapped = users.map((u: User) => ({
          id: u.id,
          first_name: u.firstName,
          last_name: u.lastName,
          role: u.role,
          is_foreman: u.isForeman,
          is_admin: u.isAdmin,
          login: u.login,
        }));
        await supabase.from("users").upsert(mapped, { onConflict: "id" });
      } else {
        await supabase.from("users").delete().neq("id", "");
      }
      return NextResponse.json({ success: true });
    }

    if (action === "DELETE_USER" && body.userId) {
      await supabase.from("users").delete().eq("id", body.userId);
      return NextResponse.json({ success: true });
    }

    // 3. Zapis/Synchronizacja Placów Budowy
    if (action === "SYNC_SITES" && Array.isArray(sites)) {
      const activeIds = sites.map((s: ConstructionSite) => s.id).filter(Boolean);
      if (activeIds.length > 0) {
        await supabase
          .from("construction_sites")
          .delete()
          .not("id", "in", `(${activeIds.map((id) => `"${id}"`).join(",")})`);

        const mapped = sites.map((s: ConstructionSite) => ({
          id: s.id,
          name: s.name,
          address: s.address,
          active: s.active,
        }));
        await supabase.from("construction_sites").upsert(mapped, { onConflict: "id" });
      } else {
        await supabase.from("construction_sites").delete().neq("id", "");
      }
      return NextResponse.json({ success: true });
    }

    if (action === "DELETE_SITE" && body.siteId) {
      await supabase.from("construction_sites").delete().eq("id", body.siteId);
      return NextResponse.json({ success: true });
    }

    // 4. Zapis/Synchronizacja Szablonów Tematów
    if (action === "SYNC_TOPICS" && Array.isArray(topics)) {
      const activeIds = topics.map((t: DiscussedTopicTemplate) => t.id).filter(Boolean);
      if (activeIds.length > 0) {
        await supabase
          .from("topic_templates")
          .delete()
          .not("id", "in", `(${activeIds.map((id) => `"${id}"`).join(",")})`);

        const mapped = topics.map((t: DiscussedTopicTemplate) => ({
          id: t.id,
          title: t.title,
          category: t.category || "BHP",
        }));
        await supabase.from("topic_templates").upsert(mapped, { onConflict: "id" });
      } else {
        await supabase.from("topic_templates").delete().neq("id", "");
      }
      return NextResponse.json({ success: true });
    }

    if (action === "DELETE_TOPIC" && body.topicId) {
      await supabase.from("topic_templates").delete().eq("id", body.topicId);
      return NextResponse.json({ success: true });
    }

    // 5. Zapis/Synchronizacja Ustawień
    if (action === "SYNC_SETTINGS" && settings) {
      await supabase.from("tenant_settings").upsert(
        {
          tenant_id: settings.tenantId || "tenant-sb-tech-poznan",
          organization_name: settings.organizationName,
          logo_text: settings.logoText,
          logo_subtitle: settings.logoSubtitle,
          start_shift_email_recipients: settings.startShiftEmailRecipients,
          end_shift_email_recipients: settings.endShiftEmailRecipients,
          resend_from_email: settings.resendFromEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
      return NextResponse.json({ success: true });
    }

    // 6. Zapis/Synchronizacja Szablonów PDF (HTML)
    if (action === "SYNC_PDF_TEMPLATES" && pdfTemplates) {
      const mapped = pdfTemplates.map((t: PdfTemplate) => ({
        id: t.id,
        tenant_id: t.tenantId || "tenant-sb-tech-poznan",
        report_type: t.reportType,
        name: t.name,
        html_content: t.htmlContent,
        active: t.active !== undefined ? t.active : true,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from("pdf_templates").upsert(mapped, { onConflict: "id" });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd synchronizacji Supabase";
    console.error("Supabase sync error:", err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
