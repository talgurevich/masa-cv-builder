import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/paths";

const nextConfig: NextConfig = {
  // Served at https://members.masaelhaofek.co.il/cv (the members' site forwards /cv here).
  basePath: BASE_PATH,
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "@sparticuz/chromium",
    "puppeteer-core",
  ],
};

export default nextConfig;
