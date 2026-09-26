"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Brand from "./Brand";
import { api } from "../lib/api";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [accepted,setAccepted]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError("");
    try{
      await api(mode==="login"?"/auth/login":"/auth/signup",{
        method:"POST",
        body:JSON.stringify(mode==="login"?{email,password}:{email,password,displayName:name,acceptedPolicies:accepted})
      });
      router.replace(mode==="signup"?"/onboarding":"/dashboard");
      router.refresh();
    }catch(err:any){setError(err.message||"Something went wrong.");}
    finally{setBusy(false);}
  }

  return <main className="authPage">
    <div className="authCard">
      <Brand/>
      <div className="authKicker">{mode==="login"?"Parent console":"Start your family workspace"}</div>
      <h1>{mode==="login"?"Welcome back":"Create your parent account"}</h1>
      <p className="muted">{mode==="login"?"Open your LittleWatch dashboard.":"Start your 7-day trial and connect your first child device."}</p>
      {error && <div className="error" style={{marginTop:16}}>{error}</div>}
      <form onSubmit={submit}>
        {mode==="signup" && <div className="field"><label>Your name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required/></div>}
        <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="login"?"current-password":"new-password"} minLength={10} required/><div className="small muted">Use at least 10 characters.</div></div>
        {mode==="signup" && <label className="consentRow"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required/><span>I agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>}
        <button className="btn accent" disabled={busy || (mode==="signup" && !accepted)} style={{width:"100%",marginTop:20}}>{busy?"Please wait…":mode==="login"?"Log in":"Create account"}</button>
      </form>
      <p className="small muted" style={{marginTop:18}}>
        {mode==="login"?<>New here? <Link href="/signup" className="accentLink">Create an account</Link></>:<>Already have an account? <Link href="/login" className="accentLink">Log in</Link></>}
      </p>
    </div>
  </main>;
}
