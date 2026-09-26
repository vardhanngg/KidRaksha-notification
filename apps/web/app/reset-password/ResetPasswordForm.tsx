"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../lib/api";
import Brand from "../../components/Brand";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");

  async function submit(e:FormEvent){
    e.preventDefault(); setError("");
    if(!token){setError("This reset link is missing or incomplete. Request a new link.");return;}
    if(password!==confirm){setError("The passwords do not match.");return;}
    setBusy(true);
    try{
      await api("/auth/password-reset/confirm",{method:"POST",body:JSON.stringify({token,newPassword:password})});
      setDone(true);
      window.history.replaceState({},"","/reset-password");
    }catch(err){setError(err instanceof ApiError?err.message:"We could not reset the password right now.");}
    finally{setBusy(false);}
  }

  return <main className="authPage">
    <section className="authCard singleAuthCard">
      <div className="mobileAuthBrand"><Link href="/"><Brand/></Link></div>
      <div className="authKicker">Account recovery</div>
      <h1>{done?"Password updated":"Choose a new password"}</h1>
      <p className="muted">{done?"Your password has been changed and existing sessions were signed out. You can now log in with the new password.":"Use at least 10 characters. This reset link can only be used once and expires after 30 minutes."}</p>
      {done?
        <div className="stack" style={{marginTop:20}}><Link href="/login" className="btn accent" style={{width:"100%"}}>Log in</Link></div>
        :
        <form onSubmit={submit}>
          {!token&&<div className="error" style={{marginTop:16}}>This reset link is missing. Request a new link from the password recovery page.</div>}
          <div className="field"><label htmlFor="reset-password">New password</label><input id="reset-password" className="input" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required/><div className="helper">At least 10 characters.</div></div>
          <div className="field"><label htmlFor="reset-confirm">Confirm new password</label><input id="reset-confirm" className="input" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></div>
          {error&&<div className="error" style={{marginTop:14}}>{error}</div>}
          <button className="btn accent" style={{width:"100%",marginTop:20}} disabled={busy||!token}>{busy?"Updating…":"Update password"}</button>
        </form>
      }
      <p className="small muted" style={{marginTop:20,textAlign:"center"}}><Link href="/login" className="accentLink">Back to log in</Link></p>
    </section>
  </main>;
}
