import { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="pageHeader"><div><div className="eyebrowLine">{eyebrow || "Parent console"}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="pageHeaderActions">{actions}</div>}</div>;
}
