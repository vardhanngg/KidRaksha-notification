"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import PageHeader from "../../../components/PageHeader";
import { ConfirmDialog, Icon, Skeleton, Toast, ReauthDialog } from "../../../components/ui/UI";

export default function SettingsPage(){
  const router=useRouter();
  const [retention,setRetention]=useState(30); const [maxRetention,setMaxRetention]=useState(90); const [user,setUser]=useState<any>(null); const [activity,setActivity]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [saved,setSaved]=useState(false); const [confirmDelete,setConfirmDelete]=useState(false); const [reauthDelete,setReauthDelete]=useState(false); const [deleting,setDeleting]=useState(false); const [reauthExport,setReauthExport]=useState(false); const [passwordBusy,setPasswordBusy]=useState(false); const [exportBusy,setExportBusy]=useState(false); const [toast,setToast]=useState<{message:string;tone:"success"|"error"|"info"}|null>(null);
  useEffect(()=>{Promise.allSettled([api("/settings"),api("/auth/session"),api("/audit?limit=8")]).then(([settings,session,audit])=>{if(settings.status==="fulfilled"){setRetention(settings.value.retentionDays);setMaxRetention(settings.value.subscription?.plan?.retention||90)}if(session.status==="fulfilled")setUser(session.value.user);if(audit.status==="fulfilled")setActivity(audit.value.items||[])}).finally(()=>setLoading(false))},[]);
  async function save(){setSaving(true);try{const r=await api("/settings",{method:"PATCH",body:JSON.stringify({retentionDays:retention})});setRetention(r.retentionDays);setSaved(true);window.setTimeout(()=>setSaved(false),2200)}catch(e:any){setToast({message:e.message||"Could not save settings.",tone:"error"})}finally{setSaving(false)}}
  async function exportData(password?:string){setExportBusy(true);try{if(password){await api("/auth/reauth",{method:"POST",body:JSON.stringify({password})})}const data=await api("/account/export");const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="kidraksha-data-export.json";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);setReauthExport(false);setToast({message:"Your data export is ready.",tone:"success"})}catch(e:any){setToast({message:e.message||"Could not export your data.",tone:"error"})}finally{setExportBusy(false)}}
  async function changePassword(currentPassword:string,newPassword:string){setPasswordBusy(true);try{await api("/auth/password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});setToast({message:"Your password was changed and other sessions were signed out.",tone:"success"});}catch(e:any){setToast({message:e.message||"Could not change your password.",tone:"error"})}finally{setPasswordBusy(false)}}
  async function deleteAccount(password:string){setDeleting(true);try{await api("/account",{method:"DELETE",body:JSON.stringify({confirmation:"DELETE",password})});router.replace("/")}catch(e:any){setToast({message:e.message||"Could not delete the account.",tone:"error"});setDeleting(false);setReauthDelete(false);setConfirmDelete(false)}}
  return <>
    <PageHeader eyebrow="Workspace" title="Settings" description="Manage your account, notification retention and privacy controls."/>
    <div className="settingsGrid">
      <div className="stack">
        <section className="card settingsCard"><div className="eyebrow">Account</div><h2>{loading?<Skeleton className="title"/>:(user?.displayName||"Parent account")}</h2><p>{user?.email||"Your login email"}</p></section>
        <section className="card settingsCard"><div className="eyebrow">Notification history</div><h2>Data retention</h2><p>Choose how long KidRaksha keeps notification history. Older records are removed by the scheduled retention process.</p><div className="settingRow"><div className="settingLabel"><b>Keep history for</b><span>Maximum allowed by your current plan: {maxRetention} days.</span></div><select className="input retentionSelect" value={retention} onChange={e=>setRetention(Number(e.target.value))} aria-label="Notification retention"><option value={7}>7 days</option>{maxRetention>=30&&<option value={30}>30 days</option>}{maxRetention>=60&&<option value={60}>60 days</option>}{maxRetention>=90&&<option value={90}>90 days</option>}</select></div><div className="row" style={{marginTop:15}}><button className="btn primary" onClick={save} disabled={saving}>{saving?"Saving…":"Save retention"}</button>{saved&&<span className="success">Saved</span>}</div></section>
        <section className="card settingsCard"><div className="eyebrow">Account security</div><h2>Change your password</h2><p>Changing your password signs out other active sessions and keeps this session signed in.</p><PasswordChangeForm busy={passwordBusy} onSubmit={changePassword}/></section>
        <section className="card settingsCard"><div className="eyebrow">Privacy controls</div><h2>What KidRaksha shares</h2><div className="privacyItem"><div className="privacyIcon"><Icon name="eye" size={16}/></div><div><b>Notification Access is device-controlled</b><p>The Android user can enable or remove the system permission at any time.</p></div></div><div className="privacyItem"><div className="privacyIcon"><Icon name="shield" size={16}/></div><div><b>Message content is explicitly shared</b><p>When enabled on the child device, notification content is encrypted when stored by KidRaksha.</p></div></div><div className="privacyItem"><div className="privacyIcon"><Icon name="clock" size={16}/></div><div><b>Retention is configurable</b><p>Your selected retention window is enforced by the service.</p></div></div></section>
      </div>
      <div className="stack">
        <section className="card settingsCard"><div className="between"><div><div className="eyebrow">Data portability</div><h2>Your data, available to you.</h2><p>Download an account export containing your profile, devices, notification records and subscription state.</p></div><div className="privacyIcon"><Icon name="download"/></div></div><button className="btn ghost" style={{marginTop:10}} onClick={()=>setReauthExport(true)} disabled={exportBusy}><Icon name="download" size={15}/> {exportBusy?"Preparing…":"Download JSON export"}</button></section>
        <section className="card settingsCard"><div className="eyebrow">Recent activity</div><h2>Account activity</h2><div style={{marginTop:7}}>{activity.length?activity.map((a:any)=><div className="activityRow" key={a.id}><div className="activityIcon"><Icon name={String(a.action||"").includes("delete")?"trash":String(a.action||"").includes("login")?"eye":"info"} size={13}/></div><div><b>{String(a.action||"activity").replaceAll("_"," ")}</b><p>{a.actorType||"system"}{a.metadata?.planKey?` · ${a.metadata.planKey}`:""}</p></div><time>{a.createdAt?new Date(a.createdAt).toLocaleDateString():"—"}</time></div>):<p className="muted">No recent activity.</p>}</div></section>
        <section className="card settingsCard accountDanger"><div className="eyebrow">Danger zone</div><h2>Delete your KidRaksha account</h2><p>This permanently removes your parent account, child-device associations, notification history, billing state and associated tenant audit data.</p><button className="btn danger" onClick={()=>setConfirmDelete(true)}><Icon name="trash" size={15}/> Delete account</button></section>
      </div>
    </div>
    <ReauthDialog open={reauthExport} title="Confirm your password" body="Exporting your account includes notification history and device data. Enter your current password to continue." confirmLabel="Export data" busy={exportBusy} onCancel={()=>setReauthExport(false)} onConfirm={(password)=>{void exportData(password)}}/>
    <ConfirmDialog open={confirmDelete} title="Delete your account permanently?" body="This action cannot be undone. Your KidRaksha account and stored notification data will be permanently removed." confirmLabel="Continue" danger onCancel={()=>setConfirmDelete(false)} onConfirm={()=>{setConfirmDelete(false);setReauthDelete(true)}}/>
    <ReauthDialog open={reauthDelete} title="Confirm your password" body="For your protection, enter your current password to permanently delete this account." confirmLabel="Delete account" danger busy={deleting} onCancel={()=>setReauthDelete(false)} onConfirm={deleteAccount}/>
    {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
  </>;
}


function PasswordChangeForm({busy,onSubmit}:{busy:boolean;onSubmit:(currentPassword:string,newPassword:string)=>Promise<void>|void}){
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const valid=newPassword.length>=10 && newPassword===confirmPassword;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!valid||!currentPassword)return;await onSubmit(currentPassword,newPassword);setCurrentPassword("");setNewPassword("");setConfirmPassword("");}
  return <form onSubmit={submit} className="stack" style={{marginTop:14}} noValidate>
    <label className="field"><span>Current password</span><input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required/></label>
    <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><small className="muted">Use at least 10 characters.</small></label>
    <label className="field"><span>Confirm new password</span><input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></label>
    <button className="btn ghost" type="submit" disabled={busy||!currentPassword||!valid}>{busy?"Changing…":"Change password"}</button>
  </form>
}
