export type MarketDataProvider = "nse" | "zerodha" | "manual";

export type FundConfig = {
  id: string;
  name: string;
  schemeCode?: string;
  schemeSearch: string;
  proxyIndex: string;
  category?: string;
};

export type SettingsPayload = {
  marketDataProvider: MarketDataProvider;
  strategicWeight: number;
  navOpportunityWeight: number;
  tacticalTopupAmount: number | null;
  fundsConfig: FundConfig[];
};

export type IndexSnapshot = {
  name: string;
  value: number;
  changePercent: number;
};

export type IndexDashboardRow = {
  name: string;
  today: number;
  fiveDay: number | null;
  oneMonth: number | null;
  threeMonth: number | null;
  fiftyTwoWeek: number | null;
  dma20: number | null;
  dma50: number | null;
  dma200: number | null;
  trend: "UP" | "DOWN" | "MIXED";
};

export type FundComputed = {
  id: string;
  name: string;
  schemeCode: string | null;
  proxyIndex: string;
  latestNav: number | null;
  latestNavDate: string | null;
  mappedMove: number;
  strategicScore: number;
  navOpportunityScore: number;
  finalDailyScore: number;
  classification: "Healthy Correction" | "Structural Breakdown";
  actionTag: "BUY ON DIP" | "SIP" | "WAIT" | "AVOID TODAY";
  reason: string;
  expectedImpactNote: string;
  metrics: {
    drawdown52w: number | null;
    drawdownAllTime: number | null;
    return1m: number | null;
    return3m: number | null;
    return6m: number | null;
    sma20: number | null;
    sma50: number | null;
    sma100: number | null;
    sma200: number | null;
    momentum10d: number | null;
    momentum20d: number | null;
    momentum50d: number | null;
    relativeStrengthVsNifty50d: number | null;
  };
};

export type TacticalAllocation = {
  fundId: string;
  fundName: string;
  amount: number;
  weightPercent: number;
};

export type DashboardPayload = {
  generatedAt: string;
  sourceStatus: {
    nse: "ok" | "fallback" | "unavailable";
    amfi: "ok" | "fallback" | "unavailable";
    note: string;
  };
  settings: SettingsPayload;
  marketRegime: {
    badge: "RISK ON" | "RISK OFF";
    color: "green" | "red";
    strategyNote: string;
    breadthPercent: number;
  };
  headlineIndices: IndexSnapshot[];
  strongestIndices: IndexSnapshot[];
  weakestIndices: IndexSnapshot[];
  sectorHeatmap: IndexSnapshot[];
  indexDashboard: IndexDashboardRow[];
  funds: FundComputed[];
  topFunds: FundComputed[];
  avoidFunds: FundComputed[];
  tacticalAllocation: TacticalAllocation[];
};
