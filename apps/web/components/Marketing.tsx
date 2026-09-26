
import Link from "next/link";
import Brand from "./Brand";

export default function Marketing() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="container">
          <nav className="heroNav">
            <Brand dark />
            <div className="row">
              <Link className="btn ghost" href="/login" style={{ color:"#fff", borderColor:"#303747" }}>Log in</Link>
              <Link className="btn accent" href="/signup">Start free</Link>
            </div>
          </nav>
          <div className="heroCopy">
            <span className="eyebrow">Notification sharing, built for parents</span>
            <h1>Know what reaches your child's phone.</h1>
            <p>
              LittleWatch gives parents a focused, transparent way to see notifications
              their child chooses to share — with secure pairing, a clean dashboard and clear controls.
            </p>
            <div className="row heroActions">
              <Link className="btn accent" href="/signup">Start 7-day trial</Link>
              <Link className="btn ghost" href="/pricing" style={{ color:"#fff", borderColor:"#303747" }}>See plans</Link>
            </div>
          </div>

          <div className="productFrame">
            <div className="mockDashboard">
              <aside className="mockSide">
                <div style={{fontWeight:800,color:"#fff"}}>LittleWatch</div>
                <div style={{marginTop:30,display:"grid",gap:13,fontSize:12}}>
                  <div style={{color:"#fff"}}>Overview</div><div>Notifications</div><div>Devices</div><div>Billing</div>
                </div>
              </aside>
              <section className="mockMain">
                <div style={{fontSize:12,color:"#777",fontWeight:700}}>OVERVIEW</div>
                <h3 style={{margin:"8px 0 20px"}}>Good morning, Priya</h3>
                <div className="mockGrid">
                  <div className="mockMetric"><div style={{fontSize:11,color:"#858d9c"}}>TODAY</div><strong style={{fontSize:25}}>86</strong><div style={{fontSize:11,color:"#46a878"}}>notifications</div></div>
                  <div className="mockMetric"><div style={{fontSize:11,color:"#858d9c"}}>UNREAD</div><strong style={{fontSize:25}}>12</strong><div style={{fontSize:11,color:"#858d9c"}}>across 1 device</div></div>
                  <div className="mockMetric"><div style={{fontSize:11,color:"#858d9c"}}>DEVICE</div><strong style={{fontSize:16}}>Arjun's phone</strong><div style={{fontSize:11,color:"#46a878"}}>● Online</div></div>
                </div>
                <div style={{marginTop:18,padding:16,background:"#fff",border:"1px solid #e5e8ef",borderRadius:13,textAlign:"left"}}>
                  <div style={{fontSize:12,color:"#7e8795",fontWeight:750}}>LATEST NOTIFICATIONS</div>
                  <div style={{padding:"13px 0",borderBottom:"1px solid #eee"}}><b>WhatsApp</b><div style={{fontSize:12,color:"#7e8795"}}>School group · Can you send the notes?</div></div>
                  <div style={{padding:"13px 0"}}><b>YouTube</b><div style={{fontSize:12,color:"#7e8795"}}>New upload from a subscribed channel</div></div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="section light">
        <div className="container">
          <span className="eyebrow">Designed as a product, not a script</span>
          <h2>Simple for parents. Explicit on the child's device.</h2>
          <p className="muted" style={{maxWidth:700,lineHeight:1.7}}>
            The platform is built around an intentional consent flow, secure device pairing,
            durable delivery and privacy controls from the database to the dashboard.
          </p>
          <div className="featureGrid">
            {[
              ["01","Secure by default","Session authentication, hashed device credentials and encrypted notification content."],
              ["02","Reliable delivery","Local child-device queue, retry logic, duplicate protection and realtime parent updates."],
              ["03","Clear control","Parents can revoke a device, change retention and manage the subscription without hidden settings."]
            ].map(([n,t,d]) => <article key={n} className="card feature"><div className="eyebrow">{n}</div><h3>{t}</h3><p>{d}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section" style={{background:"#f1f0ff"}}>
        <div className="container">
          <div style={{maxWidth:720}}>
            <span className="eyebrow">Built for one focused use case</span>
            <h2>A calmer parent dashboard.</h2>
            <p className="muted" style={{lineHeight:1.7}}>
              No camera controls. No location. No clutter from unrelated monitoring features.
              LittleWatch focuses on notification sharing and makes the state of that sharing visible.
            </p>
          </div>
          <div className="row" style={{marginTop:28}}>
            <Link className="btn primary" href="/signup">Create your account</Link>
            <Link className="btn ghost" href="/privacy">Read privacy commitments</Link>
          </div>
        </div>
      </section>

      <footer className="footer" style={{background:"#fff"}}>
        <div className="container between">
          <span>© 2026 LittleWatch</span>
          <div className="row"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/pricing">Pricing</Link></div>
        </div>
      </footer>
    </main>
  );
}
