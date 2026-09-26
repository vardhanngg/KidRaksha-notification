
const api = process.env.API_INTERNAL_ORIGIN || "http://localhost:4000";

const scriptSources = ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"];
if (process.env.NODE_ENV !== "production") scriptSources.push("'unsafe-eval'");

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];
if (process.env.NODE_ENV === "production") cspDirectives.push("upgrade-insecure-requests");
const cspHeader = cspDirectives.join("; ");

const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/v1/:path*` }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), payment=()" },
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : [])
        ]
      }
    ];
  }
};

export default nextConfig;
