import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@sparticuz/chromium",
    "puppeteer-core",
  ],
};

export default nextConfig;
