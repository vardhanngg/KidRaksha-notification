import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.PUBLIC_WEB_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
  const paths = ["/", "/pricing", "/privacy", "/terms", "/delete-account", "/login", "/signup"];
  return paths.map(path => ({ url: `${base}${path}`, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.5 }));
}
