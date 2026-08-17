// ==UserScript==
// @name              DSH Plugin Radar
// @name:zh-CN        DSH 插件雷达
// @namespace         https://dshmarketplace.dev/
// @version           1.0.0
// @description       Marks DeepSeek Harness plugins on GitHub and npm, and shows the install command that actually works — including the --profile flag DSH requires and cannot run without.
// @description:zh-CN 在 GitHub 和 npm 上标出 DeepSeek Harness 插件，并给出真正能跑的安装命令 —— 带上 DSH 必需的 --profile，少了它装不上。
// @author            DshMarketPlace
// @license           MIT
// @homepageURL       https://github.com/DshMarketPlace/dsh-plugin-radar
// @supportURL        https://github.com/DshMarketPlace/dsh-plugin-radar/issues
// @icon              https://dshmarketplace.dev/brand/icon-192.png
// @match             https://github.com/*
// @match             https://www.npmjs.com/package/*
// @connect           dshmarketplace.dev
// @run-at            document-idle
// @grant             GM_xmlhttpRequest
// @grant             GM_setClipboard
// @grant             GM_addStyle
// @grant             GM_getValue
// @grant             GM_setValue
// @grant             GM_deleteValue
// @grant             GM_listValues
// @grant             GM_registerMenuCommand
// ==/UserScript==

/*
 * Every listing comes from the public catalogue at dshmarketplace.dev. Nothing
 * about you is sent anywhere: the script reads an index of plugin names once
 * every six hours and does the matching in your browser.
 *
 * Source: https://github.com/DshMarketPlace/dsh-plugin-radar
 */

(() => {
  "use strict";

  const SITE = "https://dshmarketplace.dev";
  const INDEX_TTL = 6 * 60 * 60 * 1000;
  const DETAIL_TTL = 24 * 60 * 60 * 1000;
  const DETAIL_CAP = 150;

  // GitHub reserves these first path segments, so none of them can be an owner.
  // The catalogue lookup would reject them anyway; this just skips the work.
  const RESERVED = new Set([
    "topics", "search", "explore", "trending", "collections", "sponsors",
    "marketplace", "settings", "notifications", "codespaces", "orgs", "apps",
    "features", "pricing", "about", "login", "join", "new", "pulls", "issues",
    "dashboard", "account", "organizations", "site", "contact", "security",
  ]);

  const zh = /^zh/i.test(navigator.language || "");

  const T = zh
    ? {
        badge: "DSH 插件",
        copy: "复制",
        copied: "已复制",
        noInstall: "没有一行装得上的命令",
        subpathWhy:
          "插件在仓库子目录里。dsh plugin add 转发给 pnpm，pnpm 把 # 后面当成 git ref，所以 github:owner/repo#subpath 解析不了。照仓库 README 手动装。",
        noNpmWhy: "这个插件没发到 npm，也没有可用的一行安装命令。",
        page: "在 DSH Marketplace 上查看",
        search: "在 DSH Marketplace 上搜索",
        profile: "当前 profile",
        setProfile: "设置 profile 名",
        setProfilePrompt: "你的 DSH profile 名（默认 web）：",
        refresh: "刷新目录缓存",
        refreshed: "缓存已清空，刷新页面即可重新拉取。",
        offline: "拉不到目录数据",
        chipTitle: (c) => `DeepSeek Harness 插件 · ${c}`,
      }
    : {
        badge: "DSH plugin",
        copy: "Copy",
        copied: "Copied",
        noInstall: "No one-line install",
        subpathWhy:
          "The plugin lives in a subdirectory. `dsh plugin add` forwards to pnpm, and pnpm reads everything after `#` as a git ref, so `github:owner/repo#subpath` cannot resolve. Install it by hand, following the repo's README.",
        noNpmWhy:
          "This plugin is not published to npm and has no working one-line install command.",
        page: "View on DSH Marketplace",
        search: "Search DSH Marketplace",
        profile: "Profile",
        setProfile: "Set profile name",
        setProfilePrompt: "Your DSH profile name (default: web):",
        refresh: "Refresh catalogue cache",
        refreshed: "Cache cleared. Reload the page to fetch it again.",
        offline: "Catalogue unavailable",
        chipTitle: (c) => `DeepSeek Harness plugin · ${c}`,
      };

  /* ------------------------------------------------------------------ store */

  const read = (key) => {
    try {
      return JSON.parse(GM_getValue(key, "null"));
    } catch {
      return null;
    }
  };

  const write = (key, value) => GM_setValue(key, JSON.stringify(value));

  /** Keeps the per-plugin cache from growing without bound. */
  function pruneDetails() {
    const keys = GM_listValues().filter((k) => k.startsWith("d:"));
    if (keys.length <= DETAIL_CAP) return;
    keys
      .map((k) => ({ k, at: read(k)?.at ?? 0 }))
      .sort((a, b) => a.at - b.at)
      .slice(0, keys.length - DETAIL_CAP)
      .forEach(({ k }) => GM_deleteValue(k));
  }

  const profile = () => GM_getValue("profile", "web");

  /**
   * The catalogue writes every command against the `web` profile, which is the
   * one a default DSH install creates. Anyone running another one needs the
   * name swapped, and swapping it here beats printing a command they have to
   * edit before it runs.
   */
  const withProfile = (cmd) =>
    cmd.replace(/--profile\s+\S+/, `--profile ${profile()}`);

  /* ----------------------------------------------------------------- network */

  function getJSON(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { accept: "application/json" },
        timeout: 15000,
        onload: (r) => {
          if (r.status < 200 || r.status >= 300) {
            reject(new Error(`HTTP ${r.status}`));
            return;
          }
          try {
            resolve(JSON.parse(r.responseText));
          } catch (e) {
            reject(e);
          }
        },
        onerror: () => reject(new Error("network")),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  /* --------------------------------------------------------------- catalogue */

  function toMaps(payload) {
    const byRepo = new Map();
    const byNpm = new Map();

    for (const [fullName, category, install, path, npm] of payload.plugins) {
      const entry = { fullName, category, install, path, npm };
      const repo = fullName.split("#")[0].toLowerCase();
      const bucket = byRepo.get(repo) ?? [];
      bucket.push(entry);
      byRepo.set(repo, bucket);
      if (npm) byNpm.set(npm.toLowerCase(), entry);
    }

    return { byRepo, byNpm };
  }

  let catalogue = null;

  function loadCatalogue() {
    if (catalogue) return catalogue;

    catalogue = (async () => {
      const cached = read("index");
      if (cached && Date.now() - cached.at < INDEX_TTL) return toMaps(cached.v);

      try {
        const payload = await getJSON(`${SITE}/api/v1/index`);
        write("index", { at: Date.now(), v: payload });
        return toMaps(payload);
      } catch (err) {
        // A stale index still names the same plugins. Failing closed here would
        // make the script look broken every time the network hiccups.
        if (cached) return toMaps(cached.v);
        throw err;
      }
    })();

    return catalogue;
  }

  /** The full record for one listing — summary, risk flags, every install route. */
  async function detail(fullName) {
    const key = `d:${fullName}`;
    const cached = read(key);
    if (cached && Date.now() - cached.at < DETAIL_TTL) return cached.v;

    const res = await getJSON(
      `${SITE}/api/v1/plugins?q=${encodeURIComponent(fullName)}&limit=20`,
    );
    // `q` is a substring match, so a monorepo returns its siblings too.
    const hit = res.results.find((r) => r.fullName === fullName) ?? null;
    write(key, { at: Date.now(), v: hit });
    pruneDetails();
    return hit;
  }

  const linkFor = (entry) =>
    entry.path
      ? `${SITE}${entry.path}`
      : `${SITE}/plugins?q=${encodeURIComponent(entry.fullName)}`;

  /* ------------------------------------------------------------------ pieces */

  const el = (tag, props = {}, kids = []) => {
    const node = Object.assign(document.createElement(tag), props);
    for (const kid of kids) node.append(kid);
    return node;
  };

  function commandRow(cmd) {
    const full = withProfile(cmd);
    const button = el("button", { className: "dshr-copy", textContent: T.copy });

    button.addEventListener("click", (event) => {
      event.preventDefault();
      GM_setClipboard(full, "text");
      button.textContent = T.copied;
      button.classList.add("is-done");
      setTimeout(() => {
        button.textContent = T.copy;
        button.classList.remove("is-done");
      }, 1600);
    });

    return el("div", { className: "dshr-cmd" }, [
      el("code", { textContent: full }),
      button,
    ]);
  }

  function noteRow(text) {
    return el("p", { className: "dshr-note", textContent: text });
  }

  /* -------------------------------------------------------------- repo card */

  function card(entries) {
    const root = el("section", { className: "dshr-card" });
    if (!getComputedStyle(document.documentElement).getPropertyValue("--fgColor-default")) {
      root.dataset.dshrTheme = "auto";
    }

    const head = el("div", { className: "dshr-head" }, [
      el("a", {
        className: "dshr-brand",
        href: SITE,
        target: "_blank",
        rel: "noopener",
        textContent: T.badge,
      }),
    ]);
    if (entries[0].category) {
      head.append(el("span", { className: "dshr-cat", textContent: entries[0].category }));
    }
    root.append(head);

    for (const entry of entries) {
      const block = el("div", { className: "dshr-block" });

      if (entries.length > 1) {
        block.append(
          el("div", { className: "dshr-sub", textContent: entry.fullName.split("#")[1] ?? "." }),
        );
      }

      const body = el("p", { className: "dshr-summary" });
      block.append(body);

      block.append(
        entry.install
          ? commandRow(entry.install)
          : noteRow(entry.fullName.includes("#") ? T.subpathWhy : T.noNpmWhy),
      );

      const flags = el("div", { className: "dshr-flags" });
      block.append(flags);

      block.append(
        el("a", {
          className: "dshr-link",
          href: linkFor(entry),
          target: "_blank",
          rel: "noopener",
          textContent: entry.path ? T.page : T.search,
        }),
      );

      root.append(block);

      // Progressive enrichment: the card is complete without this, so a failed
      // or slow detail request costs nothing visible.
      detail(entry.fullName)
        .then((full) => {
          if (!full) return;
          const summary = (zh && full.summaryZh) || full.summary;
          if (summary) body.textContent = summary;
          for (const flag of full.riskFlags ?? []) {
            flags.append(el("span", { className: "dshr-flag", textContent: flag }));
          }
        })
        .catch(() => {});
    }

    return root;
  }

  function mountRepoCard(entries) {
    if (document.querySelector(".dshr-card")) return;

    const node = card(entries);
    const pane = document.querySelector('[class*="PageLayout-Pane-"]');

    if (pane) {
      node.classList.add("dshr-in-pane");
      pane.prepend(node);
      return;
    }

    const readme = document.querySelector("article.markdown-body");
    if (readme?.parentElement) {
      readme.parentElement.insertBefore(node, readme);
      return;
    }

    document.querySelector("#repository-container-header")?.after(node);
  }

  /* ------------------------------------------------------------------- chips */

  function chip(entry) {
    const link = el("a", {
      className: "dshr-chip",
      href: linkFor(entry),
      target: "_blank",
      rel: "noopener",
      textContent: "DSH",
      title: entry.install
        ? `${T.chipTitle(entry.category || "plugin")}\n${withProfile(entry.install)}`
        : T.chipTitle(entry.category || "plugin"),
    });
    link.addEventListener("click", (event) => event.stopPropagation());
    return link;
  }

  function markLinks(byRepo) {
    const here = repoFromPath(location.pathname);

    for (const anchor of document.querySelectorAll('a[href^="/"], a[href^="https://github.com/"]')) {
      if (anchor.dataset.dshr || anchor.closest(".dshr-card")) continue;

      let key;
      try {
        key = repoFromPath(new URL(anchor.href, location.origin).pathname);
      } catch {
        continue;
      }
      if (!key || key === here) continue;

      const entries = byRepo.get(key);
      if (!entries) continue;

      anchor.dataset.dshr = "1";
      anchor.after(chip(entries[0]));
    }
  }

  function repoFromPath(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    if (RESERVED.has(parts[0].toLowerCase())) return null;
    return `${parts[0]}/${parts[1]}`.toLowerCase().replace(/\.git$/, "");
  }

  /* --------------------------------------------------------------------- npm */

  function mountNpmCard(entry) {
    if (document.querySelector(".dshr-card")) return;

    const node = card([entry]);
    const heading = [...document.querySelectorAll("h3")].find(
      (h) => h.textContent.trim() === "Install",
    );

    if (heading?.parentElement) {
      heading.parentElement.insertBefore(node, heading);
      return;
    }

    document.querySelector("#readme")?.prepend(node);
  }

  /* ------------------------------------------------------------------ driver */

  async function run() {
    let maps;
    try {
      maps = await loadCatalogue();
    } catch {
      return;
    }

    if (location.hostname === "www.npmjs.com") {
      const name = decodeURIComponent(location.pathname.replace(/^\/package\//, ""));
      const entry = maps.byNpm.get(name.toLowerCase());
      if (entry) mountNpmCard(entry);
      return;
    }

    const here = repoFromPath(location.pathname);
    const entries = here && maps.byRepo.get(here);
    if (entries) mountRepoCard(entries);

    markLinks(maps.byRepo);
  }

  let timer = null;
  let seen = location.href;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  new MutationObserver(() => {
    if (location.href !== seen) {
      seen = location.href;
      document.querySelectorAll(".dshr-card, .dshr-chip").forEach((n) => n.remove());
      document.querySelectorAll("[data-dshr]").forEach((n) => delete n.dataset.dshr);
    }
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });

  GM_registerMenuCommand(`${T.setProfile} (${T.profile}: ${profile()})`, () => {
    const next = prompt(T.setProfilePrompt, profile());
    if (next && /^[\w.-]+$/.test(next.trim())) {
      GM_setValue("profile", next.trim());
      location.reload();
    }
  });

  GM_registerMenuCommand(T.refresh, () => {
    GM_listValues()
      .filter((k) => k !== "profile")
      .forEach((k) => GM_deleteValue(k));
    alert(T.refreshed);
  });

  GM_addStyle(`
    .dshr-card {
      --dshr-copper: oklch(0.55 0.152 46);
      --dshr-fg: var(--fgColor-default, #1f2328);
      --dshr-muted: var(--fgColor-muted, #59636e);
      --dshr-bg: var(--bgColor-muted, #f6f8fa);
      --dshr-line: var(--borderColor-default, #d1d9e0);
      border: 1px solid var(--dshr-line);
      border-left: 3px solid var(--dshr-copper);
      background: var(--dshr-bg);
      color: var(--dshr-fg);
      padding: 12px 14px;
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.5;
    }
    .dshr-card[data-dshr-theme="auto"] { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .dshr-card[data-dshr-theme="auto"] {
        --dshr-copper: oklch(0.63 0.16 46);
        --dshr-fg: #e6edf3;
        --dshr-muted: #9198a1;
        --dshr-bg: #161b22;
        --dshr-line: #30363d;
      }
    }
    .dshr-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .dshr-brand {
      color: var(--dshr-copper) !important;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-decoration: none;
    }
    .dshr-brand:hover { text-decoration: underline; }
    .dshr-cat {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: var(--dshr-muted);
      border: 1px solid var(--dshr-line);
      padding: 0 5px;
    }
    .dshr-block + .dshr-block { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--dshr-line); }
    .dshr-sub {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; color: var(--dshr-muted); margin-bottom: 6px;
    }
    .dshr-summary:empty { display: none; }
    .dshr-summary { margin: 0 0 8px; color: var(--dshr-fg); }
    .dshr-cmd { display: flex; align-items: stretch; border: 1px solid var(--dshr-line); }
    /* Wraps rather than scrolls: the sidebar is ~300px and a scrollbar across
       an install command reads as a rendering fault. The copy button is the
       intended way to take it, so a wrapped line costs nothing. */
    .dshr-cmd code {
      flex: 1; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere;
      padding: 6px 8px; background: none; border: 0; border-radius: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
      line-height: 1.45; color: var(--dshr-fg);
    }
    .dshr-copy {
      flex: none; align-self: flex-start; cursor: pointer;
      border: 0; border-left: 1px solid var(--dshr-line);
      background: none; color: var(--dshr-muted); font-size: 11px;
      padding: 7px 10px; white-space: nowrap;
    }
    .dshr-copy:hover { color: var(--dshr-copper); }
    .dshr-copy.is-done { color: var(--dshr-copper); }
    .dshr-note { margin: 0; color: var(--dshr-muted); font-size: 12px; }
    .dshr-flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .dshr-flags:empty { display: none; }
    .dshr-flag {
      font-size: 11px; color: var(--dshr-muted);
      border: 1px dashed var(--dshr-line); padding: 0 5px;
    }
    .dshr-link {
      display: inline-block; margin-top: 10px; font-size: 12px;
      color: var(--dshr-copper) !important; text-decoration: none;
    }
    .dshr-link:hover { text-decoration: underline; }
    .dshr-link::after { content: " \\2192"; }
    .dshr-chip {
      display: inline-block; margin-left: 6px; vertical-align: middle;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px; line-height: 1.6; letter-spacing: 0.04em;
      padding: 0 4px; text-decoration: none !important;
      color: oklch(0.55 0.152 46) !important;
      border: 1px solid currentColor;
    }
    .dshr-chip:hover { background: oklch(0.55 0.152 46); color: #fff !important; }
  `);

  run();
})();
