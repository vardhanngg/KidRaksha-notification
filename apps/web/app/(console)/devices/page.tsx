"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { api } from "../../../lib/api";
import { useRealtimeRefresh } from "../../../lib/realtime/client";
import { ConfirmDialog, EmptyState, Icon, Toast, StatusDot } from "../../../components/ui/UI";

function formatDate(value:string|null|undefined){return value?new Date(value).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Not yet"}
function deviceStatus(d:any){return d.revoked_at?"revoked":d.status==="online"?"online":"offline"}

export default function DevicesPage(){
  const [devices,setDevices]=useState<any[]>([]); const [includeRevoked,setIncludeRevoked]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [renaming,setRenaming]=useState<any>(null); const [name,setName]=useState(""); const [saving,setSaving]=useState(false); const [revokeId,setRevokeId]=useState<string|null>(null); const [toast,setToast]=useState<{message:string;tone:"success"|"error"|"info"}|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await api(`/devices?includeRevoked=${includeRevoked?"1":"0"}`);setDevices(r.devices||[])}catch(e:any){setError(e.message||"Could not load devices.")}finally{setLoading(false)}},[includeRevoked]);
  useEffect(()=>{load()},[load]);
  useRealtimeRefresh(["device.paired","device.updated","device.revoked","device.sync.updated"], load);
  async function saveRename(){if(!renaming||!name.trim())return;setSaving(true);try{const r=await api(`/devices/${renaming.id}`,{method:"PATCH",body:JSON.stringify({name:name.trim()})});setDevices(v=>v.map(d=>d.id===renaming.id?r.device:{...d}));setRenaming(null);setToast({message:"Device name updated.",tone:"success"})}catch(e:any){setToast({message:e.message||"Could not rename device.",tone:"error"})}finally{setSaving(false)}}
  async function revoke(){if(!revokeId)return;setSaving(true);try{await api(`/devices/${revokeId}/revoke`,{method:"POST"});await load();setToast({message:"Device revoked. It can no longer upload notifications.",tone:"success"})}catch(e:any){setToast({message:e.message||"Could not revoke device.",tone:"error"})}finally{setSaving(false);setRevokeId(null)}}
  const active=devices.filter(d=>!d.revoked_at); const online=active.filter(d=>d.status==="online").length; const attention=active.filter(d=>d.sync_status==="error"||d.status==="offline").length;
  return <>
    <PageHeader eyebrow="Family devices" title="Devices" description="Pair Android phones, understand their connection state, and control sharing." actions={<Link className="btn accent" href="/onboarding"><Icon name="plus"/> Add child device</Link>}/>
    <section className="card deviceHero"><div><div className="eyebrow">Secure pairing</div><h2>Connect another Android phone</h2><p>Pairing links a device to this workspace. Notification Access and sharing remain explicit choices on the device.</p></div><Link className="btn accent" href="/onboarding">Open setup <Icon name="arrowRight" size={15}/></Link></section>
    {error&&<div className="error" style={{marginTop:14}}>{error} <button className="linkText" style={{border:0,background:"transparent",padding:0}} onClick={load}>Retry</button></div>}
    <section className="card" style={{marginTop:16,padding:"10px 13px"}}><div className="between"><div className="row"><span className="badge green"><StatusDot status="online"/> {online} online</span><span className="badge">{active.length} active</span>{attention>0&&<span className="badge warn">{attention} need attention</span>}</div><label className="row small muted"><input type="checkbox" checked={includeRevoked} onChange={e=>setIncludeRevoked(e.target.checked)}/> Show revoked</label></div></section>
    <section className="card deviceList" aria-live="polite">
      {loading?<div className="deviceEmpty"><div className="emptyIcon"><Icon name="refresh"/></div><p className="muted">Loading devices…</p></div>:devices.length?devices.map(d=>{const state=deviceStatus(d); const sync=d.sync_status;return <article className="deviceCard" key={d.id}>
        <div className="deviceIdentity"><div className="deviceAvatar">KR</div><div className="deviceCopy"><div className="deviceNameRow"><b>{d.name}</b><span className={`badge ${state==="online"?"green":state==="revoked"?"red":""}`}><StatusDot status={state==="online"?"online":state==="revoked"?"neutral":"offline"}/> {state[0].toUpperCase()+state.slice(1)}</span></div><p>{d.platform||"Android"} · {d.app_version||"Version unavailable"} · Added {formatDate(d.created_at)}</p></div></div>
        <div className="deviceStats"><div className="miniStat"><span>Sharing</span><b>{d.sharing_enabled?"On":"Off"}</b></div><div className="miniStat"><span>Sync</span><b>{sync==="error"?"Needs attention":sync==="pending"?`${d.pending_count||0} queued`:d.last_sync_at?formatDate(d.last_sync_at):"Not synced"}</b></div><div className="miniStat"><span>Last seen</span><b>{formatDate(d.last_seen_at)}</b></div></div>
        <div className="deviceActions">{d.revoked_at?<span className="badge red">Revoked {formatDate(d.revoked_at)}</span>:<><button className="btn ghost" onClick={()=>{setRenaming(d);setName(d.name)}}><Icon name="settings" size={14}/> Rename</button><button className="btn danger" onClick={()=>setRevokeId(d.id)}><Icon name="shield" size={14}/> Revoke</button></>}</div>
      </article>}) : <EmptyState icon="device" title="No child devices yet" body="Create a secure pairing code to connect the first Android phone to your family workspace." action={<Link className="btn accent" href="/onboarding">Start setup <Icon name="arrowRight" size={15}/></Link>}/>} 
    </section>

    <section className="card" style={{marginTop:16,padding:18}}><div className="between"><div><div className="panelTitle">What the device status means</div><div className="panelSubtitle">A quick guide to the indicators you see above.</div></div><Icon name="info" size={18}/></div><div className="deviceStats" style={{marginTop:13}}><div className="miniStat"><span>Online</span><b>Recent heartbeat received.</b></div><div className="miniStat"><span>Sync issue</span><b>Uploads need attention or are retrying.</b></div><div className="miniStat"><span>Sharing off</span><b>The child device is connected but not sharing.</b></div></div></section>

    <ConfirmDialog open={Boolean(revokeId)} title="Revoke this child device?" body="The device will immediately stop being allowed to upload notifications. You can pair it again later as a new device." confirmLabel="Revoke device" danger busy={saving} onCancel={()=>setRevokeId(null)} onConfirm={revoke}/>
    {renaming&&<div className="modalBackdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setRenaming(null)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="rename-title"><div className="modalIcon"><Icon name="settings"/></div><h2 id="rename-title">Rename device</h2><p>Choose a short name your family will recognize, such as “Arjun’s phone”.</p><div className="field"><label htmlFor="device-name">Device name</label><input id="device-name" className="input" value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoFocus/></div><div className="modalActions"><button className="btn ghost" onClick={()=>setRenaming(null)} disabled={saving}>Cancel</button><button className="btn accent" onClick={saveRename} disabled={saving||!name.trim()}>{saving?"Saving…":"Save name"}</button></div></div></div>}
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>} 
  </>;
}
