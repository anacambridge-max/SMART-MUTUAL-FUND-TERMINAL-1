"use client";

import type { DashboardPayload, FundConfig, SettingsPayload } from "@/lib/types";
import { useMemo, useState } from "react";

type Props = {
  initialPayload: DashboardPayload;
  initialSettings: SettingsPayload;
};

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function colorByPct(v: number): string {
  if (v > 0.4) return "text-emerald-600";
  if (v < -0.4) return "text-rose-600";
  return "text-amber-600";
}

function bgByPct(v: number): string {
  if (v > 0.75) return "bg-emerald-100";
  if (v > 0) return "bg-emerald-50";
  if (v < -0.75) return "bg-rose-100";
  if (v < 0) return "bg-rose-50";
  return "bg-slate-100";
}

function istCutoff() {
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const cutoff = new Date(istNow);
  cutoff.setHours(15, 0, 0, 0);
  const open = new Date(istNow);
  open.setHours(9, 0, 0, 0);

  const total = cutoff.getTime() - open.getTime();
  const elapsed = clamp(istNow.getTime() - open.getTime(), 0, total);
  const leftMs = cutoff.getTime() - istNow.getTime();

  const h = Math.max(0, Math.floor(leftMs / (1000 * 60 * 60)));
  const m = Math.max(0, Math.floor((leftMs % (1000 * 60 * 60)) / (1000 * 60)));

  return {
    leftLabel: leftMs > 0 ? `${h}h ${m}m to 3:00 PM IST cut-off` : "Cut-off window passed for today",
    progress: total > 0 ? (elapsed / total) * 100 : 100,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function DashboardClient({ initialPayload, initialSettings }: Props) {
  const [payload, setPayload] = useState<DashboardPayload>(initialPayload);
  const [settings, setSettings] = useState<SettingsPayload>(initialSettings);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cutoff = useMemo(() => istCutoff(), [payload.generatedAt]);

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch("/api/dashboard/refresh", {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        payload: DashboardPayload;
        error?: string;
      };

      if (!json.ok && json.error) {
        setError(json.error);
      }
      setPayload(json.payload);
    } catch {
      setError("Refresh timed out or provider unavailable. Showing last good snapshot.");
    } finally {
      clearTimeout(timeout);
      setRefreshing(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await res.json()) as { ok: boolean; settings: SettingsPayload; error?: string };

      if (!json.ok) {
        setError(json.error ?? "Failed to save settings");
      } else {
        setSettings(json.settings);
      }
    } catch {
      setError("Unable to save settings currently.");
    } finally {
      setSavingSettings(false);
    }
  };

  const updateFund = (id: string, key: keyof FundConfig, value: string) => {
    setSettings((prev) => ({
      ...prev,
      fundsConfig: prev.fundsConfig.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
    }));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Smart MF Daily Decision Terminal</h1>
              <p className="text-sm text-slate-300">
                Last updated: {new Date(payload.generatedAt).toLocaleTimeString("en-IN")} · Provider: {settings.marketDataProvider.toUpperCase()} · {payload.sourceStatus.note}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "⏳ Refreshing..." : "🔄 Refresh"}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-300">
            Best effort delayed market feed. Intraday mutual fund NAV does not exist; signals indicate potential same-day NAV opportunity only.
          </p>
          {error ? <div className="mt-3 rounded-lg border border-rose-400 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Market Regime</p>
          <div className="mt-1 flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${payload.marketRegime.color === "green" ? "bg-emerald-900 text-emerald-200" : "bg-rose-900 text-rose-200"}`}>
              {payload.marketRegime.color === "green" ? "🟢" : "🔴"} {payload.marketRegime.badge}
            </span>
            <p className="text-sm text-slate-200">{payload.marketRegime.strategyNote} Breadth: {payload.marketRegime.breadthPercent}% green sectors.</p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {payload.headlineIndices.map((idx) => (
            <article key={idx.name} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-400">{idx.name}</p>
              <p className="text-lg font-semibold">{idx.value.toFixed(2)}</p>
              <p className={`text-sm ${colorByPct(idx.changePercent)}`}>{pct(idx.changePercent)}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Biggest Falling Indices (Top 5)</h2>
            <div className="mt-3 space-y-2">
              {payload.weakestIndices.map((idx) => (
                <div key={idx.name} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm">
                  <span>{idx.name}</span>
                  <span className={colorByPct(idx.changePercent)}>{pct(idx.changePercent)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Strongest Indices (Top 3)</h2>
            <div className="mt-3 space-y-2">
              {payload.strongestIndices.map((idx) => (
                <div key={idx.name} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm">
                  <span>{idx.name}</span>
                  <span className={colorByPct(idx.changePercent)}>{pct(idx.changePercent)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">🔥 Top 5 Funds Today</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {payload.topFunds.map((fund) => (
              <article key={fund.id} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                <p className="text-sm font-medium">{fund.name}</p>
                <p className="mt-1 text-xs text-slate-300">Proxy: {fund.proxyIndex} ({pct(fund.mappedMove)})</p>
                <p className="mt-2 text-sm">Strategic: <span className="font-semibold">{fund.strategicScore}</span> · NAV Opp: <span className="font-semibold">{fund.navOpportunityScore}</span></p>
                <p className="text-sm">Final Daily Score: <span className="font-semibold text-cyan-300">{fund.finalDailyScore}</span></p>
                <p className="mt-2 text-xs text-slate-300">{fund.classification === "Healthy Correction" ? "🟢 Healthy Correction" : "🔴 Structural Breakdown"}</p>
                <p className="mt-1 inline-block rounded bg-cyan-900 px-2 py-1 text-xs font-semibold text-cyan-200">{fund.actionTag}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">⚠️ Avoid Today</h2>
          <div className="mt-3 space-y-2">
            {payload.avoidFunds.length === 0 ? <p className="text-sm text-slate-300">No structural breakdown flags right now.</p> : payload.avoidFunds.map((fund) => (
              <div key={fund.id} className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm">
                <p className="font-medium">{fund.name}</p>
                <p className="text-rose-200">Reason: {fund.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Sector Heatmap</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            {payload.sectorHeatmap.map((sector) => (
              <div key={sector.name} className={`rounded-lg p-3 ${bgByPct(sector.changePercent)}`}>
                <p className="text-xs text-slate-800">{sector.name}</p>
                <p className={`text-sm font-semibold ${colorByPct(sector.changePercent)}`}>{pct(sector.changePercent)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 font-semibold">Index Dashboard</h2>
          <table className="min-w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="p-2">Index</th><th className="p-2">Today</th><th className="p-2">5D</th><th className="p-2">1M</th><th className="p-2">3M</th><th className="p-2">52W</th><th className="p-2">20DMA</th><th className="p-2">50DMA</th><th className="p-2">200DMA</th><th className="p-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {payload.indexDashboard.map((row) => (
                <tr key={row.name} className="border-t border-slate-800">
                  <td className="p-2">{row.name}</td>
                  <td className={`p-2 ${colorByPct(row.today)}`}>{pct(row.today)}</td>
                  <td className="p-2">{pct(row.fiveDay)}</td>
                  <td className="p-2">{pct(row.oneMonth)}</td>
                  <td className="p-2">{pct(row.threeMonth)}</td>
                  <td className="p-2">{pct(row.fiftyTwoWeek)}</td>
                  <td className="p-2">{row.dma20?.toFixed(1) ?? "—"}</td>
                  <td className="p-2">{row.dma50?.toFixed(1) ?? "—"}</td>
                  <td className="p-2">{row.dma200?.toFixed(1) ?? "—"}</td>
                  <td className="p-2">{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Fund vs Market Map</h2>
          <div className="mt-3 space-y-2">
            {payload.funds.map((fund) => (
              <div key={fund.id} className="rounded-lg bg-slate-800 p-3 text-sm">
                <p className="font-medium">{fund.name}</p>
                <p className="text-slate-300">{fund.proxyIndex} → {pct(fund.mappedMove)} · {fund.expectedImpactNote}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-300">Proxy mapping is a category approximation, not the fund&apos;s actual portfolio holdings.</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Same-Day NAV Cut-off Window</h2>
          <p className="mt-2 text-sm text-slate-300">{cutoff.leftLabel}</p>
          <div className="mt-2 h-2 rounded bg-slate-800">
            <div className="h-2 rounded bg-cyan-500" style={{ width: `${cutoff.progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-400">Applicable NAV depends on the applicable cut-off and funds-realisation conditions per AMFI/SEBI rules.</p>
        </section>

        {payload.tacticalAllocation.length > 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="font-semibold">Suggested Tactical Allocation</h2>
            <div className="mt-3 space-y-2 text-sm">
              {payload.tacticalAllocation.map((item) => (
                <div key={item.fundId} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2">
                  <span>{item.fundName}</span>
                  <span>{item.weightPercent.toFixed(1)}% · ₹{item.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="font-semibold">Settings / Config</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              Strategic Weight
              <input type="number" className="mt-1 w-full rounded bg-slate-800 p-2" value={settings.strategicWeight} onChange={(e) => setSettings((s) => ({ ...s, strategicWeight: Number(e.target.value) }))} />
            </label>
            <label className="text-sm">
              NAV Opportunity Weight
              <input type="number" className="mt-1 w-full rounded bg-slate-800 p-2" value={settings.navOpportunityWeight} onChange={(e) => setSettings((s) => ({ ...s, navOpportunityWeight: Number(e.target.value) }))} />
            </label>
            <label className="text-sm">
              Tactical Top-up (₹)
              <input type="number" className="mt-1 w-full rounded bg-slate-800 p-2" value={settings.tacticalTopupAmount ?? ""} onChange={(e) => setSettings((s) => ({ ...s, tacticalTopupAmount: e.target.value ? Number(e.target.value) : null }))} />
            </label>
            <label className="text-sm">
              Provider
              <select className="mt-1 w-full rounded bg-slate-800 p-2" value={settings.marketDataProvider} onChange={(e) => setSettings((s) => ({ ...s, marketDataProvider: e.target.value as SettingsPayload["marketDataProvider"] }))}>
                <option value="nse">nse</option>
                <option value="zerodha">zerodha</option>
                <option value="manual">manual</option>
              </select>
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="p-2 text-left">Fund Name</th>
                  <th className="p-2 text-left">AMFI Search</th>
                  <th className="p-2 text-left">Scheme Code</th>
                  <th className="p-2 text-left">Proxy Index</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.fundsConfig.map((fund) => (
                  <tr key={fund.id} className="border-t border-slate-800">
                    <td className="p-2"><input className="w-full rounded bg-slate-800 p-2" value={fund.name} onChange={(e) => updateFund(fund.id, "name", e.target.value)} /></td>
                    <td className="p-2"><input className="w-full rounded bg-slate-800 p-2" value={fund.schemeSearch} onChange={(e) => updateFund(fund.id, "schemeSearch", e.target.value)} /></td>
                    <td className="p-2"><input className="w-full rounded bg-slate-800 p-2" value={fund.schemeCode ?? ""} onChange={(e) => updateFund(fund.id, "schemeCode", e.target.value)} /></td>
                    <td className="p-2"><input className="w-full rounded bg-slate-800 p-2" value={fund.proxyIndex} onChange={(e) => updateFund(fund.id, "proxyIndex", e.target.value)} /></td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="rounded bg-rose-800 px-2 py-1"
                        onClick={() => setSettings((s) => ({ ...s, fundsConfig: s.fundsConfig.filter((f) => f.id !== fund.id) }))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded bg-slate-700 px-3 py-2 text-sm"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  fundsConfig: [
                    ...s.fundsConfig,
                    {
                      id: `fund-${Date.now()}`,
                      name: "New Fund",
                      schemeSearch: "",
                      schemeCode: "",
                      proxyIndex: "NIFTY 50",
                    },
                  ],
                }))
              }
            >
              Add Fund
            </button>
            <button
              type="button"
              className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              onClick={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>

        <footer className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">
          <p>This dashboard provides probability-based decision signals, not investment advice or a guaranteed NAV prediction.</p>
          <p>Today&apos;s market weakness is likely to be reflected in the fund&apos;s closing NAV.</p>
          <p>Applicable NAV depends on the applicable cut-off and funds-realisation conditions per AMFI/SEBI rules.</p>
          <p>Sector/proxy mapping is an approximation and not a substitute for the fund&apos;s actual portfolio holdings.</p>
          <p>Free/unofficial data sources may be delayed, incomplete, or temporarily unavailable.</p>
          <p className="mt-2 text-slate-400">Data attribution: NSE India (best-effort unofficial JSON endpoints), AMFI NAV publication feed, and fallback market data where available.</p>
        </footer>
      </div>
    </main>
  );
}
