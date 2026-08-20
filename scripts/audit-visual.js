import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const dir = path.join(process.cwd(), "docs/screenshots/visual-audit");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/login ...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForSelector("#auth-tab-entrar");

  const tabs = [
    { id: "auth-tab-entrar", name: "ENTRAR", file: "auth-entrar-active.png" },
    { id: "auth-tab-cadastrar", name: "CADASTRAR", file: "auth-cadastrar-active.png" },
    { id: "auth-tab-advogado", name: "ADVOGADO", file: "auth-advogado-active.png" },
  ];

  for (const activeTab of tabs) {
    console.log(`\n=== ACTIVATING ${activeTab.name} ===`);
    await page.click(`#${activeTab.id}`);
    await page.waitForTimeout(300);

    for (const t of tabs) {
      const styles = await page.$eval(`#${t.id}`, (el) => {
        const cs = window.getComputedStyle(el);
        return {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          opacity: cs.opacity,
          fontWeight: cs.fontWeight,
          borderRadius: cs.borderRadius,
        };
      });
      const isActive = t.id === activeTab.id;
      console.log(`[${t.name}] Status: ${isActive ? "ACTIVE" : "INACTIVE"}`);
      console.log(`  -> bg: ${styles.backgroundColor} | color: ${styles.color} | weight: ${styles.fontWeight} | radius: ${styles.borderRadius}`);
    }

    const screenshotPath = path.join(dir, activeTab.file);
    const selectorBox = await page.$("#auth-tab-selector");
    if (selectorBox) {
      await selectorBox.screenshot({ path: screenshotPath });
      console.log(`  Screenshot saved to ${activeTab.file}`);
    }
  }

  await browser.close();
  console.log("\nAll visual tests and screenshots completed successfully!");
}

main().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
