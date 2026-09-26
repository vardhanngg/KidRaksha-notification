
"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function NotificationsPage(){
  const [items,setItems]=useState<any[]>([]); const [search,setSearch]=useState(""); const [unread,setUnread]=useState(false); const [selected,setSelected]=useState<any>(null); const [busy,setBusy]=useState(false);
  async function load(){setBusy(true);try{const r=await api(`/notifications?limit=100&search=${encodeURIComponent(search)}&unread=${unread?"1":"0"}`);setItems(r.items||[]);if(selected) setSelected((r.items||[]).find((x:any)=>x.id===selected.id)||null)}finally{setBusy(false)}}
  useEffect(()=>{load()},[unread]); // deliberate: search submits manually
  useEffect(()=>{const es=new EventSource("/api/events/stream");es.addEventListener("notification",()=>load());return()=>es.close()},[]);
  async function markRead(id:number){await api(`/notifications/${id}/read`,{method:"POST"});setItems(v=>v.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));setSelected((s:any)=>s?.id===id?{...s,read_at:new Date().toISOString()}:s)}
  async function deleteItem(id:number){await api(`/notifications/${id}`,{method:"DELETE"});setItems(v=>v.filter(x=>x.id!==id));setSelected(null)}
  async function allRead(){await api("/notifications/read-all",{method:"POST"});setItems(v=>v.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})))}
  return <>
    <div className="between pageTitle"><div><h1>Notifications</h1><p>Shared notifications from paired child devices.</p></div><button className="btn ghost" onClick={allRead}>Mark all read</button></div>
    <div className="card" style={{padding:14,marginTop:20}}>
      <div className="tableActions"><input className="input" style={{maxWidth:380}} placeholder="Search app name…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/><label className="row small"><input type="checkbox" checked={unread} onChange={e=>setUnread(e.target.checked)}/> Unread only</label><button className="btn primary" onClick={load}>{busy?"Loading…":"Search"}</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.15fr .85fr",gap:18,marginTop:18}}>
      <section className="card">{items.length?items.map(n=><button key={n.id} onClick={()=>{setSelected(n);if(!n.read_at)markRead(n.id)}} style={{display:"block",width:"100%",textAlign:"left",background:n.id===selected?.id?"#f5f3ff":"#fff",border:0,borderBottom:"1px solid #edf0f4",padding:16,cursor:"pointer"}}><div className="row"><div className="appIcon">{n.app_name.slice(0,1)}</div><div style={{minWidth:0,flex:1}}><div className="between"><b>{n.app_name}</b>{!n.read_at&&<span className="badge green">New</span>}</div><div style={{fontSize:13,marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.title||"Notification content unavailable"}</div><div className="small muted" style={{marginTop:4}}>{n.device_name} · {new Date(n.received_at).toLocaleString()}</div></div></div></button>):<div style={{padding:35,textAlign:"center"}} className="muted">No notifications match your filters.</div>}</section>
      <section className="card" style={{padding:22,minHeight:400}}>
        {selected?<><div className="between"><div><span className="eyebrow">Notification</span><h2 style={{margin:"7px 0 3px",fontSize:24}}>{selected.app_name}</h2><div className="small muted">{selected.device_name} · {new Date(selected.received_at).toLocaleString()}</div></div><button className="btn danger" onClick={()=>deleteItem(selected.id)}>Delete</button></div><div style={{marginTop:28,paddingTop:20,borderTop:"1px solid #edf0f4"}}><div style={{fontWeight:800,fontSize:16}}>{selected.title||"No title available"}</div><p style={{lineHeight:1.75,color:"#596273",whiteSpace:"pre-wrap"}}>{selected.body||"Message content was not shared by this device, or Android did not expose it."}</p></div></>:<div style={{height:350,display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:44}}>⌁</div><b>Select a notification</b><p className="muted small">Choose one from the list to see its details.</p></div></div>}
      </section>
    </div>
  </>;
}
