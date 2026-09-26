
"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function DevicesPage(){
  const [devices,setDevices]=useState<any[]>([]);const [code,setCode]=useState("");const [expires,setExpires]=useState(0);const [busy,setBusy]=useState(false);
  async function load(){const r=await api("/devices");setDevices(r.devices||[])}
  useEffect(()=>{load()},[]);
  async function createCode(){setBusy(true);try{const r=await api("/devices/pairing-codes",{method:"POST"});setCode(r.code);setExpires(Math.round(r.expiresInSeconds/60))}catch(e:any){alert(e.message)}finally{setBusy(false)}}
  async function revoke(id:string){if(!confirm("Revoke this device? It will stop accepting notification uploads."))return;await api(`/devices/${id}/revoke`,{method:"POST"});load()}
  return <>
    <div className="pageTitle"><h1>Devices</h1><p>Pair and manage the Android devices connected to your family.</p></div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,.9fr) minmax(0,1.1fr)",gap:18,marginTop:20}}>
      <div className="pairBox"><span className="eyebrow" style={{color:"#bfb5ff"}}>Add a child device</span><h2 style={{margin:"8px 0 5px"}}>Create a secure pairing code.</h2><p style={{color:"#b1b5c2",lineHeight:1.6,fontSize:14}}>The code expires after 10 minutes and can be used once.</p>{code?<><div className="pairCode">{code}</div><div className="row"><button className="btn accent" onClick={()=>navigator.clipboard?.writeText(code)}>Copy code</button><span className="small" style={{color:"#b1b5c2"}}>Valid for about {expires} min</span></div></>:<button className="btn accent" onClick={createCode} disabled={busy}>{busy?"Creating…":"Generate pairing code"}</button>}</div>
      <section className="card">{devices.length?devices.map(d=><div className="device" key={d.id}><div className="row"><div className={"dot "+(d.last_seen_at && Date.now()-new Date(d.last_seen_at).getTime()<180000?"online":"")}></div><div><b>{d.name}</b><div className="small muted">{d.platform} · {d.app_version||"version unknown"}</div><div className="small muted">{d.last_seen_at?`Last seen ${new Date(d.last_seen_at).toLocaleString()}`:"Never checked in"}</div><div className="small muted">{d.content_sharing_enabled?"Message content shared":"Message content not shared"}</div></div></div><button className="btn danger" onClick={()=>revoke(d.id)}>Revoke</button></div>):<div style={{padding:40,textAlign:"center"}}><b>No child devices yet</b><p className="muted small">Generate a code and enter it in the LittleWatch child app.</p></div>}</section>
    </div>
  </>;
}
