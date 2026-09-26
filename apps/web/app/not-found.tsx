import Link from "next/link";
import { Icon } from "../components/ui/UI";

export default function NotFound(){return <main className="authPage"><div className="authCard" style={{textAlign:"center"}}><div className="emptyIcon"><Icon name="search"/></div><div className="authKicker">404</div><h1>That page isn't here.</h1><p className="muted">The link may be outdated or the page may have moved.</p><Link href="/" className="btn accent" style={{width:"100%",marginTop:16}}>Back to KidRaksha <Icon name="arrowRight" size={15}/></Link></div></main>}
