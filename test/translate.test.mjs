import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const script = await readFile(new URL("../kleinanzeigen-translate.user.js", import.meta.url), "utf8");
const url = process.argv[2] || "https://www.kleinanzeigen.de/";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ locale: "de-DE" });
let requests = 0;
await page.route("https://translate.googleapis.com/**", (route) => {
  requests++;
  const q = new URL(route.request().url()).searchParams.get("q");
  const body = [q.split("\n").map((line, i, all) => ["EN:" + line + (i < all.length - 1 ? "\n" : ""), line])];
  route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.addScriptTag({ content: script });
await page.waitForTimeout(1500);

const stats = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let total = 0, translated = 0;
  const left = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const p = n.parentElement;
    if (!p || p.closest("script,style,noscript,textarea,code,pre,svg") || !/\p{L}{2,}/u.test(n.nodeValue)) continue;
    total++;
    if (n.nodeValue.includes("EN:")) translated++;
    else left.push(n.nodeValue.trim());
  }
  return { total, translated, left: left.slice(0, 10), lang: document.documentElement.lang };
});
console.log(stats, "requests:", requests);
assert.equal(stats.lang, "en");
assert.ok(stats.translated / stats.total > 0.95, "most text nodes translated");
assert.ok(!(await page.evaluate(() => document.body.innerText.includes("EN:EN:"))), "no double translation");

await page.evaluate(() => {
  const div = document.createElement("div");
  div.id = "late";
  div.textContent = "Neue Anzeige";
  document.body.append(div);
});
await page.waitForTimeout(800);
assert.equal(await page.textContent("#late"), "EN:Neue Anzeige");

await browser.close();
console.log("ok");
