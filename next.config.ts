import type { NextConfig } from "next";

// App 100% dinámica (sesión, disponibilidad en vivo): sin cacheComponents.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
