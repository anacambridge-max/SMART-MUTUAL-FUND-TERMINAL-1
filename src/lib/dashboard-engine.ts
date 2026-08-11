import { db } from "@/db";
import { indexHistory, navHistory } from "@/db/schema";
import { TRACKED_INDICES } from "@/lib/default-config";
import type {
  DashboardPayload,
  FundComputed,
  IndexDashboardRow,
  IndexSnapshot,
  SettingsPayload,
  TacticalAllocation,
} from "@/lib/types";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

type AmfiEntry = {
  schemeCode: string;
  schemeName: string;
  nav: number;
  navDate: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2): number {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseAmfiDate(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;

  const parts = clean.split("-");
  if (parts.length !== 3) return null;

  const [day, mon, year] = parts;
  const map: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };

  const idx = map[mon.toUpperCase()];
  if (idx === undefined) return null;

  const d = Number(day);
  const y = Number(year);
  if (!Number.isFinite(d) || !Number.isFinite(y)) return null;

  const date = new Date(Date.UTC(y, idx, d));
  if (Number.isNaN(date.getTime())) return null;

  return formatDateKey(date);
}

async function fetchNseIndices(): Promise<{ indices: IndexSnapshot[]; status: "ok" | "fallback" | "unavailable" }> {
  try {
    const initRes = await fetch("https://www.nseindia.com", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    const rawCookies = initRes.headers.get("set-cookie") ?? "";
    const cookie = rawCookies
      .split(",")
      .map((c) => c.split(";")[0]?.trim())
      .filter(Boolean)
      .join("; ");

    const dataRes = await fetch("https://www.nseindia.com/api/allIndices", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.nseindia.com/market-data/live-equity-market",
        cookie,
      },
      cache: "no-store",
    });

    if (!dataRes.ok) {
      return { indices: [], status: "fallback" };
    }

    const json = (await dataRes.json()) as {
      data?: Array<{ index?: string; last?: number; percentChange?: number; pChange?: number }>;
    };

    const indices = (json.data ?? [])
      .filter((row) => row.index && Number.isFinite(Number(row.last)))
      .map((row) => ({
        name: String(row.index),
        value: Number(row.last),
        changePercent: Number(row.percentChange ?? row.pChange ?? 0),
      }));

    return { indices, status: indices.length > 0 ? "ok" : "fallback" };
  } catch {
    return { indices: [], status: "unavailable" };
  }
}

async function fetchSensexFallback(): Promise<IndexSnapshot | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN?interval=1d&range=5d",
      { cache: "no-store" },
    );
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }>;
      };
    };

    const meta = json.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice || !meta.chartPreviousClose) return null;

    const changePercent =
      ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;

    return {
      name: "SENSEX",
      value: Number(meta.regularMarketPrice),
      changePercent: Number(changePercent),
    };
  } catch {
    return null;
  }
}

async function fetchAmfiData(): Promise<{ entries: AmfiEntry[]; status: "ok" | "fallback" | "unavailable" }> {
  try {
    const res = await fetch("https://www.amfiindia.com/spider/getNAVdata.aspx", {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/plain,*/*",
      },
    });

    if (!res.ok) return { entries: [], status: "fallback" };

    const text = await res.text();
    const lines = text.split(/\r?\n/);

    const entries: AmfiEntry[] = [];

    for (const line of lines) {
      if (!line.includes(";")) continue;
      const parts = line.split(";");
      if (parts.length < 6) continue;

      const schemeCode = parts[0]?.trim();
      const schemeName = parts[3]?.trim();
      const nav = Number(parts[4]?.trim());
      const navDateRaw = parts[5]?.trim();
      const navDate = navDateRaw ? parseAmfiDate(navDateRaw) : null;

      if (!schemeCode || !schemeName || !Number.isFinite(nav) || !navDate) continue;
      entries.push({ schemeCode, schemeName, nav, navDate });
    }

    return { entries, status: entries.length > 0 ? "ok" : "fallback" };
  } catch {
    return { entries: [], status: "unavailable" };
  }
}

function findFundNavEntry(entries: AmfiEntry[], schemeCode: string | undefined, search: string): AmfiEntry | null {
  if (schemeCode) {
    const exactCode = entries.find((e) => e.schemeCode === schemeCode);
    if (exactCode) return exactCode;
  }

  const q = search.toLowerCase();
  return entries.find((e) => e.schemeName.toLowerCase().includes(q)) ?? null;
}

type TimePoint = { at: Date; value: number };

function seriesSma(points: TimePoint[], period: number): number | null {
  if (points.length < period) return null;
  const slice = points.slice(-period);
  const sum = slice.reduce((acc, p) => acc + p.value, 0);
  return sum / period;
}

function pointBefore(points: TimePoint[], daysAgo: number): TimePoint | null {
  if (points.length === 0) return null;
  const threshold = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

  let candidate: TimePoint | null = null;
  for (const p of points) {
    if (p.at.getTime() <= threshold) candidate = p;
  }

  return candidate ?? points[0];
}

function percentFrom(base: number | null, latest: number | null): number | null {
  if (!base || !latest || base === 0) return null;
  return ((latest - base) / base) * 100;
}

function computeFundMetrics(points: TimePoint[], nifty50Return50d: number | null) {
  const latest = points[points.length - 1]?.value ?? null;
  const max52w = points.slice(-252).reduce((m, p) => Math.max(m, p.value), 0);
  const maxAll = points.reduce((m, p) => Math.max(m, p.value), 0);

  const base1m = pointBefore(points, 30)?.value ?? null;
  const base3m = pointBefore(points, 90)?.value ?? null;
  const base6m = pointBefore(points, 180)?.value ?? null;
  const base10d = pointBefore(points, 10)?.value ?? null;
  const base20d = pointBefore(points, 20)?.value ?? null;
  const base50d = pointBefore(points, 50)?.value ?? null;

  const return50d = percentFrom(base50d, latest);

  return {
    drawdown52w: latest && max52w ? ((latest - max52w) / max52w) * 100 : null,
    drawdownAllTime: latest && maxAll ? ((latest - maxAll) / maxAll) * 100 : null,
    return1m: percentFrom(base1m, latest),
    return3m: percentFrom(base3m, latest),
    return6m: percentFrom(base6m, latest),
    sma20: seriesSma(points, 20),
    sma50: seriesSma(points, 50),
    sma100: seriesSma(points, 100),
    sma200: seriesSma(points, 200),
    momentum10d: percentFrom(base10d, latest),
    momentum20d: percentFrom(base20d, latest),
    momentum50d: return50d,
    relativeStrengthVsNifty50d:
      return50d === null || nifty50Return50d === null ? null : return50d - nifty50Return50d,
  };
}

function computeScores({
  latestNav,
  proxyMove,
  metrics,
}: {
  latestNav: number | null;
  proxyMove: number;
  metrics: ReturnType<typeof computeFundMetrics>;
}) {
  const trendUp =
    latestNav !== null &&
    metrics.sma50 !== null &&
    metrics.sma200 !== null &&
    latestNav > metrics.sma50 &&
    metrics.sma50 > metrics.sma200;

  const trendBroken =
    (latestNav !== null && metrics.sma200 !== null && latestNav < metrics.sma200 * 0.95) ||
    (metrics.sma50 !== null && metrics.sma200 !== null && metrics.sma50 < metrics.sma200 * 0.97) ||
    ((metrics.return3m ?? 0) < -15);

  const strategicTrend = trendUp ? 30 : latestNav && metrics.sma200 && latestNav > metrics.sma200 ? 20 : 10;
  const strategicReturns = clamp(((metrics.return6m ?? 0) + 15) * 1.1, 0, 25);
  const strategicDrawdown = clamp(20 - Math.abs(metrics.drawdownAllTime ?? -20) * 0.3, 0, 20);
  const strategicMomentum = clamp(((metrics.momentum50d ?? 0) + 10) * 0.8, 0, 15);
  const strategicRS = clamp(((metrics.relativeStrengthVsNifty50d ?? 0) + 8) * 0.7, 0, 10);
  const strategicScore = clamp(
    strategicTrend + strategicReturns + strategicDrawdown + strategicMomentum + strategicRS,
    0,
    100,
  );

  const dipComponent = clamp((-proxyMove || 0) * 12, 0, 35);
  const drawdownRoom = clamp(Math.abs(Math.min(metrics.drawdown52w ?? 0, 0)) * 1.2, 0, 20);
  const trendConfirm = trendBroken ? 0 : trendUp ? 20 : 10;
  const momentum = clamp(((metrics.momentum20d ?? 0) + 8) * 0.8, 0, 15);
  const rs = clamp(((metrics.relativeStrengthVsNifty50d ?? 0) + 8) * 0.6, 0, 10);
  const navOpportunityScore = clamp(dipComponent + drawdownRoom + trendConfirm + momentum + rs, 0, 100);

  return { strategicScore, navOpportunityScore, trendBroken, trendUp };
}

function makeExpectedImpactNote(proxyMove: number): string {
  if (proxyMove <= -1.25) {
    return "Strong sector/index weakness today is likely to be reflected in closing NAV pressure.";
  }
  if (proxyMove < 0) {
    return "Mild weakness today may create potential same-day NAV opportunity by close.";
  }
  if (proxyMove > 1) {
    return "Strength in proxy index suggests limited dip opportunity in closing NAV today.";
  }
  return "Mixed market movement; expected NAV impact is likely muted by close.";
}

function findIndex(map: Map<string, IndexSnapshot>, names: string[]): IndexSnapshot | null {
  for (const n of names) {
    const direct = map.get(n);
    if (direct) return direct;

    const upper = n.toUpperCase();
    for (const [k, v] of map) {
      if (k.toUpperCase() === upper) return v;
    }
  }
  return null;
}

export async function buildDashboardPayload(settings: SettingsPayload): Promise<DashboardPayload> {
  const [nseResult, amfiResult] = await Promise.all([fetchNseIndices(), fetchAmfiData()]);

  const indexMap = new Map<string, IndexSnapshot>();
  for (const row of nseResult.indices) {
    indexMap.set(row.name, row);
  }

  if (!findIndex(indexMap, ["SENSEX"])) {
    const sensex = await fetchSensexFallback();
    if (sensex) indexMap.set("SENSEX", sensex);
  }

  const tracked = TRACKED_INDICES.map((name) =>
    findIndex(indexMap, [name, name.replace("NIFTY ", "NIFTY")]) ?? {
      name,
      value: 0,
      changePercent: 0,
    },
  );

  const availableNow = tracked.filter((i) => i.value > 0);

  if (availableNow.length > 0) {
    await db.insert(indexHistory).values(
      availableNow.map((i) => ({
        indexName: i.name,
        indexValue: String(i.value),
        changePercent: String(i.changePercent),
      })),
    );
  }

  const indexNames = [...new Set(TRACKED_INDICES)];
  const historyRows = await db
    .select({
      indexName: indexHistory.indexName,
      indexValue: indexHistory.indexValue,
      recordedAt: indexHistory.recordedAt,
    })
    .from(indexHistory)
    .where(
      and(
        inArray(indexHistory.indexName, indexNames),
        gte(indexHistory.recordedAt, new Date(Date.now() - 420 * 24 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(asc(indexHistory.recordedAt));

  const indexSeries = new Map<string, TimePoint[]>();
  for (const row of historyRows) {
    const arr = indexSeries.get(row.indexName) ?? [];
    arr.push({ at: new Date(row.recordedAt), value: Number(row.indexValue) });
    indexSeries.set(row.indexName, arr);
  }

  const indexDashboard: IndexDashboardRow[] = tracked.map((idx) => {
    const points = indexSeries.get(idx.name) ?? [];
    const merged = idx.value > 0 ? [...points, { at: new Date(), value: idx.value }] : points;
    const latest = merged[merged.length - 1]?.value ?? null;

    const dma20 = seriesSma(merged, 20);
    const dma50 = seriesSma(merged, 50);
    const dma200 = seriesSma(merged, 200);

    const trend: IndexDashboardRow["trend"] =
      latest && dma50 && dma200 ? (latest > dma50 && dma50 > dma200 ? "UP" : latest < dma50 && dma50 < dma200 ? "DOWN" : "MIXED") : "MIXED";

    return {
      name: idx.name,
      today: idx.changePercent,
      fiveDay: percentFrom(pointBefore(merged, 5)?.value ?? null, latest),
      oneMonth: percentFrom(pointBefore(merged, 30)?.value ?? null, latest),
      threeMonth: percentFrom(pointBefore(merged, 90)?.value ?? null, latest),
      fiftyTwoWeek: percentFrom(pointBefore(merged, 365)?.value ?? null, latest),
      dma20,
      dma50,
      dma200,
      trend,
    };
  });

  const nifty50Series = indexSeries.get("NIFTY 50") ?? [];
  const nifty50Current = findIndex(indexMap, ["NIFTY 50"]);
  const nifty50Merged = nifty50Current?.value
    ? [...nifty50Series, { at: new Date(), value: nifty50Current.value }]
    : nifty50Series;
  const nifty50Return50d = percentFrom(
    pointBefore(nifty50Merged, 50)?.value ?? null,
    nifty50Merged[nifty50Merged.length - 1]?.value ?? null,
  );

  const matchedFundEntries = settings.fundsConfig
    .map((fund) => ({ fund, entry: findFundNavEntry(amfiResult.entries, fund.schemeCode, fund.schemeSearch) }))
    .filter((row): row is { fund: SettingsPayload["fundsConfig"][number]; entry: AmfiEntry } => Boolean(row.entry));

  if (matchedFundEntries.length > 0) {
    await db
      .insert(navHistory)
      .values(
        matchedFundEntries.map(({ entry }) => ({
          schemeCode: entry.schemeCode,
          schemeName: entry.schemeName,
          nav: String(entry.nav),
          navDate: entry.navDate,
        })),
      )
      .onConflictDoNothing();
  }

  const schemeCodes = [...new Set(matchedFundEntries.map((x) => x.entry.schemeCode))];
  const navRows =
    schemeCodes.length > 0
      ? await db
          .select({
            schemeCode: navHistory.schemeCode,
            nav: navHistory.nav,
            navDate: navHistory.navDate,
          })
          .from(navHistory)
          .where(inArray(navHistory.schemeCode, schemeCodes))
          .orderBy(asc(navHistory.navDate))
      : [];

  const navSeriesMap = new Map<string, TimePoint[]>();
  for (const row of navRows) {
    const arr = navSeriesMap.get(row.schemeCode) ?? [];
    arr.push({ at: new Date(row.navDate), value: Number(row.nav) });
    navSeriesMap.set(row.schemeCode, arr);
  }

  const funds: FundComputed[] = settings.fundsConfig.map((fund) => {
    const matched = matchedFundEntries.find((row) => row.fund.id === fund.id)?.entry ?? null;
    const proxyMove = findIndex(indexMap, [fund.proxyIndex])?.changePercent ?? 0;

    const points = matched ? navSeriesMap.get(matched.schemeCode) ?? [] : [];
    const latestPoint = points[points.length - 1] ?? null;
    const metrics = computeFundMetrics(points, nifty50Return50d);
    const { strategicScore, navOpportunityScore, trendBroken } = computeScores({
      latestNav: latestPoint?.value ?? null,
      proxyMove,
      metrics,
    });

    let classification: FundComputed["classification"] = "Healthy Correction";
    let actionTag: FundComputed["actionTag"] = "SIP";
    let reason = "Trend appears intact with normal volatility.";

    if (trendBroken) {
      classification = "Structural Breakdown";
      actionTag = "AVOID TODAY";
      reason = "Trend filter violation (below long-term moving average / weak medium-term structure).";
    } else if (proxyMove <= -1.2) {
      actionTag = "BUY ON DIP";
      reason = "Proxy index is meaningfully weak while fund structure remains healthy.";
    } else if (proxyMove > 0.75) {
      actionTag = "WAIT";
      reason = "Proxy index is strong today; tactical dip opportunity appears limited.";
    }

    let finalDailyScore =
      (settings.strategicWeight / 100) * strategicScore +
      (settings.navOpportunityWeight / 100) * navOpportunityScore;

    if (trendBroken) {
      finalDailyScore = Math.min(finalDailyScore, 35);
    }

    return {
      id: fund.id,
      name: fund.name,
      schemeCode: matched?.schemeCode ?? null,
      proxyIndex: fund.proxyIndex,
      latestNav: latestPoint?.value ?? null,
      latestNavDate: latestPoint ? formatDateKey(latestPoint.at) : null,
      mappedMove: round(proxyMove),
      strategicScore: round(strategicScore),
      navOpportunityScore: round(navOpportunityScore),
      finalDailyScore: round(finalDailyScore),
      classification,
      actionTag,
      reason,
      expectedImpactNote: makeExpectedImpactNote(proxyMove),
      metrics: {
        drawdown52w: metrics.drawdown52w !== null ? round(metrics.drawdown52w) : null,
        drawdownAllTime: metrics.drawdownAllTime !== null ? round(metrics.drawdownAllTime) : null,
        return1m: metrics.return1m !== null ? round(metrics.return1m) : null,
        return3m: metrics.return3m !== null ? round(metrics.return3m) : null,
        return6m: metrics.return6m !== null ? round(metrics.return6m) : null,
        sma20: metrics.sma20 !== null ? round(metrics.sma20, 3) : null,
        sma50: metrics.sma50 !== null ? round(metrics.sma50, 3) : null,
        sma100: metrics.sma100 !== null ? round(metrics.sma100, 3) : null,
        sma200: metrics.sma200 !== null ? round(metrics.sma200, 3) : null,
        momentum10d: metrics.momentum10d !== null ? round(metrics.momentum10d) : null,
        momentum20d: metrics.momentum20d !== null ? round(metrics.momentum20d) : null,
        momentum50d: metrics.momentum50d !== null ? round(metrics.momentum50d) : null,
        relativeStrengthVsNifty50d:
          metrics.relativeStrengthVsNifty50d !== null ? round(metrics.relativeStrengthVsNifty50d) : null,
      },
    };
  });

  const topFunds = funds
    .filter((f) => f.classification !== "Structural Breakdown")
    .sort((a, b) => b.finalDailyScore - a.finalDailyScore)
    .slice(0, 5);

  const avoidFunds = funds.filter((f) => f.classification === "Structural Breakdown");

  const tacticalAllocation: TacticalAllocation[] = [];
  const topup = settings.tacticalTopupAmount;
  if (topup && topup > 0 && topFunds.length > 0) {
    const scoreSum = topFunds.reduce((sum, f) => sum + Math.max(1, f.finalDailyScore), 0);
    for (const f of topFunds) {
      const weight = (Math.max(1, f.finalDailyScore) / scoreSum) * 100;
      tacticalAllocation.push({
        fundId: f.id,
        fundName: f.name,
        weightPercent: round(weight),
        amount: round((topup * weight) / 100, 0),
      });
    }
  }

  const sectorNames = [
    "NIFTY BANK",
    "NIFTY FINANCIAL SERVICES",
    "NIFTY IT",
    "NIFTY AUTO",
    "NIFTY PHARMA",
    "NIFTY FMCG",
    "NIFTY METAL",
    "NIFTY REALTY",
    "NIFTY ENERGY",
    "NIFTY PSU BANK",
    "NIFTY INFRASTRUCTURE",
    "NIFTY SERVICES SECTOR",
  ];

  const sectorHeatmap = sectorNames
    .map((name) => findIndex(indexMap, [name]))
    .filter((x): x is IndexSnapshot => Boolean(x));

  const greenCount = sectorHeatmap.filter((s) => s.changePercent > 0).length;
  const breadthPercent = sectorHeatmap.length > 0 ? (greenCount / sectorHeatmap.length) * 100 : 0;

  const majorRows = indexDashboard.filter((r) =>
    ["NIFTY 50", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250"].includes(r.name),
  );
  const majorUp = majorRows.filter((r) => r.trend === "UP").length;

  const riskOn = majorUp >= 2 && breadthPercent >= 50;

  const strongestIndices = [...tracked]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);

  const weakestIndices = [...tracked]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  const headlineIndices = ["NIFTY 50", "SENSEX", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250"]
    .map((n) => findIndex(indexMap, [n]))
    .filter((x): x is IndexSnapshot => Boolean(x));

  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: {
      nse: nseResult.status,
      amfi: amfiResult.status,
      note:
        "Best-effort data from free/unofficial sources. NSE endpoints may be delayed/rate-limited; AMFI NAV is end-of-day publication.",
    },
    settings,
    marketRegime: {
      badge: riskOn ? "RISK ON" : "RISK OFF",
      color: riskOn ? "green" : "red",
      strategyNote: riskOn
        ? "Continue SIP + deploy corrections selectively."
        : "Continue core SIP, reduce tactical allocation, avoid chasing sector funds.",
      breadthPercent: round(breadthPercent),
    },
    headlineIndices,
    strongestIndices,
    weakestIndices,
    sectorHeatmap,
    indexDashboard,
    funds,
    topFunds,
    avoidFunds,
    tacticalAllocation,
  };
}

export async function buildFallbackPayload(settings: SettingsPayload): Promise<DashboardPayload> {
  const latestIndices = await db
    .select({
      indexName: indexHistory.indexName,
      indexValue: indexHistory.indexValue,
      changePercent: indexHistory.changePercent,
      recordedAt: indexHistory.recordedAt,
    })
    .from(indexHistory)
    .orderBy(desc(indexHistory.recordedAt))
    .limit(100);

  const dedup = new Map<string, IndexSnapshot>();
  for (const row of latestIndices) {
    if (!dedup.has(row.indexName)) {
      dedup.set(row.indexName, {
        name: row.indexName,
        value: Number(row.indexValue),
        changePercent: Number(row.changePercent),
      });
    }
  }

  const headlineIndices = ["NIFTY 50", "SENSEX", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250"]
    .map((n) => dedup.get(n))
    .filter((x): x is IndexSnapshot => Boolean(x));

  return {
    generatedAt: new Date().toISOString(),
    sourceStatus: {
      nse: "fallback",
      amfi: "fallback",
      note:
        "Live data unavailable. Showing fallback snapshot built from last stored database values.",
    },
    settings,
    marketRegime: {
      badge: "RISK OFF",
      color: "red",
      strategyNote: "Live refresh unavailable. Continue core SIP and wait for confirmation.",
      breadthPercent: 0,
    },
    headlineIndices,
    strongestIndices: [...dedup.values()].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
    weakestIndices: [...dedup.values()].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5),
    sectorHeatmap: [...dedup.values()].slice(0, 12),
    indexDashboard: TRACKED_INDICES.map((name) => ({
      name,
      today: dedup.get(name)?.changePercent ?? 0,
      fiveDay: null,
      oneMonth: null,
      threeMonth: null,
      fiftyTwoWeek: null,
      dma20: null,
      dma50: null,
      dma200: null,
      trend: "MIXED",
    })),
    funds: settings.fundsConfig.map((fund) => ({
      id: fund.id,
      name: fund.name,
      schemeCode: fund.schemeCode ?? null,
      proxyIndex: fund.proxyIndex,
      latestNav: null,
      latestNavDate: null,
      mappedMove: dedup.get(fund.proxyIndex)?.changePercent ?? 0,
      strategicScore: 50,
      navOpportunityScore: 50,
      finalDailyScore: 50,
      classification: "Healthy Correction",
      actionTag: "SIP",
      reason: "Fallback mode with limited historical context.",
      expectedImpactNote: "Potential same-day NAV opportunity can only be inferred from proxy movement.",
      metrics: {
        drawdown52w: null,
        drawdownAllTime: null,
        return1m: null,
        return3m: null,
        return6m: null,
        sma20: null,
        sma50: null,
        sma100: null,
        sma200: null,
        momentum10d: null,
        momentum20d: null,
        momentum50d: null,
        relativeStrengthVsNifty50d: null,
      },
    })),
    topFunds: [],
    avoidFunds: [],
    tacticalAllocation: [],
  };
}
