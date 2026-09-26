"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

function isOnline(lastSeen:string|null|undefined){
  return !!lastSeen && Date.now()-new Date(lastSeen).getTime()<5*60*1000;
}

export default function DevicesPage(){
  const [devices,setDevices]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    try{const r=await api("/devices");setDevices(r.devices||[])}catch(e:any){setError(e.message||"Could not load devices.")}
  }
  useEffect(()=>{load();const es=new EventSource("/api/events/stream");const refresh=()=>load();es.addEventListener("device.paired",refresh);return()=>es.close()},[]);

  async function create(){window.location.href="/onboarding"}

  async function rename(device:any){
    const value=window.prompt("New device name",device.name);
    if(value===null || !value.trim() || value.trim()===device.name) return;
    try{await api(`/devices/${device.id}/rename`,{method:"POST",body:JSON.stringify({name:value.trim()})});await load()}
    catch(e:any){setError(e.message||"Could not rename device.")}
  }

  async function revoke(id:string){
    if(!confirm("Revoke this device? It will immediately stop accepting notification uploads.")) return;
    setBusy(true);setError("");
    try{await api(`/devices/${id}/revoke`,{method:"POST"});await load()}
    catch(e:any){setError(e.message||"Could not revoke device.")}
    finally{setBusy(false)}
  }

  return <>
    <div className="between pageTitle"><div><h1>Devices</h1><p>Connect and manage the Android phones in your family workspace.</p></div><button className="btn accent" onClick={create}>Add child device</button></div>
    {error&&<div className="error" style={{marginTop:16}}>{error}</div>}

    <section className="card deviceIntro" style={{marginTop:20}}>
      <div><span className="eyebrow">Secure pairing</span><h2>Connect another Android phone</h2><p className="muted">A 10-minute one-time code links the device to this account. Pairing alone does not enable notification sharing.</p></div>
      <Link className="btn primary" href="/onboarding">Open setup</Link>
    </section>

    <section className="card" style={{marginTop:18}}>
      {devices.length ? devices.map((d:any)=>{
        const online=isOnline(d.last_seen_at);
        return <div className="device" key={d.id}>
          <div className="deviceMain"><div className={"deviceLogo "+(online?"online":"")}>KR</div><div><div className="row"><b>{d.name}</b><span className={"badge "+(online?"green":"")}>{online?"Online":"Offline"}</span></div><div className="small muted">Android · {d.app_version||"version unknown"}</div><div className="small muted">{d.last_seen_at?`Last seen ${new Date(d.last_seen_at).toLocaleString()}`:"Not checked in yet"}</div></div></div>
          <div className="deviceDetails"><span className={"sharingPill "+(d.sharing_enabled?"on":"")}>{d.sharing_enabled?"Sharing on":"Sharing off"}</span><span className="small muted">{d.content_sharing_enabled?"Message content enabled":"Message content off"}</span></div>
          <div className="tableActions"><button className="btn ghost" onClick={()=>rename(d)}>Rename</button><button className="btn danger" disabled={busy} onClick={()=>revoke(d.id)}>Revoke</button></div>
        </div>
      }) : <div className="deviceEmpty"><div className="setupCheck">+</div><h3>No child devices yet</h3><p className="muted">Create a pairing code to connect your first Android phone.</p><Link href="/onboarding" className="btn accent">Start setup</Link></div>}
    </section>
  </>;
}
