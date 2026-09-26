"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Brand from "./Brand";
import { api } from "../lib/api";
import { Icon } from "./ui/UI";
import { RealtimeProvider, useRealtime } from "../lib/realtime/client";

const links = [
  ["/dashboard", "Overview", "grid"],
  ["/notifications", "Notifications", "bell"],
  ["/devices", "Devices", "device"],
  ["/billing", "Billing", "card"],
  ["/settings", "Settings", "settings"]
] as const;

function ShellContent({children}:{children:ReactNode}){
  const path=usePathname(); const router=useRouter();
  const [user,setUser]=useState<any>(null); const [healthy,setHealthy]=useState<boolean|null>(null); const [loading,setLoading]=useState(true); const [open,setOpen]=useState(false);
  const realtime=useRealtime();
  useEffect(()=>{let mounted=true; Promise.allSettled([api("/auth/session"),api("/health")]).then(([session,health])=>{if(!mounted)return; if(session.status==="fulfilled")setUser(session.value.user); else router.replace("/login"); setHealthy(health.status==="fulfilled");}).finally(()=>{if(mounted)setLoading(false)}); return()=>{mounted=false}},[router]);
  useEffect(()=>{setOpen(false)},[path]);
  async function logout(){try{await api("/auth/logout",{method:"POST"});}finally{router.replace("/");}}
  if(loading) return <div className="appLoading"><div className="loadingBrand"><span className="brandMark">KR</span><div><b>KidRaksha</b><span>Loading your workspace…</span></div></div></div>;
  return <div className="appLayout">
    <a href="#main-content" className="skipLink">Skip to main content</a>
    <div className={`mobileOverlay ${open?"show":""}`} onClick={()=>setOpen(false)} />
    <aside className={`sidebar ${open?"open":""}`}>
      <div className="sidebarTop"><Brand dark/><button className="iconButton mobileClose" onClick={()=>setOpen(false)} aria-label="Close navigation"><Icon name="x"/></button></div>
      <div className="workspacePill"><span className="workspaceAvatar">{String(user?.displayName||"P").slice(0,1).toUpperCase()}</span><span><b>{user?.displayName||"Parent"}</b><small>Family workspace</small></span><Icon name="chevronDown" size={15}/></div>
      <nav className="nav" aria-label="Primary navigation">{links.map(([href,label,icon])=><Link className={path===href||path.startsWith(href+"/")?"active":""} href={href} key={href}><Icon name={icon}/><span>{label}</span></Link>)}</nav>
      <div className="sidebarBottom">
        <div className={`servicePill ${healthy===true?"up":healthy===false?"down":"checking"}`}><span className="serviceDot" />{healthy===true?"All systems operational":healthy===false?"Service unavailable":"Checking service"}</div>
        <div className="sidebarAccount"><div><b>{user?.displayName||"Parent"}</b><small>{user?.email||""}</small></div><button className="iconButton" onClick={logout} aria-label="Log out"><Icon name="logout"/></button></div>
      </div>
    </aside>
    <main className="main" id="main-content">
      <header className="topbar"><div className="topbarLeft"><button className="menuButton iconButton" onClick={()=>setOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbarTitle">Parent workspace</div></div><div className="topbarRight"><div className={`connectionState ${realtime.status==="live"?"up":realtime.status==="offline"?"down":"checking"}`} title={realtime.lastEventAt?`Last realtime event ${new Date(realtime.lastEventAt).toLocaleTimeString()}`:"Realtime connection"}><span className="serviceDot" />{realtime.status==="live"?"Live":realtime.status==="offline"?"Offline":"Reconnecting"}</div><div className="topbarAvatar" aria-label={user?.displayName||"Parent"}>{String(user?.displayName||"P").slice(0,1).toUpperCase()}</div></div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}

export default function Shell({children}:{children:ReactNode}){
  return <RealtimeProvider><ShellContent>{children}</ShellContent></RealtimeProvider>;
}
