import Link from "next/link";

export default function DeleteAccountPage(){
  return <main className="legalPage"><div className="legalCard">
    <div className="authKicker">KidRaksha account deletion</div>
    <h1>Delete your account and data</h1>
    <p className="muted">KidRaksha provides an authenticated deletion flow so only the account owner can delete the account and associated notification data.</p>
    <h2>How to request deletion</h2>
    <ol>
      <li>Sign in to your KidRaksha parent account.</li>
      <li>Open <b>Settings</b>.</li>
      <li>Choose <b>Delete account</b> and type DELETE to confirm.</li>
    </ol>
    <p className="small muted">This page is the external account-deletion resource for the KidRaksha service. Account deletion removes the account, child-device records, notification history, sessions, and tenant audit records managed by KidRaksha, subject to any legally required retention.</p>
    <div className="row" style={{marginTop:22}}><Link href="/login" className="btn accent">Sign in to delete</Link><Link href="/privacy" className="btn ghost">Privacy policy</Link></div>
  </div></main>;
}
