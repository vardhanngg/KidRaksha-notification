
"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function BillingPage(){
  const [plans,setPlans]=useState<any[]>([]);const [status,setStatus]=useState<any>(null);const [user,setUser]=useState<any>(null);const [busy,setBusy]=useState("");const [scriptReady,setScriptReady]=useState(false);
  useEffect(()=>{api("/auth/session").then(r=>setUser(r.user));api("/billing/plans").then(r=>setPlans(r.plans||[]));api("/billing/status").then(r=>setStatus(r.subscription));const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=()=>setScriptReady(true);document.body.appendChild(s);return()=>s.remove()},[]);
  async function subscribe(planKey:string){
    setBusy(planKey);
    try{
      const r=await api("/billing/subscription",{method:"POST",body:JSON.stringify({planKey})});
      const Razorpay=(window as any).Razorpay;
      if(!Razorpay)throw new Error("Payment checkout is not available.");
      const checkout=new Razorpay({
        key:r.keyId,subscription_id:r.subscriptionId,name:"LittleWatch",description:r.plan.name,
        handler:()=>alert("Payment submitted. Your plan will update after the verified billing webhook arrives."),
        prefill:{name:user?.displayName||"",email:user?.email||""},theme:{color:"#7b6df3"}
      });
      checkout.open();
    }catch(e:any){alert(e.message)}finally{setBusy("")}
  }
  return <>
    <div className="pageTitle"><h1>Billing</h1><p>Choose the plan that fits your family. Cancel through your billing provider.</p></div>
    <div className="card" style={{padding:20,marginTop:20}}><div className="between"><div><span className="eyebrow">Current</span><h2 style={{margin:"7px 0"}}>{status?.plan?.name||"Trial"}</h2><div className="small muted">Status: {status?.status||"loading"}</div></div>{status?.status==="trial" ? <span className="badge green">Trial</span> : <span className="badge">{status?.plan?.name||"Plan"}</span>}</div></div>
    <div className="pricingGrid">{plans.map(p=><div className="card feature" key={p.key}><span className="eyebrow">{p.key}</span><h2 style={{margin:"8px 0"}}>{p.name}</h2><div style={{fontSize:28,fontWeight:850}}>{p.displayPrice}</div><p className="muted">{p.devices} child device{p.devices>1?"s":""} · {p.retention} day notification retention</p><button className="btn accent" style={{width:"100%",marginTop:12}} onClick={()=>subscribe(p.key)} disabled={busy===p.key||!scriptReady}>{busy===p.key?"Opening checkout…":"Choose "+p.name}</button></div>)}</div>
    <p className="small muted" style={{marginTop:18}}>Payment provider events are verified server-side. A browser success callback does not by itself activate a subscription.</p>
  </>;
}
