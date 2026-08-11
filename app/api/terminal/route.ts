import { NextResponse } from 'next/server';
import { funds } from '@/lib/funds';
import { market } from '@/lib/market';

export const dynamic = 'force-dynamic';

const pct = (a:number,b:number) => b ? ((a-b)/b)*100 : 0;
const clamp = (n:number) => Math.max(0, Math.min(100, n));

async function yahoo(ticker:string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=6mo&interval=1d`;
  const r = await fetch(url, {cache:'no-store', headers:{'User-Agent':'Mozilla/5.0'}});
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const result = j.chart?.result?.[0];
  const close = (result?.indicators?.quote?.[0]?.close || []).filter((x:any)=>typeof x==='number');
  const timestamps = result?.timestamp || [];
  if (close.length < 25) throw new Error('Insufficient market history');
  const last = close.at(-1) as number;
  return {
    value:last,
    daily:pct(last,close.at(-2) as number),
    weekly:pct(last,close.at(-6) as number),
    monthly:pct(last,close.at(-22) as number),
    quarter:pct(last,close.at(-63) as number),
    high52:Math.max(...close),
    low52:Math.min(...close),
    timestamp:timestamps.at(-1) || null,
  };
}

async function mfNav(code:string) {
  const r = await fetch(`https://api.mfapi.in/mf/${code}`, {cache:'no-store'});
  if (!r.ok) throw new Error(`MFAPI ${r.status}`);
  const j = await r.json();
  const rows = (j.data || []).map((x:any)=>({date:x.date,nav:Number(x.nav)}).filter((x:any)=>Number.isFinite(x.nav)));
  if (rows.length < 25) throw new Error('Insufficient NAV history');
  const nav = rows[0].nav;
  const prev = rows[1]?.nav ?? nav;
  const week = rows[Math.min(5,rows.length-1)].nav;
  const month = rows[Math.min(21,rows.length-1)].nav;
  const quarter = rows[Math.min(62,rows.length-1)].nav;
  const oneYear = rows[Math.min(251,rows.length-1)].nav;
  const recent = rows.slice(0,30).map((x:any)=>x.nav);
  const high30 = Math.max(...recent);
  const drawdown = pct(nav,high30);
  const daily = pct(nav,prev);
  const weekly = pct(nav,week);
  const monthly = pct(nav,month);
  const ret3m = pct(nav,quarter);
  const ret1y = pct(nav,oneYear);
  const mean20 = rows.slice(0,20).reduce((a:number,x:any)=>a+x.nav,0)/20;
  const mean50 = rows.slice(0,50).reduce((a:number,x:any)=>a+x.nav,0)/Math.min(50,rows.length);
  const trend = nav >= mean20 && mean20 >= mean50 ? 100 : nav >= mean20 ? 65 : 25;
  return {nav,date:rows[0].date,daily,weekly,monthly,ret3m,ret1y,drawdown,trend,sparkline:recent.reverse()};
}

export async function GET() {
  const [fundResults, marketResults] = await Promise.all([
    Promise.all(funds.map(async f => { try { return {fund:f, nav:await mfNav(f.code), error:null}; } catch(e) { return {fund:f, nav:null, error:e instanceof Error?e.message:'NAV unavailable'}; }})),
    Promise.all(market.map(async m => { try { return {market:m, data:await yahoo(m.ticker), error:null}; } catch(e) { return {market:m, data:null, error:e instanceof Error?e.message:'Market unavailable'}; }})),
  ]);

  const marketRows = marketResults.filter(x=>x.data).map(x=>({ ...x.market, ...x.data }));
  const marketMap = new Map(marketRows.map(x=>[x.key,x]));
  const equity = fundResults.filter(x=>x.nav).map(x=>{
    const m:any = marketMap.get(x.fund.proxy);
    const n:any = x.nav;
    const marketWeakness = m ? clamp(50 - m.monthly*8) : 50;
    const opportunity = clamp(50 + (-n.monthly*5) + (-n.drawdown*1.5));
    const momentum = clamp(50 + n.trend*.35 + n.ret3m*.9);
    const strategic = clamp(55 + n.ret1y*.8 + n.trend*.25 - Math.max(0,n.drawdown)*.6);
    const relative = clamp(marketWeakness*0.5 + opportunity*0.5);
    const score = clamp(strategic*.4 + relative*.25 + Math.min(100,Math.max(0,-n.drawdown*8+45))*.15 + n.trend*.1 + momentum*.1);
    const structural = n.trend < 35 || (m && m.monthly < -8 && n.monthly < -12);
    const correction = !!m && m.monthly < -2 && !structural && n.trend >= 60;
    const action = structural ? 'WAIT / AVOID' : score >= 72 ? 'BUY ON DIP' : score >= 62 ? 'ACCUMULATE' : score >= 52 ? 'WATCH' : 'WAIT';
    return { ...x.fund, ...n, proxyReturn:m?.monthly ?? null, proxyDaily:m?.daily ?? null, score:Math.round(score), strategic:Math.round(strategic), action, state:structural?'STRUCTURAL WEAKNESS':correction?'HEALTHY CORRECTION':'NEUTRAL'};
  }).sort((a,b)=>b.score-a.score);

  const fallers = [...marketRows].sort((a:any,b:any)=>a.daily-b.daily);
  const sectors = marketRows.filter(x=>x.group==='SECTOR').sort((a:any,b:any)=>a.daily-b.daily);
  const regimeDaily = marketRows.filter(x=>x.group==='INDEX').reduce((a:any,x:any)=>a+x.daily,0)/(marketRows.filter(x=>x.group==='INDEX').length||1);
  const regime = regimeDaily <= -1.2 ? 'RISK-OFF / CORRECTION' : regimeDaily >= 1.2 ? 'RISK-ON' : 'MIXED / NEUTRAL';

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    fundCount:funds.length,
    marketCount:marketRows.length,
    regime,
    regimeDaily,
    top5:equity.slice(0,5),
    funds:equity,
    market:marketRows,
    fallers:fallers.slice(0,8),
    sectors,
    errors:{funds:fundResults.filter(x=>x.error).map(x=>({code:x.fund.code,name:x.fund.name,error:x.error})),market:marketResults.filter(x=>x.error).map(x=>({key:x.market.key,name:x.market.label,error:x.error}))}
  },{headers:{'Cache-Control':'no-store'}});
}
