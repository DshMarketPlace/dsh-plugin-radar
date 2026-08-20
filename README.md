<p align="center">
  <img src="docs/banner.jpg" alt="DSH Plugin Radar — spot DeepSeek Harness plugins while you browse" width="100%">
</p>

<p align="center">
  <a href="https://greasyfork.org/scripts/591735-dsh-plugin-radar"><img alt="Greasy Fork" src="https://img.shields.io/badge/Greasy%20Fork-install-c0561d?style=flat-square"></a>
  <a href="dsh-plugin-radar.user.js"><img alt="Version" src="https://img.shields.io/badge/version-1.0.0-241f1a?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-241f1a?style=flat-square"></a>
  <a href="https://dshmarketplace.dev/api/v1/index"><img alt="Catalogue" src="https://img.shields.io/badge/catalogue-3%2C400%2B%20plugins-6b6055?style=flat-square"></a>
  <img alt="Dependencies" src="https://img.shields.io/badge/dependencies-none-6b6055?style=flat-square">
  <img alt="Build" src="https://img.shields.io/badge/build%20step-none-6b6055?style=flat-square">
</p>

<p align="center">
  <b>English</b> · <a href="README.zh-CN.md">简体中文</a>
</p>

---

A userscript that marks [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
plugins while you browse GitHub and npm, and hands you the install command that
actually works.

## Why it exists

`dsh plugin add` is a thin forward to pnpm inside a profile directory, so
`--profile` is **mandatory**:

```console
$ dsh plugin add some-plugin
error: required option '--profile <name>' not specified
```

Plenty of READMEs print the short form anyway. This script reads the command
from the [DSH Marketplace](https://dshmarketplace.dev) catalogue, where every
listing carries the flag, and drops it on the page you are already looking at.

## What it does

**On a GitHub repository page** — if the repo is a DSH plugin, a card goes at
the top of the sidebar with its category, what it does, the install command
with a copy button, and what the plugin can reach.

**On any GitHub page listing repositories** — topic pages, search results,
starred lists, a README that links to other repos — every link to a catalogued
plugin gets a small `DSH` mark. Hover it for the install command.

**On an npm package page** — if the package is a DSH plugin, the DSH command
appears above npm's own `npm i`, because `npm i` does not install a plugin into
the harness.

**Monorepo plugins get told the truth.** The obvious command does not work:
`dsh plugin add` forwards to pnpm, pnpm reads everything after `#` as a git ref,
and `github:owner/repo#packages/thing` fails with `Could not resolve
packages/thing to a commit`. Rather than print a command that fails, the card
says so.

There *is* a form that resolves — pnpm splits the fragment on `::` and treats a
`path:` part as a subdirectory, so `github:owner/repo#path:packages/thing`
installs, verified end to end. The catalogue does not publish it yet, so the
card does not either. When it does, this script gets it for free: the command
comes from the API, not from here.

## Install

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/),
   [Violentmonkey](https://violentmonkey.github.io/) or
   [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) for Safari.
2. **[Install from Greasy Fork](https://greasyfork.org/scripts/591735-dsh-plugin-radar)**,
   or open [`dsh-plugin-radar.user.js`](dsh-plugin-radar.user.js) raw and your
   manager will offer to install it.

### Running another profile

Commands are written against the `web` profile, which is the one a default DSH
install creates. If yours is named something else, set it once from the
userscript manager's menu — **Set profile name** — and every command on every
page is rewritten to match.

## Privacy

Nothing about you is sent anywhere.

The script fetches one public file — `https://dshmarketplace.dev/api/v1/index`,
a list of plugin names — at most once every six hours, and does all matching in
your browser. The pages you visit are never transmitted. There is no account, no
tracking, no telemetry, and no third-party request beyond that one endpoint.

Cached data lives in your userscript manager's storage and can be cleared from
its menu at any time.

## The API it reads

Both endpoints are public, CORS-open and free to use.

| Endpoint | Purpose |
| --- | --- |
| [`/api/v1/index`](https://dshmarketplace.dev/api/v1/index) | Every listing, five columns, one request — [example](docs/example-index.json) |
| [`/api/v1/plugins?q=`](https://dshmarketplace.dev/api/v1/plugins?q=modlens) | The full record for one plugin — [example](docs/example-plugin.json) |

`/api/v1/index` returns positional rows to stay small — 375 KB for the current
3,417 plugins, 68 KB over the wire — and ships its column names with the
payload:

```json
{
  "fields": ["fullName", "category", "install", "path", "npm"],
  "plugins": [
    ["liustack/modlens", "vision", "dsh plugin --profile web add @liustack/modlens", "/plugins/liustack-modlens", "@liustack/modlens"]
  ]
}
```

`install` is `null` when no command can install the plugin, `path` is `null`
when the listing has no page of its own yet, and `npm` is `null` when the plugin
publishes nowhere. None of them is ever a placeholder — a caller that runs
whatever is in `install` must not be handed a string that fails.

## Building on it

There is no build step and no dependency. The script is one file you can read
top to bottom, and it only ever touches the DOM by appending its own nodes.

Other ways into the same catalogue:

- **Web** — [dshmarketplace.dev](https://dshmarketplace.dev)
- **npm** — `npx dshmarketplace-cli find memory`
- **PyPI** — `pip install dshmarketplace`
- **Inside DSH** — `dsh plugin --profile web add dshmarketplace-plugin`

## Contributing

Issues and pull requests are welcome. If a plugin is missing from the catalogue
or its listing is wrong, that belongs on the
[marketplace repo](https://github.com/DshMarketPlace/dshmarketplace) or the
[submit form](https://dshmarketplace.dev/submit) — the data lives there, not
here.

## Licence

MIT. An independent project, not affiliated with DeepSeek.
