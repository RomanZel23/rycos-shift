import { NextResponse } from "next/server";
import { isGateConfigured } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck dla Coolify / HEALTHCHECK w Dockerfile.
 * Celowo poza bramką Etapu 0 (patrz wyjątki w src/proxy.ts) i celowo nie zdradza
 * niczego poza tym, czy proces stoi i czy kluczowa konfiguracja w ogóle istnieje.
 */
export async function GET() {
  const gate = isGateConfigured();
  const supabase = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return NextResponse.json(
    {
      status: "ok",
      config: { gate, supabase },
    },
    { status: 200 }
  );
}
