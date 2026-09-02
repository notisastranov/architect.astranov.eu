#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] ?? "http://127.0.0.1:8080/poster.html";
const out = process.argv[3] ?? "/workspace/public/poster.png";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 1200, height: 1700 },
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const sheet = page.locator(".sheet");
await sheet.screenshot({ path: out, type: "png" });
await sheet.screenshot({ path: "/workspace/screenshots/product-poster.png", type: "png" });
const box = await sheet.boundingBox();
console.log(JSON.stringify({ ok: true, out, box }));
await browser.close();
