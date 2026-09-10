/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  allowedDevOrigins: [
    "*.run.app",
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.*.*"
  ],
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
