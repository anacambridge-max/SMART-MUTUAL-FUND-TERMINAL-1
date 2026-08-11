'use client';

import {useEffect,useMemo,useState} from 'react';

type Row={name:string;code:string;category:string;proxyLabel:string;nav:number;date:string;daily:number;weekly:number;monthly:number;ret3m:number;ret1y:number;drawdown:number;trend:number;score:number;strategic:number;action:string;state:string;proxyReturn:number|null;proxyDaily:number|null};
type Market={key:string;label:string;group:string;daily:number;weekly:number;monthly:number;quarter:number;value:number};
const pct=(n:number|null)=>n==null?'—':`${n>=0?'+':''}${n.toFixed(2)}%`;
const tone=(n:number)=>n>=0?'up':'down';

export default function Page(){
 const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [tab,setTab]=useState('RADAR'); const [refreshing,setRefreshing]=useState(false);
 const load=async()=>{setRefreshing(true);try{const r=await fetch('/api/terminal?ts='+Date.now(),{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Data unavailable');setData(j);setError('')}catch(e){setError(e instanceof Error?e.message:'Data unavailable')}finally{setLoading(false);setRefreshing(false)}};
 useEffect(()=>{load(); const id=setInterval(load,15*60*1000); return()=>clearInterval(id)},[]);
 const top5:Row[]=data?.top5||[]; const funds:Row[]=data?.funds||[]; const sectors:Market[]=data?.sectors||[]; const fallers:Market[]=data?.fallers||[];
 const buyCount=useMemo(()=>funds.filter((x:Row)=>x.action==='BUY ON DIP'||x.action==='ACCUMULATE').length,[funds]);
 return <main>
  <header className="topbar"><div className="brand"><div className="logo">MF</div><div><div className="eyebrow">SMART MUTUAL FUND</div><h1>Decision Terminal</h1></div></div><div className="headRight"><span className="live"><i/> LIVE ENGINE</span><button onClick={load} disabled={refreshing}>{refreshing?'Refreshing…':'↻ Refresh'}</button></div></header>
  <div className="shell">
   <div className="subhead"><div><span className="pill">STANDALONE PROJECT</span><span className="muted"> Fixed universe • 19 funds only</span></div><div className="timestamp">{data?.generatedAt?`Updated ${new Date(data.generatedAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}`:'Loading live data…'}</div></div>
   <nav>{[['RADAR','Daily Radar'],['FUNDS','19 Funds'],['MARKET','Market & Sectors']].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</nav>
   {error&&<div className="alert">⚠ {error}</div>}
   {loading?<Loading/>:<>
    <section className="regime"><div><div className="label">TODAY'S MARKET REGIME</div><div className="regimeTitle">{data?.regime||'—'}</div><div className="muted">Broad index average today <b className={tone(data?.regimeDaily||0)}>{pct(data?.regimeDaily)}</b></div></div><div className="regimeStats"><div><span>Universe</span><b>{data?.fundCount||19}</b></div><div><span>Buy / Accumulate</span><b>{buyCount}</b></div><div><span>Top Opportunity</span><b>{top5[0]?.score??'—'}</b></div></div></section>
    {tab==='RADAR'&&<>
      <section className="grid2"><div className="panel"><div className="panelHead"><div><div className="label">MARKET WEAKNESS</div><h2>Biggest fallers today</h2></div><span className="smallTag">DAILY</span></div><div className="rows">{fallers.slice(0,6).map((m:Market,i)=><div className="marketRow" key={m.key}><span className="rank">{i+1}</span><div className="grow"><b>{m.label}</b><small>{m.group}</small></div><strong className="down">{pct(m.daily)}</strong></div>)}</div></div>
      <div className="panel"><div className="panelHead"><div><div className="label">SECTOR HEAT</div><h2>Weakness worth investigating</h2></div><span className="smallTag">PROXY</span></div><div className="rows">{sectors.slice(0,6).map((m:Market)=><div className="marketRow" key={m.key}><div className="grow"><b>{m.label}</b><small>Daily {pct(m.daily)} • 1M {pct(m.monthly)}</small></div><span className={m.daily<0?'down':'up'}>{m.daily<0?'WEAK':'STRONG'}</span></div>)}</div></div></section>
      <section className="sectionTitle"><div><div className="label">DECISION ENGINE</div><h2>TOP 5 TODAY</h2><p>Only the fixed 19-fund universe can appear here. Market weakness is cross-checked against each fund's own trend and drawdown.</p></div><span className="scoreLegend">40% Strategic • 25% Market • 15% Drawdown • 10% Trend • 10% Momentum</span></section>
      <div className="topGrid">{top5.map((r:Row,i)=><Opportunity key={r.code} r={r} rank={i+1}/>)}</div>
      <section className="method"><div><div className="label">SIGNAL LOGIC</div><h2>Healthy correction ≠ automatic buy</h2><p><span className="greenDot"/> <b>Healthy Correction:</b> market proxy is weak but the fund trend remains healthy.</p><p><span className="redDot"/> <b>Structural Weakness:</b> fund trend is already weak or fund and proxy are falling together aggressively.</p></div><div className="methodBox"><b>BUY ON DIP</b><span>High opportunity score + acceptable trend</span><b>ACCUMULATE</b><span>Good setup, but confirmation is still preferred</span><b>WAIT / AVOID</b><span>Structural weakness overrides the fall</span></div></section>
    </>}
    {tab==='FUNDS'&&<FundTable funds={funds}/>} 
    {tab==='MARKET'&&<MarketTable market={data?.market||[]}/>} 
   </>}
   <footer>Standalone Smart MF Decision Terminal • 19-fund fixed universe • Rule-based decision support • Not investment advice</footer>
  </div>
 </main>
}

function Opportunity({r,rank}:{r:Row;rank:number}){return <article className="opp"><div className="oppTop"><span className="rankBig">#{rank}</span><span className={`action ${r.action.includes('BUY')?'buy':r.action.includes('ACCUMULATE')?'acc':''}`}>{r.action}</span></div><h3>{r.name}</h3><div className="category">{r.category} • {r.proxyLabel}</div><div className="scoreLine"><div><span>Opportunity Score</span><strong>{r.score}</strong></div><div className="bar"><i style={{width:`${r.score}%`}}/></div></div><div className="metrics"><div><span>Market</span><b className={tone(r.proxyReturn||0)}>{pct(r.proxyReturn)}</b></div><div><span>Fund 1M</span><b className={tone(r.monthly)}>{pct(r.monthly)}</b></div><div><span>Drawdown</span><b className="down">{pct(r.drawdown)}</b></div><div><span>Trend</span><b>{Math.round(r.trend)}</b></div></div><div className={`state ${r.state==='HEALTHY CORRECTION'?'healthy':r.state==='STRUCTURAL WEAKNESS'?'structural':''}`}>{r.state}</div></article>}

function FundTable({funds}:{funds:Row[]}){return <section className="panel tablePanel"><div className="panelHead"><div><div className="label">FIXED UNIVERSE</div><h2>All 19 Mutual Funds</h2></div><span className="smallTag">NO OTHER FUNDS</span></div><div className="tableWrap"><table><thead><tr><th>Fund</th><th>Category</th><th>Market Proxy</th><th>1D</th><th>1W</th><th>1M</th><th>3M</th><th>1Y</th><th>DD</th><th>Trend</th><th>Score</th><th>Action</th></tr></thead><tbody>{funds.map(r=><tr key={r.code}><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.category}</td><td>{r.proxyLabel}</td><td className={tone(r.daily)}>{pct(r.daily)}</td><td className={tone(r.weekly)}>{pct(r.weekly)}</td><td className={tone(r.monthly)}>{pct(r.monthly)}</td><td className={tone(r.ret3m)}>{pct(r.ret3m)}</td><td className={tone(r.ret1y)}>{pct(r.ret1y)}</td><td className="down">{pct(r.drawdown)}</td><td>{Math.round(r.trend)}</td><td><strong className="score">{r.score}</strong></td><td><span className="action mini">{r.action}</span></td></tr>)}</tbody></table></div></section>}
function MarketTable({market}:{market:Market[]}){return <section className="panel tablePanel"><div className="panelHead"><div><div className="label">LIVE CONTEXT</div><h2>Indices & Sector Proxies</h2></div></div><div className="tableWrap"><table><thead><tr><th>Instrument</th><th>Group</th><th>Value</th><th>1D</th><th>1W</th><th>1M</th><th>Quarter</th></tr></thead><tbody>{market.map(m=><tr key={m.key}><td><b>{m.label}</b></td><td>{m.group}</td><td>{m.value?.toLocaleString('en-IN',{maximumFractionDigits:2})}</td><td className={tone(m.daily)}>{pct(m.daily)}</td><td className={tone(m.weekly)}>{pct(m.weekly)}</td><td className={tone(m.monthly)}>{pct(m.monthly)}</td><td className={tone(m.quarter)}>{pct(m.quarter)}</td></tr>)}</tbody></table></div></section>}
function Loading(){return <><div className="skeleton heroSk"/><div className="grid2"><div className="skeleton boxSk"/><div className="skeleton boxSk"/></div><div className="skeleton largeSk"/></>}
