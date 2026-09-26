import Link from "next/link";

const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME || "KidSuraksha";
const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@example.com";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
const effectiveDate = "September 26, 2026";

export default function Privacy(){return <main className="legalPage"><div className="legalCard">
  <div className="eyebrow">KidSuraksha</div><h1>Privacy Policy</h1>
  <p className="muted">Effective {effectiveDate}. This policy explains what KidSuraksha collects, why it is processed, how long it is retained, and the controls available to the account owner and monitored-device user.</p>
  <h2>1. Who this policy applies to</h2>
  <p>This policy applies to the KidSuraksha website, parent account, backend services, and the KidSuraksha Android child-device application. KidSuraksha is designed for transparent parental notification sharing. It is not designed for secret monitoring of adults.</p>
  <h2>2. Information we process</h2>
  <p><b>Parent account:</b> name, email address, password verifier, policy acceptance timestamps, subscription state and account security records.</p>
  <p><b>Paired device:</b> generated device identifier, device name, Android app version, sharing state, connection/sync timestamps and reliability counters.</p>
  <p><b>Notification data:</b> application/package metadata, notification timestamps and notification classification. Notification title/body are processed only after the device user separately enables message-content sharing. Android may redact some notification content, and KidSuraksha does not bypass those protections.</p>
  <p><b>Security/operations:</b> request IDs, audit events, rate-limit/security events and limited diagnostic metadata needed to protect and operate the service.</p>
  <p>KidSuraksha does not request or use camera, microphone, location, contacts, SMS, call logs, advertising identifiers or accessibility/VPN surveillance for the notification-sharing product.</p>
  <h2>3. Why we use information</h2>
  <p>We use the information above to provide the notification-sharing service, authenticate accounts and devices, synchronize notifications, maintain reliability, process subscriptions, prevent abuse, support users, and comply with legal obligations.</p>
  <h2>4. Sharing</h2>
  <p>Notification data is made available to the authorized parent account associated with the paired device. We do not sell notification content or use it for advertising. Service providers may process limited infrastructure or payment information only as needed to provide the service and subject to their own agreements and policies.</p>
  <h2>5. Security</h2>
  <p>KidSuraksha uses HTTPS for network transport, authenticated sessions, device-token hashing, encrypted notification storage, Android Keystore-backed device credentials, restricted production infrastructure, and access controls designed to keep one family's data isolated from another family's data.</p>
  <h2>6. Retention and deletion</h2>
  <p>Notification retention is controlled by the parent account's plan and selected retention period. Expired notifications are purged by the service. Account deletion removes the account, paired devices, notification history, sessions, and tenant audit records managed by KidSuraksha, subject to narrowly applicable legal retention requirements.</p>
  <p>Users can request or initiate deletion from the <Link href="/delete-account" className="accentLink">account-deletion page</Link> and from the signed-in Settings page. Data exports require recent reauthentication.</p>
  <h2>7. Child-device control and disclosure</h2>
  <p>The Android device user must enable Android Notification Access and separately choose whether message content may be shared. While sharing is active, KidSuraksha displays a persistent status notification. Sharing can be paused or Notification Access can be removed from the device.</p>
  <h2>8. Account recovery and security notices</h2>
  <p>We use your email address to send password-reset messages when requested. Reset links are short-lived, one-time tokens. Security and account-service emails are not advertising messages.</p>
  <h2>9. Children and families</h2>
  <p>KidSuraksha is a parental-monitoring service. Parents or guardians are responsible for using the service lawfully and for providing any disclosures or consent required in their jurisdiction. The Android product does not intentionally collect a child's precise location, contacts, phone logs, SMS or advertising identifiers.</p>
  <h2>10. Your choices</h2>
  <p>You can change notification-content sharing, pause sharing, unpair devices, export account data, change your password, and delete your account using the available controls.</p>
  <h2>11. Contact</h2>
  <p>Privacy: <a href={`mailto:${privacyEmail}`} className="accentLink">{privacyEmail}</a><br/>Support: <a href={`mailto:${supportEmail}`} className="accentLink">{supportEmail}</a><br/>{legalName}</p>
  <h2>12. Policy updates</h2>
  <p>We may update this policy when our service, legal obligations or data practices change. The effective date above identifies the current version.</p>
  <p className="small muted" style={{marginTop:26}}>This public policy is a product template and must be reviewed by the service operator for the final legal entity, jurisdiction, contact details and actual production data flows before launch.</p>
  <p style={{marginTop:24}}><Link href="/delete-account" className="accentLink">Account deletion</Link> · <Link href="/terms" className="accentLink">Terms</Link></p>
</div></main>}
