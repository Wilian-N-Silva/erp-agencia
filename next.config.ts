import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  async redirects() {
    return [
      {
        source: "/design",
        destination: "/design-prototype/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
