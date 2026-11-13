import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["node:sqlite"],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.join(process.cwd(), "src"),
    };
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("node:sqlite");
    }
    return config;
  },
};

export default nextConfig;
