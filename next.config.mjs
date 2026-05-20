const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST || "127.0.0.1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Required so dev server resolves assets when loaded inside Tauri WebView2
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
};

export default nextConfig;