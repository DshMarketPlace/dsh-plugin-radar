# The Greasy Fork listing

**Live at <https://greasyfork.org/scripts/591735-dsh-plugin-radar>** since
17 August 2026. The listing text lives here so it stays versioned with the
script.

## What the listing is worth, measured

Greasy Fork script pages are indexable — no `noindex`, self-canonical — but
author-supplied links are not all equal. On this script's own page:

| Link | |
| --- | --- |
| `github.com/DshMarketPlace/dsh-plugin-radar` (in the description) | **dofollow** |
| `github.com/deepseek-ai/deepseek-harness` (in the description) | **dofollow** |
| `dshmarketplace.dev` (in the description) | `nofollow` |
| the `@supportURL` issues link | `nofollow` |

So Greasy Fork appears to run a small trusted-domain allowlist. The listing
earns brand exposure on an indexable page plus a real link to the repository;
the site gets its equity one hop later, from the repository's own README.

## Steps

1. <https://greasyfork.org/scripts/new> (sign in first).
2. Paste the contents of
   [`dsh-plugin-radar.user.js`](../dsh-plugin-radar.user.js) into the code box.
   Greasy Fork hosts the code itself — it does not install from a URL, and it
   reads the name, description, version and licence out of the metadata block.
3. Add **Additional info** twice, once per language, using the two bodies
   below. Set the language selector on each block.
4. Publish. Bumping `@version` and re-pasting is what ships an update.

Greasy Fork rejects obfuscated code, code loaded from a remote source, and
scripts that exist only to advertise. This one is a single readable file that
fetches data — never code — from one documented endpoint, and says so in both
the header comment and the listing.

## Additional info — English

```markdown
Marks [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugins while you browse, and hands you the install command that actually
works.

`dsh plugin add` forwards to pnpm inside a profile directory, so `--profile`
is mandatory — without it nothing installs, and plenty of READMEs print the
short form anyway. This script reads the command from the DSH Marketplace
catalogue, where every listing carries the flag.

**What you get**

- **A GitHub repository page** — if the repo is a DSH plugin, a card at the top
  of the sidebar: category, what it does, the install command with a copy
  button, and what the plugin can reach.
- **Any GitHub page listing repositories** — topic pages, search results,
  starred lists, a README linking to other repos — every catalogued plugin gets
  a small `DSH` mark. Hover it for the command.
- **An npm package page** — the DSH command above npm's own `npm i`, because
  `npm i` does not install a plugin into the harness.
- **Monorepo plugins get told the truth.** A plugin in a subdirectory has no
  one-line install at all: pnpm reads everything after `#` as a git ref, so
  `github:owner/repo#packages/thing` cannot resolve. The card says so instead
  of printing a command that fails.

**Running another profile?** Set the name once from the userscript manager's
menu and every command on every page is rewritten to match.

**Privacy** — nothing about you is sent anywhere. The script fetches one public
file (a list of plugin names) at most once every six hours and does all matching
in your browser. The pages you visit are never transmitted. No account, no
tracking, no telemetry, no third-party request beyond that one endpoint. Cached
data lives in your userscript manager's storage and can be cleared from its
menu.

Source, in full: <https://github.com/DshMarketPlace/dsh-plugin-radar>
Catalogue and API: <https://dshmarketplace.dev>

MIT. An independent project, not affiliated with DeepSeek.
```

## Additional info — 简体中文

```markdown
你在 GitHub 和 npm 上随便逛的时候，它把
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
插件标出来，顺手给你一条真能跑的安装命令。

`dsh plugin add` 只是把活转发给 profile 目录里的 pnpm，所以 `--profile` 是必填的
—— 少了它什么都装不上，可不少 README 还在写短的那种。这个脚本从 DSH Marketplace
目录里取命令，那边每条都带着这个 flag。

**具体做什么**

- **GitHub 仓库页** —— 如果这个仓库是 DSH 插件，侧栏顶部出现一张卡片：分类、
  这插件干嘛的、带复制按钮的安装命令，以及它能碰到什么。
- **任何列了一堆仓库的 GitHub 页面** —— topic 页、搜索结果、Star 列表、甚至一篇
  链了别的仓库的 README —— 每个收录过的插件后面跟一个小小的 `DSH` 标记，
  鼠标悬上去就是安装命令。
- **npm 包页** —— DSH 命令放在 npm 自己那句 `npm i` 上面。`npm i` 装不进
  harness 里。
- **monorepo 里的插件，实话实说。** 装在子目录里的插件根本没有一行命令能装：
  pnpm 把 `#` 后面当 git ref，所以 `github:owner/repo#packages/thing` 解析不了。
  卡片会直接说明，而不是给你一条跑不通的命令。

**用的不是 web profile？** 在脚本管理器菜单里点一次设置，之后所有页面上的命令
都会跟着改。

**隐私** —— 不往外发你的任何东西。脚本只会去拉一个公开文件（一份插件名单），
最多六小时一次，匹配全在你自己浏览器里做。你访问了哪些页面，从来不会被传出去。
没有账号，没有追踪，没有埋点，除了那一个接口没有任何第三方请求。缓存存在脚本
管理器自己的存储里，随时可以从它的菜单清掉。

完整源码：<https://github.com/DshMarketPlace/dsh-plugin-radar>
目录和 API：<https://dshmarketplace.dev>

MIT。独立项目，与 DeepSeek 无从属关系。
```
