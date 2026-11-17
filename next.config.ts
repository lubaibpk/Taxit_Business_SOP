import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "15mb" }, // ERP exports and logos are uploaded through server actions
  },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
