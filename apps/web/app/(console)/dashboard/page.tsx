"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import PageHeader from "../../../components/PageHeader";
import { EmptyState, Icon, Skeleton, StatusDot } from "../../../components/ui/UI";
import { useRealtimeRefresh } from "../../../lib/realtime/client";

function relativeTime(value:string|undefined|null){
  if(!value)return "—";
  const diff=Math.max(0,Date.now()-new Date(value).getTime());
  const mins=Math.floor(diff/60000);
  if(mins<1)return "Just now";
  if(mins<60)return `${mins}m ago`;
  const hrs=Math.floor(mins/60);
  if(hrs<24)return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}
function deviceStatus(lastSeen:string|null|undefined,revoked?:string|null){
  if(revoked)return "offline" as const;
  if(!lastSeen)return "offline" as const;
  return Date.now()-new Date(lastSeen).getTime()<30*60*1000?"online" as const:"offline" as const;
}

export default function DashboardPage(){
  const [data,setData]=useState<any>(null); const [devices,setDevices]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const load=useCallback(async()=>{
    setError("");
    try{const [summary,deviceData]=await Promise.all([api("/dashboard/summary"),api("/devices")]);setData(summary);setDevices(deviceData.devices||[])}
    catch(e:any){setError(e.message||"We could not load your workspace.")}
    finally{setLoading(false)}
  },[]);
  useEffect(()=>{load()},[load]);
  useRealtimeRefresh(["notification","notification.read","notification.unread","notifications.read-all","notifications.bulk-read","notification.deleted","notifications.bulk-deleted","device.paired","device.updated","device.revoked","device.sync.updated"], load);

  if(loading)return <><PageHeader eyebrow="Family workspace" title="Overview" description="A clear view of your child's shared notification activity."/><div className="statsGrid"><Skeleton className="box"/><Skeleton className="box"/><Skeleton className="box"/><Skeleton className="box"/></div><div className="twoCol"><div className="card"><div className="panelHeader"><Skeleton className="title"/></div>{Array.from({length:5}).map((_,i)=><div className="notificationItem" key={i}><Skeleton className="box"/><div><Skeleton className="title"/><div style={{height:8}}/><Skeleton className="text"/></div></div>)}</div><div className="sideStack"><Skeleton className="box"/><Skeleton className="box"/></div></div></>;

  const c=data?.counts||{}; const plan=data?.plan?.plan||{}; const online=devices.filter(d=>d.status==="online").length; const needsAttention=devices.filter(d=>d.sync_status==="error"||d.status==="offline").length;
  return <>
    <PageHeader eyebrow="Family workspace" title="Overview" description="A calm, at-a-glance view of the notifications your family has chosen to share." actions={<Link className="btn accent" href="/onboarding"><Icon name="plus" size={17}/> Add child device</Link>}/>
    {error&&<div className="error" style={{marginTop:18}}>{error} <button className="linkText" style={{border:0,background:"transparent",padding:0}} onClick={load}>Try again</button></div>}

    <section className="heroWelcome">
      <div style={{position:"relative",zIndex:1}}><div className="eyebrow">Today</div><h2>{c.total?"Your family dashboard is up to date.":"Set up your first child device."}</h2><p>{c.total?`${c.today||0} notifications arrived in the last 24 hours and ${c.unread||0} are still unread.`:"Pair an Android phone to begin receiving shared notifications here. The child device remains in control of access and sharing."}</p></div>
      {c.total?<Link href="/notifications" className="btn ghost" style={{position:"relative",zIndex:1,color:"#fff",borderColor:"#424956"}}>Open inbox <Icon name="arrowRight" size={16}/></Link>:<Link href="/onboarding" className="btn accent" style={{position:"relative",zIndex:1}}>Start setup <Icon name="arrowRight" size={16}/></Link>}
    </section>

    <section className="statsGrid" aria-label="Workspace summary">
      <Stat icon="bell" label="Notifications today" value={Number(c.today||0).toLocaleString()} foot="Last 24 hours"/>
      <Stat icon="eye" label="Unread" value={Number(c.unread||0).toLocaleString()} foot={c.unread?"Needs your attention":"All caught up"}/>
      <Stat icon="clock" label="Retention" value={`${plan.retention||data?.plan?.retention||7}d`} foot={`${plan.name||"Current plan"} coverage`}/>
      <Stat icon="device" label="Connected devices" value={String(online)} foot={`${devices.length} total · ${needsAttention?`${needsAttention} need attention`:"All healthy"}`}/>
    </section>

    <section className="twoCol">
      <section className="card">
        <div className="panelHeader"><div><div className="panelTitle">Latest notifications</div><div className="panelSubtitle">New activity appears here as it arrives.</div></div><Link href="/notifications" className="linkText">View inbox <Icon name="arrowRight" size={14}/></Link></div>
        <div className="notificationList">{(data?.latest||[]).length?(data.latest.map((n:any)=><Link className="notificationItem" href={`/notifications?selected=${n.id}`} key={n.id}><div className="appIcon">{String(n.app_name||"?").slice(0,1).toUpperCase()}</div><div style={{minWidth:0}}><h4>{n.app_name||"Unknown app"}{n.notification_type&&<span className="badge" style={{marginLeft:6}}>{n.notification_type}</span>}</h4><p>{n.content_state==="withheld"?"Message content sharing is off on this device.":(n.title||"Notification content unavailable")}</p><div className="inboxMeta">{n.device_name||"Child device"} · {relativeTime(n.received_at)}</div></div><span className="notificationTime">{new Date(n.received_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></Link>)):<EmptyState icon="bell" title="No notifications yet" body="Pair a child device and turn on sharing to see the first notification here." action={<Link className="btn accent" href="/onboarding">Add child device</Link>}/>}</div>
      </section>

      <div className="sideStack">
        <section className="card summaryCard"><div className="between"><div><div className="panelTitle">Device health</div><div className="panelSubtitle">Last known connection state.</div></div><Link href="/devices" className="linkText">Manage</Link></div><div style={{marginTop:9}}>{devices.length?devices.slice(0,4).map((d:any)=><div className="healthRow" key={d.id}><div className="deviceMini"><div className="deviceMiniIcon"><Icon name="device" size={16}/></div><div><b>{d.name}</b><span>{d.sync_status==="error"?"Sync needs attention":d.last_seen_at?`Last seen ${relativeTime(d.last_seen_at)}`:"Not connected yet"}</span></div></div><div className="row" style={{gap:6}}><StatusDot status={deviceStatus(d.last_seen_at,d.revoked_at)}/><span className="small muted">{d.status==="online"?"Online":"Offline"}</span></div></div>):<EmptyState icon="device" title="No devices" body="Your first child phone will appear here after pairing." action={<Link className="btn ghost" href="/onboarding">Set up device</Link>}/>}</div></section>
        <section className="card summaryCard noticeCard"><div className="eyebrow">Privacy by design</div><h3>Sharing stays visible.</h3><p>KidRaksha only receives data after Notification Access and sharing are enabled on the child device. Message content is stored encrypted.</p><Link className="btn ghost" href="/privacy">Review privacy <Icon name="arrowRight" size={14}/></Link></section>
        <section className="card summaryCard"><div className="between"><div><div className="panelTitle">Plan</div><div className="panelSubtitle">{plan.name||"Trial"}</div></div><Link href="/billing" className="linkText">Manage</Link></div><h3 style={{marginTop:16}}>{plan.name||"Trial"}</h3><p>Up to {plan.devices||1} child device{(plan.devices||1)>1?"s":""} · {plan.retention||7} days notification retention.</p></section>
      </div>
    </section>
  </>;
}
function Stat({icon,label,value,foot}:{icon:string;label:string;value:string;foot:string}){return <div className="card statCard"><div className="statHead"><span>{label}</span><span className="statIcon"><Icon name={icon} size={17}/></span></div><div className="statValue">{value}</div><div className="statFoot">{foot}</div></div>}
