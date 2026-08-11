import { db } from "@/db";
import { appSettings, dashboardSnapshots } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/default-config";
import type { DashboardPayload, SettingsPayload } from "@/lib/types";
import { desc, eq } from "drizzle-orm";

function parseSettingsRow(row: typeof appSettings.$inferSelect): SettingsPayload {
  const fundsConfig = Array.isArray(row.fundsConfig)
    ? row.fundsConfig
    : DEFAULT_SETTINGS.fundsConfig;

  return {
    marketDataProvider:
      row.marketDataProvider === "manual" || row.marketDataProvider === "zerodha"
        ? row.marketDataProvider
        : "nse",
    strategicWeight: row.strategicWeight,
    navOpportunityWeight: row.navOpportunityWeight,
    tacticalTopupAmount: row.tacticalTopupAmount ? Number(row.tacticalTopupAmount) : null,
    fundsConfig: fundsConfig as SettingsPayload["fundsConfig"],
  };
}

export async function getOrCreateSettings(): Promise<SettingsPayload> {
  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  if (existing.length > 0) {
    return parseSettingsRow(existing[0]);
  }

  await db.insert(appSettings).values({
    id: 1,
    marketDataProvider: DEFAULT_SETTINGS.marketDataProvider,
    strategicWeight: DEFAULT_SETTINGS.strategicWeight,
    navOpportunityWeight: DEFAULT_SETTINGS.navOpportunityWeight,
    tacticalTopupAmount: null,
    fundsConfig: DEFAULT_SETTINGS.fundsConfig,
  });

  return DEFAULT_SETTINGS;
}

export async function updateSettings(nextSettings: SettingsPayload): Promise<SettingsPayload> {
  const strategicWeight = Math.max(0, Math.min(100, Math.round(nextSettings.strategicWeight)));
  const navOpportunityWeight = Math.max(
    0,
    Math.min(100, Math.round(nextSettings.navOpportunityWeight)),
  );

  const total = strategicWeight + navOpportunityWeight || 1;

  await db
    .insert(appSettings)
    .values({
      id: 1,
      marketDataProvider: nextSettings.marketDataProvider,
      strategicWeight: Math.round((strategicWeight / total) * 100),
      navOpportunityWeight: Math.round((navOpportunityWeight / total) * 100),
      tacticalTopupAmount:
        nextSettings.tacticalTopupAmount === null
          ? null
          : String(Math.max(0, nextSettings.tacticalTopupAmount).toFixed(2)),
      fundsConfig: nextSettings.fundsConfig,
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        marketDataProvider: nextSettings.marketDataProvider,
        strategicWeight: Math.round((strategicWeight / total) * 100),
        navOpportunityWeight: Math.round((navOpportunityWeight / total) * 100),
        tacticalTopupAmount:
          nextSettings.tacticalTopupAmount === null
            ? null
            : String(Math.max(0, nextSettings.tacticalTopupAmount).toFixed(2)),
        fundsConfig: nextSettings.fundsConfig,
        updatedAt: new Date(),
      },
    });

  return getOrCreateSettings();
}

export async function getLatestSnapshot(): Promise<DashboardPayload | null> {
  const snapshot = await db
    .select()
    .from(dashboardSnapshots)
    .orderBy(desc(dashboardSnapshots.createdAt))
    .limit(1);

  if (!snapshot[0]) return null;
  return snapshot[0].payload as DashboardPayload;
}

export async function saveSnapshot(payload: DashboardPayload): Promise<void> {
  await db.insert(dashboardSnapshots).values({ payload });
}
