
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Brand from "./Brand";
import { api } from "../lib/api";

const links = [
  ["/dashboard","Overview"],["/notifications","Notifications"],["/devices","Devices"],["/billing","Billing"],["/settings","Settings"]
];

export default function Shell({children}:{children:ReactNode}){
  const path=usePathname(); const router=useRouter(); const [user,setUser]=useState<any>(null); const [healthy,setHealthy]=useState<boolean|null>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{api("/auth/session").then(r=>setUser(r.user)).catch(()=>router.replace("/login")).finally(()=>setLoading(false)); api("/health").then(()=>setHealthy(true)).catch(()=>setHealthy(false));},[router]);
  async function logout(){try{await api("/auth/logout",{method:"POST"});}finally{router.replace("/");}}
  if(loading) return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f6fa"}}>Loading LittleWatch…</div>;
  return <div className="appLayout">
    <aside className="sidebar">
      <Brand dark/>
      <div className="nav">{links.map(([href,label])=><Link className={path===href||path.startsWith(href+"/")?"active":""} href={href} key={href}>{label}</Link>)}</div>
      <div className="sidebarFoot">
        <div style={{fontSize:13,fontWeight:750,color:"#fff"}}>{user?.displayName}</div>
        <div style={{fontSize:12,color:"#858e9d",margin:"4px 0 14px"}}>{user?.email}</div>
        <button className="btn ghost" style={{width:"100%",color:"#ccd2dc",borderColor:"#2a303c"}} onClick={logout}>Log out</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="row"><span className={"badge "+(healthy===true?"green":"")}>{healthy===true?"● Service healthy":healthy===false?"● Service unavailable":"● Checking service"}</span></div><div className="small muted">Parent console</div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
