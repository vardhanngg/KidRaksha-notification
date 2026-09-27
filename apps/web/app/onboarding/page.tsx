"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import {
  RealtimeProvider,
  useRealtimeEvent,
} from "../../lib/realtime/client";
import { Icon, Toast } from "../../components/ui/UI";

function remaining(expiresAt:string|undefined){return expiresAt?Math.max(0,Math.ceil((new Date(expiresAt).getTime()-Date.now())/1000)):0}

export default function OnboardingPage(){
  return (
    <RealtimeProvider>
      <OnboardingContent />
    </RealtimeProvider>
  );
}

function OnboardingContent(){
  const [code,setCode]=useState(""); const [codeId,setCodeId]=useState(""); const [issuedAt,setIssuedAt]=useState(""); const [expiresAt,setExpiresAt]=useState(""); const [seconds,setSeconds]=useState(0); const [pairedDevice,setPairedDevice]=useState<any>(null); const [deviceCount,setDeviceCount]=useState(0); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [copied,setCopied]=useState(false);
  async function loadDevices(){try{const r=await api("/devices");setDeviceCount((r.devices||[]).length)}catch{}}
  useEffect(()=>{loadDevices()},[]);
  useEffect(()=>{if(!expiresAt)return;setSeconds(remaining(expiresAt));const timer=setInterval(()=>setSeconds(remaining(expiresAt)),1000);return()=>clearInterval(timer)},[expiresAt]);
  useRealtimeEvent("device.paired", (payload:any)=>{
    if (!code || !payload?.deviceId) return;
    setPairedDevice(payload); setCode(""); setCodeId(""); setIssuedAt(""); setExpiresAt(""); loadDevices();
  });
  useEffect(()=>{
    if(!code || !issuedAt) return;
    let stopped=false;
    const fallback=setInterval(async()=>{try{const r=await api("/devices");const latest=(r.devices||[]).find((d:any)=>!d.revoked_at&&new Date(d.created_at).getTime()>=new Date(issuedAt).getTime());if(latest&&!stopped){setPairedDevice({deviceId:latest.id,deviceName:latest.name,platform:latest.platform,appVersion:latest.app_version,pairedAt:latest.created_at});setCode("");setCodeId("");setIssuedAt("");setExpiresAt("")}}catch{}},5000);return()=>{stopped=true;clearInterval(fallback)}
  },[code,issuedAt]);
  async function generate(){setBusy(true);setError("");try{const r=await api("/devices/pairing-codes",{method:"POST"});setCode(r.code);setCodeId(r.id);setIssuedAt(r.issuedAt);setExpiresAt(r.expiresAt)}catch(e:any){setError(e.message||"Could not create a pairing code.")}finally{setBusy(false)}}
  async function cancel(){if(!codeId)return;setBusy(true);setError("");try{await api(`/devices/pairing-codes/${codeId}`,{method:"DELETE"});setCode("");setCodeId("");setIssuedAt("");setExpiresAt("")}catch(e:any){setError(e.message||"Could not close the pairing code.")}finally{setBusy(false)}}
  async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1800)}catch{setError("Your browser did not allow clipboard access. You can copy the code manually.")}}
  const step=pairedDevice?4:code?3:1; const timeLabel=useMemo(()=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`,[seconds]);
  if(pairedDevice)return <main className="authPage"><div className="authCard setupCard"><div className="setupCheck">✓</div><div className="authKicker">Step 4 of 4 · Connected</div><h1>{pairedDevice.deviceName||"Child device"} is connected.</h1><p className="muted">The Android phone is now linked to your family workspace. On the phone, Notification Access and message-content sharing remain separate choices controlled by the device user.</p><div className="deviceSuccessCard"><div><span className="small muted">Device</span><b>{pairedDevice.deviceName||"Android device"}</b></div><span className="badge green"><Icon name="check" size={13}/> Connected</span></div><div className="setupFeatureList"><div><b>What happens next</b><span>The child phone completes its setup, then shared notifications begin appearing in your inbox.</span></div><div><b>Nothing is enabled just by pairing</b><span>The child device must still enable Notification Access and explicitly turn sharing on.</span></div></div><Link href="/dashboard" className="btn accent" style={{marginTop:20,width:"100%"}}>Open dashboard <Icon name="arrowRight" size={16}/></Link><Link href="/devices" className="btn ghost" style={{marginTop:9,width:"100%"}}>Manage devices</Link></div></main>;
  return <main className="authPage"><div className="authCard setupCard"><div className="stepDots">{[1,2,3,4].map(n=><span key={n} className={n<=step?"active":""} />)}</div><div className="authKicker">Step {step} of 4 · Family setup</div><h1>Connect a child device.</h1><p className="muted">Create a secure one-time code and enter it in KidSuraksha on the Android phone.</p>{error&&<div className="error" style={{marginTop:15}}>{error}</div>}
    {!code?<><div className="setupFeatureList"><div><b>1 · Create a one-time code</b><span>Valid for 10 minutes and usable once.</span></div><div><b>2 · Enter the code on Android</b><span>The child app keeps the code local until pairing succeeds.</span></div><div><b>3 · Finish setup on the phone</b><span>Notification Access and message-content sharing are explicit decisions on the device.</span></div></div><button className="btn accent" style={{width:"100%",marginTop:20}} disabled={busy} onClick={generate}><Icon name="plus" size={16}/>{busy?"Creating secure code…":"Create pairing code"}</button></>:<><div className="pairCode onLight" aria-label={`Pairing code ${code}`}>{code}</div><div className="pairMeta"><div><span className="small muted">Time remaining</span><b>{seconds?timeLabel:"Expired"}</b></div><span className="badge">One time</span></div><div className="setupWaiting"><span className="pulse"/><div><b>Waiting for the Android phone</b><div className="small muted">Enter this code in KidSuraksha. This page will update when pairing succeeds.</div></div></div><div className="row" style={{marginTop:13,flexWrap:"wrap"}}><button className="btn primary" onClick={copy}><Icon name={copied?"check":"copy"} size={15}/>{copied?"Copied":"Copy code"}</button><button className="btn ghost" onClick={cancel} disabled={busy}>Cancel code</button></div>{!seconds&&<button className="btn accent" style={{width:"100%",marginTop:10}} disabled={busy} onClick={generate}>Generate a new code</button>}</>}
    <div className="setupNote"><Icon name="shield" size={15}/> Pairing connects the phone to this account; it does not by itself grant Notification Access or turn on message sharing.</div>
    {deviceCount>0&&<Link href="/devices" className="small accentLink" style={{display:"block",marginTop:15}}>You already have {deviceCount} connected device{deviceCount===1?"":"s"} → Manage devices</Link>}<div className="row" style={{marginTop:18,justifyContent:"space-between"}}><Link href="/dashboard" className="small muted">Back to dashboard</Link><Link href="/privacy" className="small accentLink">Privacy</Link></div>
  </div>{copied&&<Toast message="Pairing code copied." tone="success" onClose={()=>setCopied(false)}/>}</main>
}
