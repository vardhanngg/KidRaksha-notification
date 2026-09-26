"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

function remaining(expiresAt:string|undefined){
  if(!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime()-Date.now())/1000));
}

export default function OnboardingPage(){
  const [code,setCode]=useState("");
  const [codeId,setCodeId]=useState("");
  const [issuedAt,setIssuedAt]=useState("");
  const [expiresAt,setExpiresAt]=useState("");
  const [seconds,setSeconds]=useState(0);
  const [pairedDevice,setPairedDevice]=useState<any>(null);
  const [deviceCount,setDeviceCount]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function loadDevices(){
    try{
      const r=await api("/devices");
      setDeviceCount((r.devices||[]).length);
    }catch{}
  }

  useEffect(()=>{ loadDevices(); },[]);

  useEffect(()=>{
    if(!code || !expiresAt) return;
    setSeconds(remaining(expiresAt));
    const timer=setInterval(()=>setSeconds(remaining(expiresAt)),1000);
    return()=>clearInterval(timer);
  },[code,expiresAt]);

  useEffect(()=>{
    if(!code) return;
    let stopped=false;
    const es=new EventSource("/api/events/stream");
    const onPaired=(event:MessageEvent)=>{
      try{
        const data=JSON.parse(event.data);
        if(!stopped){
          setPairedDevice(data);
          setCode("");
          setCodeId("");
          setExpiresAt("");
          loadDevices();
        }
      }catch{}
    };
    es.addEventListener("device.paired",onPaired);
    const fallback=setInterval(async()=>{
      try{
        const r=await api("/devices");
        const latest=(r.devices||[]).find((d:any)=>code && issuedAt && !d.revoked_at && new Date(d.created_at).getTime()>=new Date(issuedAt).getTime());
        if(latest && !stopped){
          setPairedDevice({deviceId:latest.id,deviceName:latest.name,platform:latest.platform,appVersion:latest.app_version,pairedAt:latest.created_at});
          setCode("");setCodeId("");setIssuedAt("");setExpiresAt("");
        }
      }catch{}
    },5000);
    return()=>{stopped=true;es.close();clearInterval(fallback)};
  },[code,expiresAt]);

  async function generate(){
    setBusy(true);setError("");
    try{
      const r=await api("/devices/pairing-codes",{method:"POST"});
      setCode(r.code);setCodeId(r.id);setIssuedAt(r.issuedAt);setExpiresAt(r.expiresAt);
    }catch(e:any){setError(e.message||"Could not create a pairing code.")}
    finally{setBusy(false)}
  }

  async function cancel(){
    if(!codeId) return;
    setBusy(true);setError("");
    try{await api(`/devices/pairing-codes/${codeId}`,{method:"DELETE"});setCode("");setCodeId("");setExpiresAt("")}
    catch(e:any){setError(e.message||"Could not close the pairing code.")}
    finally{setBusy(false)}
  }

  const activeStep = pairedDevice ? 4 : code ? 2 : 1;
  const timeLabel=useMemo(()=>{
    const m=Math.floor(seconds/60), s=seconds%60;
    return `${m}:${String(s).padStart(2,"0")}`;
  },[seconds]);

  if(pairedDevice) return <main className="authPage"><div className="authCard setupCard">
    <div className="setupCheck">✓</div>
    <div className="authKicker">Device connected</div>
    <h1>{pairedDevice.deviceName || "Child device"} is connected.</h1>
    <p className="muted">The Android device is linked to your family workspace. The device user still needs to complete Notification Access and sharing consent on the phone.</p>
    <div className="deviceSuccessCard">
      <div><span className="small muted">Device</span><b>{pairedDevice.deviceName || "Android device"}</b></div>
      <span className="badge green">Connected</span>
    </div>
    <Link href="/dashboard" className="btn accent" style={{marginTop:20,width:"100%"}}>Open parent dashboard</Link>
    <Link href="/devices" className="btn ghost" style={{marginTop:10,width:"100%"}}>Manage devices</Link>
  </div></main>;

  return <main className="authPage"><div className="authCard setupCard">
    <div className="stepDots"><span className="active"></span><span className={activeStep>=2?"active":""}></span><span className={activeStep>=3?"active":""}></span><span className={activeStep>=4?"active":""}></span></div>
    <div className="authKicker">Family setup</div>
    <h1>Connect a child device.</h1>
    <p className="muted">Use one secure code to link an Android phone to this parent account. No camera scan is required.</p>
    {error&&<div className="error" style={{marginTop:16}}>{error}</div>}

    {!code ? <>
      <div className="setupFeatureList">
        <div><b>1. Create a one-time code</b><span>Valid for 10 minutes and usable once.</span></div>
        <div><b>2. Enter it on the Android phone</b><span>The child app keeps the code local until pairing succeeds.</span></div>
        <div><b>3. Review access and consent</b><span>Notification Access and message-content sharing are explicit choices on the phone.</span></div>
      </div>
      <button className="btn accent" style={{width:"100%",marginTop:20}} disabled={busy} onClick={generate}>{busy?"Creating secure code…":"Create pairing code"}</button>
    </> : <>
      <div className="pairCode onLight">{code}</div>
      <div className="pairMeta"><div><span className="small muted">Expires</span><b>{seconds ? timeLabel : "Expired"}</b></div><div className="small muted">One-time code</div></div>
      <div className="setupWaiting"><span className="pulse"></span><div><b>Waiting for the Android phone</b><div className="small muted">Open KidRaksha on the child phone and enter this code. This screen updates automatically.</div></div></div>
      <div className="row" style={{marginTop:14,flexWrap:"wrap"}}>
        <button className="btn primary" onClick={()=>navigator.clipboard?.writeText(code)}>Copy code</button>
        <button className="btn ghost" onClick={cancel} disabled={busy}>Cancel code</button>
      </div>
      {!seconds && <button className="btn accent" style={{width:"100%",marginTop:12}} onClick={generate} disabled={busy}>{busy?"Creating…":"Generate a new code"}</button>}
    </>}

    <div className="setupNote">The Android phone will not share notification data merely because it is paired. The phone user must explicitly enable Notification Access and then turn sharing on.</div>
    {deviceCount>0 && <Link href="/devices" className="small accentLink" style={{display:"block",marginTop:16}}>You already have {deviceCount} connected device{deviceCount===1?"":"s"} → Manage devices</Link>}
    <div className="row" style={{marginTop:18,justifyContent:"space-between"}}><Link href="/dashboard" className="small muted">Back to dashboard</Link><Link href="/privacy" className="small accentLink">Privacy</Link></div>
  </div></main>;
}
