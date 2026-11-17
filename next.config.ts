import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "15mb" }, // ERP exports and logos are uploaded through server actions
  },
  serverExternalPackages: ["exceljs", "@sparticuz/chromium", "puppeteer-core"],
  // the serverless Chromium binary is loaded from disk at runtime, so ship it with the PDF route
  outputFileTracingIncludes: {
    "/api/reports/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
