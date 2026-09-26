"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function SettingsPage(){
  const router=useRouter();
  const [retention,setRetention]=useState(30); const [maxRetention,setMaxRetention]=useState(90); const [saved,setSaved]=useState(false); const [user,setUser]=useState<any>(null); const [deleting,setDeleting]=useState(false);
  useEffect(()=>{api("/settings").then(r=>{setRetention(r.retentionDays);setMaxRetention(r.subscription?.plan?.retention||90)});api("/auth/session").then(r=>setUser(r.user))},[]);
  async function save(){await api("/settings",{method:"PATCH",body:JSON.stringify({retentionDays:retention})});setSaved(true);setTimeout(()=>setSaved(false),2500)}
  async function exportData(){const data=await api("/account/export");const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="kidraksha-data-export.json";a.click();URL.revokeObjectURL(url)}
  async function deleteAccount(){const confirmation=prompt('This permanently deletes the KidRaksha account and stored notification data. Type DELETE to continue.');if(confirmation!=="DELETE")return;setDeleting(true);try{await api("/account",{method:"DELETE",body:JSON.stringify({confirmation})});router.replace("/");router.refresh()}catch(e:any){alert(e.message)}finally{setDeleting(false)}}
  return <>
    <div className="pageTitle"><h1>Settings</h1><p>Account, privacy and notification-data controls.</p></div>
    <div className="stack" style={{marginTop:20,maxWidth:840}}>
      <section className="card" style={{padding:22}}><span className="eyebrow">Account</span><h3 style={{margin:"8px 0 4px"}}>{user?.displayName||"Parent account"}</h3><p className="small muted">{user?.email||"Loading…"}</p></section>
      <section className="card" style={{padding:22}}><span className="eyebrow">Data retention</span><h3 style={{margin:"8px 0"}}>Keep notification history for</h3><p className="muted small">Older notification records are permanently removed by the scheduled retention job.</p><select className="input" value={retention} onChange={e=>setRetention(Number(e.target.value))}><option value={7}>7 days</option>{maxRetention>=30&&<option value={30}>30 days</option>}{maxRetention>=60&&<option value={60}>60 days</option>}{maxRetention>=90&&<option value={90}>90 days</option>}</select><div className="row" style={{marginTop:14}}><button className="btn primary" onClick={save}>Save settings</button>{saved&&<span className="success">Saved</span>}</div></section>
      <section className="card" style={{padding:22}}><span className="eyebrow">Child-device transparency</span><div className="switchRow"><div><b>Notification Access</b><div className="small muted">The Android user controls this permission in system settings.</div></div><span className="badge">User controlled</span></div><div className="switchRow"><div><b>Message content</b><div className="small muted">Shared only after an explicit choice on the child device, then stored encrypted.</div></div><span className="badge green">Encrypted at rest</span></div><div className="switchRow"><div><b>Persistent status</b><div className="small muted">The child device keeps a visible KidRaksha status while sharing is active.</div></div><span className="badge">Visible</span></div></section>
      <section className="card dangerZone" style={{padding:22}}><span className="eyebrow">Your data</span><h3 style={{margin:"8px 0 4px"}}>Export or delete your account</h3><p className="muted small">Export your account and notification records as JSON, or permanently delete the account and associated data.</p><div className="row" style={{marginTop:14,flexWrap:"wrap"}}><button className="btn ghost" onClick={exportData}>Download my data</button><button className="btn danger" onClick={deleteAccount} disabled={deleting}>{deleting?"Deleting…":"Delete account"}</button></div></section>
    </div>
  </>;
}
