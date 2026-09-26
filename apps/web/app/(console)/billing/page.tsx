"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../../components/PageHeader";
import { api } from "../../../lib/api";
import { Icon, Skeleton, Toast, ReauthDialog } from "../../../components/ui/UI";

type RazorpayWindow = Window & { Razorpay?: new (options:any)=>{ open:()=>void } };

const fallbackPlans=[
  {key:"starter",name:"Starter",devices:1,retention:30,displayPrice:"₹199 / month"},
  {key:"family",name:"Family",devices:4,retention:90,displayPrice:"₹399 / month"}
];
export default function BillingPage(){
  const [plans,setPlans]=useState<any[]>([]);const [status,setStatus]=useState<any>(null);const [user,setUser]=useState<any>(null);const [busy,setBusy]=useState("");const [scriptReady,setScriptReady]=useState(false);const [error,setError]=useState("");const [toast,setToast]=useState<{message:string;tone:"success"|"error"|"info"}|null>(null); const [reauthPlan,setReauthPlan]=useState("");
  useEffect(()=>{Promise.all([api("/auth/session"),api("/billing/plans"),api("/billing/status")]).then(([u,p,s])=>{setUser(u.user);setPlans(p.plans||[]);setStatus(s.subscription)}).catch(e=>setError(e.message||"Could not load billing."));const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.async=true;s.onload=()=>setScriptReady(true);s.onerror=()=>setScriptReady(false);document.body.appendChild(s);return()=>s.remove()},[]);
  async function subscribe(planKey:string,password?:string){setBusy(planKey);try{const r=await api("/billing/subscription",{method:"POST",body:JSON.stringify({planKey,password:password||""})});const Razorpay=(window as RazorpayWindow).Razorpay;if(!Razorpay)throw new Error("Secure checkout is unavailable right now.");const checkout=new Razorpay({key:r.keyId,subscription_id:r.subscriptionId,name:"KidRaksha",description:r.plan.name,handler:()=>setToast({message:"Checkout submitted. Your plan updates after the verified billing event arrives.",tone:"info"}),prefill:{name:user?.displayName||"",email:user?.email||""},theme:{color:"#6b5ce7"}});checkout.open()}catch(e:any){setToast({message:e.message||"Could not open checkout.",tone:"error"})}finally{setBusy("")}}
  const currentKey=status?.plan?.key; const cards=plans.length?plans:fallbackPlans; const trial=status?.access==="trial"||status?.status==="trial"||status?.status==="trialing"; const expired=status?.access==="expired"||status?.status==="expired"; const currentName=status?.plan?.name||"Free trial"; const statusLabel=expired?"Expired":trial?"Trial":String(status?.status||"Active").replace(/^./,c=>c.toUpperCase());
  return <>
    <PageHeader eyebrow="Subscription" title="Billing" description="Choose the notification coverage that fits your family. Billing state is verified server-side."/>
    {error&&<div className="error" style={{marginTop:18}}>{error}</div>}
    <section className="card currentPlan"><div className="between"><div><div className="planBadge">Current plan</div><h2>{currentName}</h2><div className="small muted">{trial?`Trial ${status?.trialEndsAt?`ends ${new Date(status.trialEndsAt).toLocaleDateString()}`:"active"}`:status?.status?`Status: ${status.status}`:"Loading billing status…"}</div></div><span className={`badge ${expired?"red":trial?"green":""}`}>{statusLabel}</span></div></section>
    <div className="billingGrid">{cards.map((p:any)=>{const selected=currentKey===p.key;return <article className={`card planCard ${p.key==="family"?"recommended":""}`} key={p.key}>{p.key==="family"&&<div className="planAccent"/>}<div className="planBadge">{p.name}{p.key==="family"&&<span className="badge" style={{marginLeft:8}}>More devices</span>}</div><h3>{p.displayPrice}</h3><div className="planSummary">Designed for {p.devices} child device{p.devices>1?"s":""}, with {p.retention} days of notification history.</div><div className="featureList"><div><Icon name="check" size={14}/> {p.devices} connected child device{p.devices>1?"s":""}</div><div><Icon name="check" size={14}/> {p.retention} days notification retention</div><div><Icon name="check" size={14}/> Secure pairing and realtime updates</div></div><button className={`btn ${selected?"ghost":"accent"}`} style={{width:"100%"}} onClick={()=>setReauthPlan(p.key)} disabled={selected||busy===p.key||!scriptReady}>{selected?"Current plan":busy===p.key?"Opening checkout…":`Choose ${p.name}`}</button></article>})}</div>
    <div className="billingNote"><Icon name="shield" size={15}/> Payments are handled by Razorpay. A browser callback does not activate a plan; KidRaksha changes entitlements only after verified provider events are processed. Cancel or manage an active subscription through the billing provider.</div>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    <ReauthDialog open={Boolean(reauthPlan)} title="Confirm your password" body="Billing changes require your current password. KidRaksha will then open the secure Razorpay checkout." confirmLabel="Continue to checkout" busy={Boolean(busy)} onCancel={()=>setReauthPlan("")} onConfirm={(password)=>{const planKey=reauthPlan;setReauthPlan("");void subscribe(planKey,password)}}/>
  </>;
}
