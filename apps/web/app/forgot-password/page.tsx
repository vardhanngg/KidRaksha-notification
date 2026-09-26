"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import Brand from "../../components/Brand";

export default function ForgotPasswordPage(){
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setError("");
    try { await api("/auth/password-reset/request",{method:"POST",body:JSON.stringify({email})}); setDone(true); }
    catch(err){ setError(err instanceof ApiError ? err.message : "We could not process the request right now."); }
    finally{ setBusy(false); }
  }
  return <main className="authPage"><section className="authCard singleAuthCard"><div className="mobileAuthBrand"><Link href="/"><Brand/></Link></div><div className="authKicker">Account recovery</div><h1>Reset your password</h1><p className="muted">Enter your account email. For security, KidRaksha uses the same response whether or not an account exists.</p>{done?<div className="success" style={{marginTop:18}}>If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.</div>:<form onSubmit={submit}><div className="field"><label htmlFor="reset-email">Email</label><input id="reset-email" className="input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={200}/></div>{error&&<div className="error" style={{marginTop:14}}>{error}</div>}<button className="btn accent" style={{width:"100%",marginTop:20}} disabled={busy}>{busy?"Sending…":"Send reset link"}</button></form>}<p className="small muted" style={{marginTop:20,textAlign:"center"}}><Link href="/login" className="accentLink">Back to log in</Link></p></section></main>;
}
