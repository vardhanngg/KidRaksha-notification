"use client";

import { useEffect } from "react";
import { Icon } from "../../components/ui/UI";

export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error(error)},[error]);return <div style={{maxWidth:620,margin:"70px auto"}}><div className="card" style={{padding:26,textAlign:"center"}}><div className="emptyIcon" style={{background:"#fff0f2",color:"#b93846"}}><Icon name="alert"/></div><h1 style={{fontSize:24,letterSpacing:"-.04em",margin:"14px 0 8px"}}>Something went wrong.</h1><p className="muted" style={{lineHeight:1.65,fontSize:13}}>KidSuraksha could not load this part of your workspace. Your account and devices have not been changed.</p><div className="row" style={{justifyContent:"center",marginTop:18}}><button className="btn primary" onClick={reset}><Icon name="refresh" size={15}/> Try again</button><a className="btn ghost" href="/dashboard">Back to dashboard</a></div></div></div>}
