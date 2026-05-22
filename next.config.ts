import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
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
