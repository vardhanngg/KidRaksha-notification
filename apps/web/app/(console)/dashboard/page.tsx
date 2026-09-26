
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function DashboardPage(){
  const [data,setData]=useState<any>(null);
  useEffect(()=>{api("/dashboard/summary").then(setData).catch(console.error)},[]);
  useEffect(()=>{
    const es=new EventSource("/api/events/stream");
    const refresh=()=>api("/dashboard/summary").then(setData).catch(()=>{}); es.addEventListener("notification",refresh); es.addEventListener("device.paired",refresh);
    return()=>es.close();
  },[]);
  if(!data) return <div>Loading dashboard…</div>;
  const c=data.counts||{},d=data.devices||{};
  return <>
    <div className="between pageTitle"><div><h1>Overview</h1><p>Your family's notification activity in one place.</p></div><Link className="btn accent" href="/devices">Add child device</Link></div>
    <div className="grid4" style={{marginTop:22}}>
      <Metric label="Notifications today" value={c.today||0} sub="last 24 hours"/>
      <Metric label="Unread" value={c.unread||0} sub="waiting for you"/>
      <Metric label="Stored" value={c.total||0} sub={`retention: ${data.plan?.plan?.retention||30} days`}/>
      <Metric label="Devices" value={d.online||0} sub={`${d.total||0} total devices`}/>
    </div>
    <div className="consoleGrid" style={{marginTop:18}}>
      <section className="card">
        <div className="between" style={{padding:"20px 20px 8px"}}><div><b>Latest notifications</b><div className="small muted">Updates appear here in real time.</div></div><Link href="/notifications" className="small" style={{color:"#6356df",fontWeight:800}}>View all</Link></div>
        <div className="notifList">{(data.latest||[]).length ? data.latest.map((n:any)=><NotificationRow key={n.id} n={n}/>):<Empty text="No notifications yet. Pair a device to get started."/>}</div>
      </section>
      <section className="stack">
        <div className="card" style={{padding:20}}>
          <span className="eyebrow">Plan</span>
          <h3 style={{margin:"8px 0 4px"}}>{data.plan?.plan?.name||"Trial"}</h3>
          <p className="muted small">Up to {data.plan?.plan?.devices||1} child device{(data.plan?.plan?.devices||1)>1?"s":""} · {data.plan?.plan?.retention||7} day retention</p>
          <Link className="btn ghost" href="/billing" style={{marginTop:12}}>Manage plan</Link>
        </div>
        <div className="darkCard" style={{padding:20,borderRadius:18}}>
          <span className="eyebrow" style={{color:"#b9adff"}}>Privacy by design</span>
          <p style={{lineHeight:1.65,color:"#aeb5c2",fontSize:14}}>Notification message content is encrypted at rest and the child device can stop sharing at any time.</p>
          <Link href="/settings" style={{color:"#fff",fontWeight:750,fontSize:13}}>Review settings →</Link>
        </div>
      </section>
    </div>
  </>;
}
function Metric({label,value,sub}:{label:string,value:any,sub:string}){return <div className="card metric"><div className="small muted">{label}</div><div className="n">{value}</div><div className="small muted">{sub}</div></div>}
function NotificationRow({n}:any){return <div className="notifRow"><div className="appIcon">{String(n.app_name||"?").slice(0,1)}</div><div style={{minWidth:0}}><div className="row" style={{gap:7}}><b style={{fontSize:14}}>{n.app_name}</b>{n.notification_type&&<span className="badge">{n.notification_type}</span>}</div><div className="small muted">{n.content_state === "withheld" ? "Message content is turned off" : (n.title||"Notification content unavailable")}</div><div className="small muted">{n.device_name}</div></div><div className="small muted">{new Date(n.received_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div></div>}
function Empty({text}:{text:string}){return <div style={{padding:28,textAlign:"center",color:"#858d9b"}}>{text}</div>}
