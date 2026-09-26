import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_WEB_ORIGIN || "http://localhost:3000";
  return { rules: { userAgent: "*", allow: ["/"] }, sitemap: `${base.replace(/\/$/, "")}/sitemap.xml` };
}
