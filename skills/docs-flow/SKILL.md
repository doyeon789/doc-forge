---
name: docs-flow
description: Writes a flow doc (04_flows/<feature>.md, with a Mermaid sequence diagram) that follows one feature, such as login or order creation, from its entry point through the call chain step by step; in English by default or in another supported language with --lang <code>. Use for requests like "document this feature's flow", "explain how the login flow works", "trace this feature", "how is this request handled".
argument-hint: "\"<feature description>\" [--lang <code>] [--out <dir>]"
---

# /doc-forge:docs-flow — document a feature flow

A conducting procedure that runs in the main conversation. It never writes docs itself. Talk to the user in the language they are using.

## Fixed rules

- Wrap every path in double quotes. Replace angle-bracket slots such as `<REPO>` with the real values.
- This command writes only one doc, `04_flows/<feature name>.md`. If a manifest already exists and no `--lang` was given, it does not scan.
- Never put secret values into any prompt or report.
- `inventory.mjs` exit codes: 0 success; `check` exits 1 when it finds problems (JSON still valid); 2 is a usage error (stderr).

## Common agent input block

```
REPO: <REPO>
OUT: <OUT>
STYLE: ${CLAUDE_PLUGIN_ROOT}/skills/doc-style
INVENTORY: ${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs
COMMIT: <COMMIT>
LANG: <LANG>
TOP_DOCS: <TOP_DOCS>
```

`<COMMIT>`, `<LANG>`, `<TOP_DOCS>` are the `commit`, `lang`, `topDocs` values printed in step 2, exactly as printed (`commit` may be `null`).

## 1. Paths and feature

Take `--lang <code>` and `--out <dir>` out of the arguments; everything else (without surrounding quotes) = `FEATURE`. If it is empty, ask the user which feature to trace and stop.

If `--out <dir>` is present, pass its value as the last argument of the command below (otherwise an empty string `""`). It must be the same value given to `docs-all` to use the same output folder. Use the printed `REPO=` and `OUT=` values as they are in every later command and prompt.

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out value or empty string>"
```

## 2. Manifest, COMMIT, LANG, TOP_DOCS

Check with Glob whether `<OUT>/.doc-forge/manifest.json` exists. Scan only if it does not exist, or if the user gave `--lang` (add `--lang <code>` only then):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" [--lang <code>] >/dev/null
```

Then:

```bash
node -e 'const m=require(process.argv[1]);console.log(JSON.stringify({commit:m.commit,lang:m.settings.lang,topDocs:m.topDocs}))' "<OUT>/.doc-forge/manifest.json"
```

The one output line gives `<COMMIT>` (`commit`), `<LANG>` (`lang`) and `<TOP_DOCS>` (`topDocs`). If `lang` or `topDocs` is missing (a manifest from an older doc-forge), run the scan above once and print again.

## 3. Trace the flow (flow-tracer)

Agent call (`subagent_type: "doc-forge:flow-tracer"`, `description: "trace flow"`). Prompt = common input block +

```
FEATURE: <FEATURE>
If you cannot find an entry point, do not write a doc; answer with the single line `no flow: <reason>`.
```

- If the answer is `flow <feature name>: 04_flows/<feature name>.md` and that file exists (Glob): `DOC` = `04_flows/<feature name>.md`.
- If the answer is `no flow` or the doc is missing: tell the user the feature was not found, show up to 3 candidates, and stop. Find candidates in the manifest: Grep `<OUT>/.doc-forge/manifest.json` for the key words of `FEATURE` (if they are not English, also try them as English identifiers, e.g. login, auth) as `"path": ".*<word>` (regex special characters escaped with `\`, `head_limit: 3`), plus the names of existing `<OUT>/04_flows/*.md`.

## 4. Verification and one round of fixes

1. Agent call (`subagent_type: "doc-forge:verifier"`, `description: "verify flow doc"`). Prompt = common input block + `DOCS: ["<DOC>"]`.
2. Strip ``` fences from the answer and parse it as a JSON array. If it does not parse, put "verifier output unparseable" in the report and skip the fix. Findings whose `problem` starts with `search limit exceeded:` go into the report only.
3. If findings remain, call flow-tracer once more: common input block + `FEATURE: <FEATURE>` + `FINDINGS: <JSON array of findings>`. Do not verify again.

## 5. check and one round of reprocessing

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>" --only "<DOC>"
```

If `ok` is false, turn `brokenRefs`, `brokenLinks` and `leaks` into findings (brokenRef → `{"doc":"<doc>","sentence":"the sentence with citation `<ref>`","problem":"broken citation (<reason>): fix it to a real file and line range, or remove the citation","evidence":""}`, leak → `{"doc":"<doc>","sentence":"line <line>","problem":"suspected secret leak (<type> <pattern>): replace the value with ***","evidence":""}`, brokenLink → `{"doc":"<doc>","sentence":"link `<link>`","problem":"link target missing (line <line>): per doc-style §7, take the target doc path from the manifest `doc` and build the relative path with `up` or the `link` command. If the file has no doc, write a backticked path instead of a link","evidence":""}`), run one flow-tracer fix run (`FEATURE` + `FINDINGS`), and run check again. Put whatever remains in the report.

## 6. Report

- Flow doc: `<OUT>/<DOC>`
- Verification: number of findings, whether fixed
- check result (broken citations, broken links, suspected leaks) and the estimate ratio (`estimates.ratio` as %)
- Remaining problems ("None" if none)
- If the manifest may be stale (no scan this time), add one line: after code changes, `/doc-forge:docs-all` rebuilds the manifest
