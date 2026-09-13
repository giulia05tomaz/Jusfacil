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
  // Private local persistence/credentials must never become deployment assets.
  outputFileTracingExcludes: {
    "*": ["./.artifacts/**/*", "./.evidence-originals/**/*", "./.env*", "./serviceAccount*.json", "./service-account*.json", "./firebase-admin*.json", "./credentials*.json", "./*.pem"],
  },
  outputFileTracingIncludes: {
    "/api/cases/*/drafts/*/artifact": ["./scripts/append_zip_evidence_to_docx.py", "./scripts/render_petition_page.py", "./assets/petition-layout.docx"],
    "/api/cases/*/evidence-package/docx": ["./scripts/append_zip_evidence_to_docx.py", "./assets/petition-layout.docx"],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
