"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Onboarding(){
  const [code,setCode]=useState(""); const [minutes,setMinutes]=useState(0); const [busy,setBusy]=useState(false); const [paired,setPaired]=useState(false); const [error,setError]=useState(""); const [issuedAt,setIssuedAt]=useState("");

  async function generate(){
    setBusy(true); setError("");
    try{const r=await api("/devices/pairing-codes",{method:"POST"}); setCode(r.code); setMinutes(Math.round(r.expiresInSeconds/60)); setIssuedAt(r.issuedAt);}
    catch(e:any){setError(e.message||"Could not create a pairing code.");}
    finally{setBusy(false);}
  }

  useEffect(()=>{
    if(!code) return;
    let stopped=false;
    const check=async()=>{try{const r=await api("/devices"); const fresh=(r.devices||[]).some((d:any)=>issuedAt && new Date(d.created_at).getTime() >= new Date(issuedAt).getTime()); if(!stopped && fresh){setPaired(true)}}catch{}};
    check(); const timer=setInterval(check,3000);
    return()=>{stopped=true;clearInterval(timer)};
  },[code]);

  if(paired) return <main className="authPage"><div className="authCard setupCard"><div className="setupCheck">✓</div><div className="authKicker">Device connected</div><h1>Your first device is ready.</h1><p className="muted">LittleWatch is waiting for notifications from the paired Android device.</p><Link href="/dashboard" className="btn accent" style={{marginTop:20,width:"100%"}}>Open dashboard</Link></div></main>;

  return <main className="authPage"><div className="authCard setupCard">
    <div className="stepDots"><span className="active"></span><span className={code?"active":""}></span><span className={paired?"active":""}></span></div>
    <div className="authKicker">Set up your family workspace</div>
    <h1>Connect your first child device.</h1>
    <p className="muted">Generate a one-time code here, then enter it in the LittleWatch app installed on the Android device.</p>
    {error&&<div className="error" style={{marginTop:16}}>{error}</div>}
    {!code ? <button className="btn accent" style={{width:"100%",marginTop:20}} disabled={busy} onClick={generate}>{busy?"Creating secure code…":"Generate pairing code"}</button> : <>
      <div className="pairCode onLight">{code}</div>
      <div className="setupWaiting"><span className="pulse"></span><div><b>Waiting for the device</b><div className="small muted">Enter the code on the child device. This page checks automatically.</div></div></div>
      <div className="row" style={{marginTop:14}}><button className="btn primary" onClick={()=>navigator.clipboard?.writeText(code)}>Copy code</button><span className="small muted">Expires in about {minutes} min</span></div>
    </>}
    <div className="setupNote">The Android user must explicitly enable Notification Access and choose whether message content can be shared.</div>
    <div className="row" style={{marginTop:18,justifyContent:"space-between"}}><Link href="/dashboard" className="small muted">Skip for now</Link><Link href="/privacy" className="small accentLink">Privacy</Link></div>
  </div></main>;
}
