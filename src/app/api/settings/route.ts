import { DEFAULT_FUNDS } from "@/lib/default-config";
import { getOrCreateSettings, updateSettings } from "@/lib/store";
import type { SettingsPayload } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSettings(body: Partial<SettingsPayload>): SettingsPayload {
  const strategicWeight = Number(body.strategicWeight ?? 60);
  const navOpportunityWeight = Number(body.navOpportunityWeight ?? 40);
  const tacticalTopupAmount =
    body.tacticalTopupAmount === null || body.tacticalTopupAmount === undefined
      ? null
      : Number(body.tacticalTopupAmount);

  return {
    marketDataProvider:
      body.marketDataProvider === "manual" || body.marketDataProvider === "zerodha"
        ? body.marketDataProvider
        : "nse",
    strategicWeight: Number.isFinite(strategicWeight) ? strategicWeight : 60,
    navOpportunityWeight: Number.isFinite(navOpportunityWeight) ? navOpportunityWeight : 40,
    tacticalTopupAmount:
      tacticalTopupAmount !== null && Number.isFinite(tacticalTopupAmount)
        ? Math.max(0, tacticalTopupAmount)
        : null,
    fundsConfig:
      Array.isArray(body.fundsConfig) && body.fundsConfig.length > 0
        ? body.fundsConfig.map((f, idx) => ({
            id: String(f.id ?? `fund-${idx + 1}`),
            name: String(f.name ?? "Unnamed Fund"),
            schemeCode: f.schemeCode ? String(f.schemeCode) : undefined,
            schemeSearch: String(f.schemeSearch ?? f.name ?? ""),
            proxyIndex: String(f.proxyIndex ?? "NIFTY 50"),
            category: f.category ? String(f.category) : undefined,
          }))
        : DEFAULT_FUNDS,
  };
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<SettingsPayload>;
    const normalized = normalizeSettings(body);
    const settings = await updateSettings(normalized);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to update settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
