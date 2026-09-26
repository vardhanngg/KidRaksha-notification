"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

export function Icon({ name, size = 18, stroke = 1.9 }: { name: string; size?: number; stroke?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, ReactNode> = {
    inbox: <><path d="M4 5h16v14H4z"/><path d="M7 13h2l1 2h4l1-2h2"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    device: <><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18.5h4"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-1.7 1.7-.06-.06A1.7 1.7 0 0 0 16.16 18a1.7 1.7 0 0 0-1 .98 1.7 1.7 0 0 0-.16.74V20h-2.4v-.28a1.7 1.7 0 0 0-1.13-1.58A1.7 1.7 0 0 0 9.6 18a1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 6.36 15a1.7 1.7 0 0 0-.98-1 1.7 1.7 0 0 0-.74-.16H4.3v-2.4h.28A1.7 1.7 0 0 0 6.16 10.3 1.7 1.7 0 0 0 6 9.56a1.7 1.7 0 0 0-.5-.82L5.43 8.7l1.7-1.7.06.06A1.7 1.7 0 0 0 9 7.4a1.7 1.7 0 0 0 1-.98 1.7 1.7 0 0 0 .16-.74V5h2.4v.68a1.7 1.7 0 0 0 1.13 1.58 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 17.64 10a1.7 1.7 0 0 0 .98 1 1.7 1.7 0 0 0 .74.16h.34v2.4h-.28a1.7 1.7 0 0 0-1.58 1.13Z"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    arrowRight: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    arrowLeft: <><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    x: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/></>,
    filter: <><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    trash: <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5"/><path d="M14 11v5"/></>,
    logout: <><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"/><path d="M13 8l4 4-4 4"/><path d="M17 12H9"/></>,
    menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M20 20v-4h-4"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7.5h.01"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    spark: <><path d="m12 2 1.3 4.3L18 8l-4.7 1.7L12 14l-1.3-4.3L6 8l4.7-1.7L12 2Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/></>,
    eye: <><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    external: <><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/></>,
    chevronDown: <path d="m6 9 6 6 6-6"/>,
    chevronRight: <path d="m9 18 6-6-6-6"/>,
    alert: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.info}</svg>;
}

export function StatusDot({ status }: { status: "online" | "offline" | "warning" | "neutral" }) {
  return <span className={`statusDot ${status}`} aria-hidden="true" />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon = "inbox", title, body, action }: { icon?: string; title: string; body: string; action?: ReactNode }) {
  return <div className="emptyState"><div className="emptyIcon"><Icon name={icon} size={22}/></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function Toast({ message, tone = "success", onClose }: { message: string; tone?: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => { const id = window.setTimeout(onClose, 3800); return () => window.clearTimeout(id); }, [onClose]);
  return <div className={`toast ${tone}`} role={tone === "error" ? "alert" : "status"}><Icon name={tone === "success" ? "checkCircle" : tone === "error" ? "alert" : "info"} size={18}/><span>{message}</span><button className="iconButton" onClick={onClose} aria-label="Dismiss notification"><Icon name="x" size={16}/></button></div>;
}

export function ConfirmDialog({ open, title, body, confirmLabel, danger = false, busy = false, onCancel, onConfirm }: { open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return <div className="modalBackdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}><div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" tabIndex={-1}><div className="modalIcon"><Icon name={danger ? "alert" : "info"} size={22}/></div><h2 id="confirm-title">{title}</h2><p id="confirm-body">{body}</p><div className="modalActions"><button className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button><button className={`btn ${danger ? "dangerSolid" : "accent"}`} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button></div></div></div>;
}

export function ReauthDialog({ open, title, body, confirmLabel, danger = false, busy = false, onCancel, onConfirm }: { open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onCancel: () => void; onConfirm: (password: string) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [password, setPassword] = useState("");
  useEffect(() => { if (!open) { setPassword(""); return; } dialogRef.current?.focus(); }, [open]);
  if (!open) return null;
  return <div className="modalBackdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}><div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="reauth-title" aria-describedby="reauth-body" tabIndex={-1}><div className="modalIcon"><Icon name="shield" size={22}/></div><h2 id="reauth-title">{title}</h2><p id="reauth-body">{body}</p><label className="field"><span>Password</span><input autoFocus className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && password && !busy) onConfirm(password); }} /></label><div className="modalActions"><button className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button><button className={`btn ${danger ? "dangerSolid" : "accent"}`} onClick={() => onConfirm(password)} disabled={busy || !password}>{busy ? "Working…" : confirmLabel}</button></div></div></div>;
}
