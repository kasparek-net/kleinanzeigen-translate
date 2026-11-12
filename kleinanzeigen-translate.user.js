// ==UserScript==
// @name         Kleinanzeigen in English
// @namespace    https://github.com/kasparek-net
// @description  Automatically translates Kleinanzeigen.de from German to English, hides ads and adds a dark mode
// @version      1.2
// @license      MIT
// @match        *://*.kleinanzeigen.de/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @connect      translate.googleapis.com
// @homepageURL  https://github.com/kasparek-net/kleinanzeigen-translate
// @updateURL    https://raw.githubusercontent.com/kasparek-net/kleinanzeigen-translate/main/kleinanzeigen-translate.user.js
// @downloadURL  https://raw.githubusercontent.com/kasparek-net/kleinanzeigen-translate/main/kleinanzeigen-translate.user.js
// ==/UserScript==

(function () {
  const ADS = [
    ".sticky-advertisement",
    ".liberty-filled:not(.liberty-gallery-slot)",
    "[id^='google_ads_iframe']",
    "#app-install-interstitial",
    ".j-liberty-wrapper:not(.liberty-gallery-slot)",
    ".liberty-hide-unfilled",
    "li:has(> .liberty-hide-unfilled)",
    ".bannerplacement-fullwidth:not(.liberty-gallery-slot *)",
    ".bannerplacement-sticky",
    ".adlist--item-banner",
    "[id^='srpb-']",
    "[id*='-sky-']",
    "[id$='billboard']",
    "#viewad-sidebar-banner",
  ];
  const adSelector = ADS.join(",\n");
  const adStyle = document.createElement("style");
  adStyle.textContent =
    adSelector +
    " { display: none !important; }\n" +
    ".site-base--left-banner, .site-base--right-banner { visibility: hidden !important; }\n" +
    // Kleinanzeigen has no dark theme, so the page is inverted and media flipped back.
    // Modal dialogs live in the top layer outside the root filter and need their own.
    `@media (prefers-color-scheme: dark) {
      html, dialog:modal, :popover-open { filter: invert(0.9) hue-rotate(180deg) !important; }
      html { background: #fff !important; }
      img, video, iframe, canvas, picture, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
      picture img, [style*="background-image"] img { filter: none !important; }
      dialog:modal::backdrop { background: rgba(0, 0, 0, 0.6) !important; }
    }`;
  if (document.documentElement) document.documentElement.append(adStyle);
  else
    new MutationObserver((_, o) => {
      if (!document.documentElement) return;
      document.documentElement.append(adStyle);
      o.disconnect();
    }).observe(document, { childList: true });

  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG"]);
  const ATTRS = ["placeholder", "title", "aria-label"];
  const BATCH_CHARS = 1800;

  const cache = new Map();
  const done = new WeakMap();
  const pending = new Map();

  const needsTranslation = (s) => /\p{L}{2,}/u.test(s) && !/^\s*(https?:|www\.|[\w.-]+@)/.test(s);

  function request(text) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=en&dt=t&q=" +
      encodeURIComponent(text);
    if (typeof GM !== "undefined" && GM.xmlHttpRequest) {
      return new Promise((resolve, reject) =>
        GM.xmlHttpRequest({
          method: "GET",
          url,
          onload: (r) => (r.status === 200 ? resolve(JSON.parse(r.responseText)) : reject(r.status)),
          onerror: reject,
        })
      );
    }
    return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  }

  async function translate(text) {
    const data = await request(text).catch(() => new Promise((r) => setTimeout(r, 1000)).then(() => request(text)));
    return data[0].map((part) => part[0]).join("");
  }

  async function translateBatch(texts) {
    const joined = await translate(texts.join("\n"));
    const lines = joined.split("\n");
    if (lines.length === texts.length) return lines.map((l) => l.trim());
    return Promise.all(texts.map(translate));
  }

  function collect(root) {
    const items = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (SKIP.has(node.nodeName.toUpperCase()) || node.isContentEditable || node.matches(adSelector))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.nodeValue;
      if (done.get(node) === text || !needsTranslation(text)) continue;
      items.push({ node, text });
    }
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll("*")] : [];
    for (const el of elements) {
      for (const attr of ATTRS) {
        const text = el.getAttribute(attr);
        if (!text || !needsTranslation(text)) continue;
        const key = "translated" + attr;
        if (el[key] === text) continue;
        items.push({ el, attr, text });
      }
    }
    return items;
  }

  function apply(item, translated) {
    if (item.node) {
      if (item.node.nodeValue !== item.text) return;
      const [, lead, , trail] = item.text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const value = lead + translated + trail;
      item.node.nodeValue = value;
      done.set(item.node, value);
    } else {
      if (item.el.getAttribute(item.attr) !== item.text) return;
      item.el.setAttribute(item.attr, translated);
      item.el["translated" + item.attr] = translated;
    }
  }

  async function run(root) {
    const items = collect(root);
    const missing = [];
    for (const item of items) {
      const key = item.text.trim().replace(/\s+/g, " ");
      item.key = key;
      if (!cache.has(key) && !pending.has(key) && !missing.includes(key)) missing.push(key);
    }

    const batches = [];
    let batch = [];
    let size = 0;
    for (const key of missing) {
      if (size + key.length > BATCH_CHARS && batch.length) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(key);
      size += key.length + 1;
    }
    if (batch.length) batches.push(batch);

    for (const keys of batches) {
      const promise = translateBatch(keys).then((results) => {
        keys.forEach((k, i) => {
          cache.set(k, results[i] || k);
          pending.delete(k);
        });
      });
      keys.forEach((k) => pending.set(k, promise));
      promise.catch((e) => {
        keys.forEach((k) => pending.delete(k));
        console.warn("[kleinanzeigen-translate]", e);
      });
    }

    for (const item of items) {
      if (cache.has(item.key)) {
        apply(item, cache.get(item.key));
        continue;
      }
      pending.get(item.key)?.then(() => apply(item, cache.get(item.key)), () => {});
    }
  }

  let queued = new Set();
  let timer;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") queued.add(m.target.parentNode);
      else if (m.type === "attributes") queued.add(m.target);
      else m.addedNodes.forEach((n) => queued.add(n.nodeType === Node.TEXT_NODE ? n.parentNode : n));
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const roots = queued;
      queued = new Set();
      roots.forEach((r) => r && r.isConnected && run(r));
    }, 200);
  });

  function start() {
    document.documentElement.lang = "en";
    run(document.body);
    document.title && translate(document.title).then((t) => (document.title = t), () => {});
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
