import Link from "next/link";
import { Icon } from "../../components/ui/UI";

const plans = [
  {
    name: "Weekly",
    price: "₹49",
    period: "/ week",
    devices: "1 child device",
    retention: "7 days",
    desc: "Flexible weekly access for one child device.",
    features: ["Secure device pairing", "Notification inbox", "Realtime parent updates", "7-day notification retention"]
  },
  {
    name: "Monthly",
    price: "₹199",
    period: "/ month",
    devices: "Up to 2 child devices",
    retention: "30 days",
    desc: "Monthly access for up to two child devices.",
    features: ["Secure device pairing", "Notification inbox", "Realtime parent updates", "30-day notification retention"]
  }
];

export default function Pricing() {
  return (
    <main className="landing">
      <div className="container">
        <div style={{ padding: "30px 0" }}>
          <Link href="/" style={{ color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13 }}>
            <Icon name="arrowLeft" size={15} /> KidSuraksha
          </Link>
        </div>

        <div style={{ textAlign: "center", padding: "48px 0 55px" }}>
          <div className="eyebrow">Pricing</div>
          <h1 style={{ fontSize: "clamp(44px,7vw,68px)", letterSpacing: "-.06em", margin: "10px 0 15px" }}>
            Simple family pricing.
          </h1>
          <p style={{ color: "#aab2c0", maxWidth: 650, margin: "0 auto", lineHeight: 1.75, fontSize: 15 }}>
            Start with a 7-day trial. Choose weekly access for one child or monthly access for up to two children.
          </p>
        </div>

        <div className="billingGrid" style={{ paddingBottom: 28 }}>
          {plans.map((p) => (
            <article className="card planCard" key={p.name}>
              <div className="planBadge">{p.name}</div>
              <div className="planPrice" style={{ marginTop: 7 }}>
                {p.price}<span> {p.period}</span>
              </div>
              <div className="planSummary">{p.desc}</div>
              <div className="featureList">
                {p.features.map((f) => (
                  <div key={f}><Icon name="check" size={14} />{f}</div>
                ))}
              </div>
              <div className="small muted" style={{ marginBottom: 13 }}>
                {p.devices} · {p.retention}
              </div>
              <Link href="/signup" className="btn accent" style={{ width: "100%" }}>
                Start trial <Icon name="arrowRight" size={15} />
              </Link>
            </article>
          ))}
        </div>

        <div className="card feature" style={{ background: "#151923", borderColor: "#2a3040", color: "#fff", marginBottom: 75 }}>
          <div className="eyebrow">Billing transparency</div>
          <h3 style={{ fontSize: 18 }}>Weekly and monthly only.</h3>
          <p style={{ color: "#aeb6c3" }}>
            KidSuraksha currently offers a 7-day trial followed by either ₹49 billed weekly for one child device or ₹199 billed monthly for up to two child devices. There is no annual subscription plan.
          </p>
        </div>

        <footer className="footer">
          <div className="container between">
            <span>© 2026 KidSuraksha</span>
            <div className="row">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/login">Log in</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
