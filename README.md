# doc-forge

A [Claude Code](https://claude.com/claude-code) plugin that reads an undocumented repo **from start to finish** and writes docs a newcomer can understand in one pass. Docs are written in English by default, or in another supported language with `--lang <code>` (currently `en` and `ko`).

```
docs/doc-forge/
├─ 00_overview.md        what the project does and why, tech stack, reading order, how to run
├─ 01_architecture.md    layers, request and data flow, Mermaid diagrams
├─ 02_modules/           per module: role, files, relations to other modules
├─ 03_files/             per file: why it exists, key parts, callers and callees, hidden connections
└─ 04_flows/             one feature followed from its entry point
```

Other languages use their own top-level doc names (see the `--lang` table below); the folder names stay the same.

**See a real result:** [`examples/mini-shop-output/00_overview.md`](examples/mini-shop-output/00_overview.md) is the unedited output of `/doc-forge:docs-all` on [`examples/mini-shop`](examples/mini-shop) (citations are relative to that folder).

## What makes it different

- **Reads everything.** A script builds the repo's file list, and the check fails if even one file has no doc. It does not "summarize a few key files".
- **Every statement has a citation.** Each sentence carries a citation like `` `src/order/OrderService.java:42-58` ``, and a script checks mechanically that the file and lines exist. Anything not confirmed in code is marked separately with `Assumption:` (`추정:` in Korean docs).
- **A review agent checks against the code.** An agent other than the writer compares the docs with the actual code and only the wrong sentences get fixed.
- **Finds hidden connections.** Not just imports: Spring DI, events, route registration, config binding, MyBatis mappers and other links you cannot see directly in the code.
- **Keeps secret values out of the docs.** Secret files like `.env` are never opened (only their key names are seen), and the docs are scanned automatically for leaked secret values.
- **Resumes after interruption.** Running it again skips finished parts and redoes only the parts with changed files.

## Quick start

### 1. Install

In Claude Code:

```
/plugin marketplace add doyeon789/doc-forge
/plugin install doc-forge@doc-forge
```

Or clone the repo and point Claude Code at the folder:

```bash
git clone https://github.com/doyeon789/doc-forge.git
cd <repo to document>
claude --plugin-dir "<path to doc-forge>"
```

### 2. Run

Start Claude Code in the repo you want to document:

```
/doc-forge:docs-all
```

The result goes to `docs/doc-forge/`. Start reading at `00_overview.md`. For docs in another language, e.g. Korean:

```
/doc-forge:docs-all --lang ko
```

### Try it on the example first

`examples/mini-shop/` is a small Express app with deliberately hidden connections (dynamic route registration, events, environment variables) and fake secret values.

```bash
cp -r examples/mini-shop /tmp/mini-shop && cd /tmp/mini-shop
git init -q && git add -A && git commit -qm init
claude --plugin-dir "<path to doc-forge>"
# in Claude Code: /doc-forge:docs-all
```

## Requirements

- Claude Code
- Node.js 18 or later (for the helper script `scripts/inventory.mjs`; no external dependencies)
- **Windows**: Claude Code's Bash tool must be Git Bash (the commands use POSIX syntax).
- **Permissions**: agents run `node`. Allow `Bash(node:*)`. If it is denied, secret files get documented without their key names.

## Commands

| Command | What it does |
|---|---|
| `/doc-forge:docs-all [--lang <code>] [--fresh] [--out <dir>]` | Documents the whole repo (overview, architecture, modules, files), then verifies |
| `/doc-forge:docs-file <file path> [--lang <code>] [--out <dir>]` | Creates or regenerates the doc of one file |
| `/doc-forge:docs-module <module or folder> [--lang <code>] [--out <dir>]` | Creates the file docs and the module doc of one module |
| `/doc-forge:docs-flow "<feature description>" [--lang <code>] [--out <dir>]` | Creates the flow doc of one feature (e.g. "create order"), with a Mermaid sequence diagram |

- `--lang <code>`: output language (default `en`; supported codes are listed below). The choice is stored in the manifest, so later commands without `--lang` keep using it.

  | `--lang` | Top-level docs | Estimate marker |
  |---|---|---|
  | `en` (default) | `00_overview.md`, `01_architecture.md` | `Assumption:` |
  | `ko` | `00_개요.md`, `01_아키텍처.md` | `추정:` |

  To switch the language of existing docs, run `/doc-forge:docs-all --lang <new> --fresh`: `--fresh` makes every batch run again. Top-level docs of the old language are not deleted; remove them yourself.
- `--fresh`: drop the previous progress and start over (keeps the stored language unless `--lang` is given).
- `--out <dir>`: output folder (default `<repo root>/docs/doc-forge`). Other commands must get the same value as `docs-all` to use the same output folder.
- **Adding a language**: add an entry to `OUTPUT_LANGS` in `scripts/inventory.mjs` (code, top-level doc names, estimate marker), add `skills/doc-style/templates/<code>/` with the same 7 templates and sections, and add the language's rows to the estimate-marker table (§2) and header-line table (§7) of `skills/doc-style/SKILL.md`. `node --test` fails until all of these exist. Skills and agents need no change.
- If there are more than 20 batches to process, it shows the size first and asks whether to proceed. Large repos take a lot of time and tokens.

## How it works

```
/doc-forge:docs-all
 ├─ ① scan ─────────────── file list, kinds, modules, batches → manifest.json
 ├─ ② file-documenter ×N ─ file docs per batch (up to 5 at a time)
 ├─ ③ module-synthesizer ─ module docs
 ├─ ④ architect ────────── overview and architecture docs
 ├─ ⑤ verifier ─────────── checks all top-level docs + a 20% sample of file docs against the code; fixes only wrong sentences
 └─ ⑥ check ────────────── missing docs, broken citations, broken links, secret leaks; reprocesses problem parts once
```

| Part | Role |
|---|---|
| `skills/docs-*` | The commands users run. They conduct the steps |
| `skills/doc-style` | Writing rules and per-language templates (`templates/<code>/`) that every agent follows |
| `agents/` | Agents that write file, module, overview and flow docs, and the review agent |
| `scripts/inventory.mjs` | Mechanical work: file list, batching, output names per language, citation/link/secret checks |

The output folder is never wiped. Each command overwrites only the files it creates, and `docs-all` does not touch `04_flows/`.

## Secret handling

- Treated as secret files: `.env*`, key files like `*.pem` / `*.key`, `application*.yml|properties`, `secret(s).*`, `credentials.*`, `appsettings*.json`, `*.tfvars`, `.npmrc` and more (full list: `SECRET_FILE_PATTERNS` in `scripts/inventory.mjs`).
- Agents never open secret files; they get **key names and structure only** from `inventory.mjs keys` (values are `***`).
- Values are never stored. They are read only during the final check, compared against the docs, and dropped. Common shapes such as AWS keys, JWTs, private keys, `password=...` and credentials in URLs are searched too.
- `manifest.json` holds the sha1 of every file for change detection. Leave `.doc-forge/` out when you publish the output folder.

## Known limits

- The citation check skips paths with spaces, and non-existent paths without a `/` (like `127.0.0.1:80`).
- Batches are split by line count (at most 2,500 lines and 25 files per batch). Code difficulty is not considered.
- Claude Code does not write files under folders starting with `.` such as `.mvn`, so doc paths turn such folders into `_dot_mvn` and the like.
- The secret-value comparison uses only values whose key names look secret (`password`, `secret`, `token`, `..._key`, …). Values in `.example` / `.sample` / `.template` files are treated as placeholders and not compared.
- Resume decisions use file modification times. If you copy the output folder and the times change, the decisions can be wrong.
- If code comments record outdated decisions, the docs may repeat them. Check your team's decision records too, if you have any.

## Development

```bash
node --test
```

## License

[MIT](LICENSE)
