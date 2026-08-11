import type { FundConfig, SettingsPayload } from "@/lib/types";

export const TRACKED_INDICES = [
  "NIFTY 50",
  "NIFTY NEXT 50",
  "NIFTY MIDCAP 150",
  "NIFTY SMALLCAP 250",
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
  "SENSEX",
];

export const DEFAULT_FUNDS: FundConfig[] = [
  { id: "sbi-nifty-50", name: "SBI Nifty 50 Index Fund", schemeSearch: "SBI Nifty Index Fund", proxyIndex: "NIFTY 50" },
  { id: "uti-next-50", name: "UTI Nifty Next 50 Index Fund", schemeSearch: "UTI Nifty Next 50 Index Fund", proxyIndex: "NIFTY NEXT 50" },
  { id: "uti-gold", name: "UTI Gold ETF FoF", schemeSearch: "UTI Gold ETF Fund of Fund", proxyIndex: "NIFTY ENERGY" },
  { id: "sbi-small-cap", name: "SBI Small Cap Fund", schemeSearch: "SBI Small Cap Fund", proxyIndex: "NIFTY SMALLCAP 250" },
  { id: "hdfc-mid-cap", name: "HDFC Mid-Cap Opportunities Fund", schemeSearch: "HDFC Mid-Cap Opportunities Fund", proxyIndex: "NIFTY MIDCAP 150" },
  { id: "quant-large-mid", name: "Quant Large and Mid Cap Fund", schemeSearch: "Quant Large and Mid Cap Fund", proxyIndex: "NIFTY MIDCAP 150" },
  { id: "tata-digital", name: "Tata Digital India Fund", schemeSearch: "Tata Digital India Fund", proxyIndex: "NIFTY IT" },
  { id: "sbi-healthcare", name: "SBI Healthcare Opportunities Fund", schemeSearch: "SBI Healthcare Opportunities Fund", proxyIndex: "NIFTY PHARMA" },
  { id: "quant-bfsi", name: "Quant BFSI Fund", schemeSearch: "Quant BFSI Fund", proxyIndex: "NIFTY FINANCIAL SERVICES" },
  { id: "quant-infra", name: "Quant Infrastructure Fund", schemeSearch: "Quant Infrastructure Fund", proxyIndex: "NIFTY INFRASTRUCTURE" },
  { id: "sundaram-services", name: "Sundaram Services Fund", schemeSearch: "Sundaram Services Fund", proxyIndex: "NIFTY SERVICES SECTOR" },
  { id: "parag-parikh-flexi", name: "Parag Parikh Flexi Cap Fund", schemeSearch: "Parag Parikh Flexi Cap Fund", proxyIndex: "NIFTY 50" },
  { id: "icici-bluechip", name: "ICICI Prudential Bluechip Fund", schemeSearch: "ICICI Prudential Bluechip Fund", proxyIndex: "NIFTY 50" },
  { id: "nippon-small", name: "Nippon India Small Cap Fund", schemeSearch: "Nippon India Small Cap Fund", proxyIndex: "NIFTY SMALLCAP 250" },
  { id: "axis-midcap", name: "Axis Midcap Fund", schemeSearch: "Axis Midcap Fund", proxyIndex: "NIFTY MIDCAP 150" },
  { id: "mirae-large-cap", name: "Mirae Asset Large Cap Fund", schemeSearch: "Mirae Asset Large Cap Fund", proxyIndex: "NIFTY 50" },
  { id: "hdfc-balanced-adv", name: "HDFC Balanced Advantage Fund", schemeSearch: "HDFC Balanced Advantage Fund", proxyIndex: "NIFTY 50" },
  { id: "kotak-psu", name: "Kotak PSU Bank ETF FoF", schemeSearch: "Kotak PSU Bank ETF", proxyIndex: "NIFTY PSU BANK" },
  { id: "icici-technology", name: "ICICI Prudential Technology Fund", schemeSearch: "ICICI Prudential Technology Fund", proxyIndex: "NIFTY IT" },
];

export const DEFAULT_SETTINGS: SettingsPayload = {
  marketDataProvider: "nse",
  strategicWeight: 60,
  navOpportunityWeight: 40,
  tacticalTopupAmount: null,
  fundsConfig: DEFAULT_FUNDS,
};
