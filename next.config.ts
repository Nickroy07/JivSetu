import type { NextConfig } from "next";

// Baseline hardening headers. A strict Content-Security-Policy is intentionally not set
// here yet: it needs testing against Next's inline scripts and the API origin.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Microphone is needed for voice input; camera is used for document photos.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=()" },
];

// Local Windows machines can run out of memory with many parallel build workers.
// Set BUILD_CPUS=1 for `npm run build` there; unset (default) keeps Vercel unchanged.
const buildCpus = Number(process.env.BUILD_CPUS);

const nextConfig: NextConfig = {
  ...(buildCpus > 0 ? { experimental: { cpus: buildCpus, workerThreads: false } } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/doctor",
        permanent: false,
      },
      {
        source: "/doctor/dashboard",
        destination: "/doctor",
        permanent: false,
      },
      {
        source: "/monitoring",
        destination: "/doctor/monitoring",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
