import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { User, ConstructionSite, DiscussedTopicTemplate, TenantSettings, DailyReport, PdfTemplate } from "@/types";
import { optimizeReportForStorage, BUCKET_NAME } from "@/lib/supabase-storage";

export async function GET() {
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
      supabase.from("daily_reports").select("*").order("created_at", { ascending: false }),
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

    // Mapowanie raportów
    const reports: DailyReport[] = (reportsRes.data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      reportType: row.report_type,
      date: row.date,
      time: row.time,
      siteId: row.site_id,
      siteName: row.site_name,
      foremanId: row.foreman_id,
      foremanName: row.foreman_name,
      location: row.location || {},
      discussedTopics: row.discussed_topics || [],
      attendanceList: row.attendance_list || [],
      photoDocumentation: row.photo_documentation || [],
      pdfFileName: row.pdf_file_name,
      pdfDataUrl: row.pdf_data_url,
      sentToEmails: row.sent_to_emails || [],
      sentAt: row.sent_at,
      status: row.status,
    }));

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

    return NextResponse.json({
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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Błąd połączenia z Supabase";
    console.error("Supabase fetch error:", err);
    return NextResponse.json({ success: false, isConnected: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    // 1. Zapis/Aktualizacja nowego raportu dziennego (z optymalizacją Storage Bucket)
    if (action === "SAVE_REPORT" && report) {
      // Optymalizacja: wyślij pliki PDF, zdjęcia i podpisy do bucketu rycos-reports
      const optimized = await optimizeReportForStorage(report);

      const { error } = await supabase.from("daily_reports").upsert(
        {
          id: optimized.id,
          tenant_id: optimized.tenantId || "tenant-sb-tech-poznan",
          report_type: optimized.reportType,
          date: optimized.date,
          time: optimized.time,
          site_id: optimized.siteId,
          site_name: optimized.siteName,
          foreman_id: optimized.foremanId,
          foreman_name: optimized.foremanName,
          location: optimized.location || {},
          discussed_topics: optimized.discussedTopics || [],
          attendance_list: optimized.attendanceList || [],
          photo_documentation: optimized.photoDocumentation || [],
          pdf_file_name: optimized.pdfFileName,
          pdf_data_url: optimized.pdfDataUrl,
          sent_to_emails: optimized.sentToEmails || [],
          sent_at: optimized.sentAt || new Date().toISOString(),
          status: optimized.status || "SENT",
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("Supabase save report error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Raport zapisany w bazie Supabase i przesłany do Storage Bucket",
        optimizedReport: optimized,
      });
    }

    // 2. Zapis/Synchronizacja Użytkowników
    if (action === "SYNC_USERS" && users) {
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
      return NextResponse.json({ success: true });
    }

    // 3. Zapis/Synchronizacja Placów Budowy
    if (action === "SYNC_SITES" && sites) {
      const mapped = sites.map((s: ConstructionSite) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        active: s.active,
      }));
      await supabase.from("construction_sites").upsert(mapped, { onConflict: "id" });
      return NextResponse.json({ success: true });
    }

    // 4. Zapis/Synchronizacja Szablonów Tematów
    if (action === "SYNC_TOPICS" && topics) {
      const mapped = topics.map((t: DiscussedTopicTemplate) => ({
        id: t.id,
        title: t.title,
        category: t.category || "BHP",
      }));
      await supabase.from("topic_templates").upsert(mapped, { onConflict: "id" });
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
