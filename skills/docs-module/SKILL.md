---
name: docs-module
description: Creates or regenerates the file docs and the module doc (02_modules) of one module (package or folder), in English by default or in another supported language with --lang <code>. Use for requests like "document this module", "document this folder", "write docs for this package".
argument-hint: "<module id | folder path> [--lang <code>] [--out <dir>]"
---

# /doc-forge:docs-module — document one module

A conducting procedure that runs in the main conversation. It never writes docs itself. Talk to the user in the language they are using.

## Fixed rules

- Wrap every path in double quotes. Replace angle-bracket slots such as `<REPO>` with the real values.
- **At most 5 Agent calls per message**; send the next wave only after the current wave has finished.
- Update `status` with one Bash call at a time, never in parallel (several may be chained with `;` in one Bash call).
- Never print the `scan` output (`>/dev/null`).
- This command writes only that module's file docs, its module doc, and its batch and module summaries. It never touches the overview, architecture or flow docs.
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

## 1. Resolve paths

Argument = a module id or folder path (`<TARGET>`). If missing, ask the user and stop.

Take `--lang <code>` out of the arguments if present. If `--out <dir>` is present, take it out and pass its value as the last argument of the command below (otherwise an empty string `""`). It must be the same value given to `docs-all` to use the same output folder. Use the printed `REPO=` and `OUT=` values as they are in every later command and prompt.

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out value or empty string>"
```

## 2. scan, COMMIT, LANG, TOP_DOCS

Add `--lang <code>` only when the user gave it (without it, scan keeps the previous run's language, default `en`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" [--lang <code>] >/dev/null && node -e 'const m=require(process.argv[1]);console.log(JSON.stringify({commit:m.commit,lang:m.settings.lang,topDocs:m.topDocs}))' "<OUT>/.doc-forge/manifest.json"
```

## 3. Find the module (the command below is called `module lookup`)

```bash
node -e 'const p=require("path"),fs=require("fs"),[o,r,q]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json"));let x=m.modules.find(x=>x.id===q);if(!x){const rs=[p.relative(r,p.resolve(q)).split(p.sep).join("/"),q.split(String.fromCharCode(92)).join("/").replace(/^\.\//,"")].map(s=>s.replace(/\/+$/,"")).filter(s=>s&&!s.startsWith(".."));const ids=[...new Set(m.files.filter(f=>rs.some(s=>f.path===s||f.path.startsWith(s+"/"))).map(f=>f.module))];if(ids.length>1){console.log(JSON.stringify({module:null,spans:ids}));process.exit()}x=m.modules.find(y=>y.id===ids[0])}if(!x){const L=(a,b)=>{let v=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(v[j]+1,c[j-1]+1,v[j-1]+(a[i-1]===b[j-1]?0:1));v=c}return v[b.length]},s=y=>y.toLowerCase().includes(q.toLowerCase())?0:L(q.toLowerCase(),y.toLowerCase());console.log(JSON.stringify({module:null,candidates:m.modules.map(y=>[s(y.id),y.id]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(y=>y[1])}));process.exit()}const e=m.files.filter(f=>f.module===x.id&&f.kind!=="doc"&&f.kind!=="data").map(f=>f.doc);console.log(JSON.stringify({module:x.id,doc:x.doc,batches:m.batches.filter(b=>b.module===x.id).map(b=>b.id),data:m.files.filter(f=>f.module===x.id&&f.kind==="data").map(f=>f.path),fileDocs:e.filter(d=>fs.existsSync(p.join(o,d))),missing:e.filter(d=>!fs.existsSync(p.join(o,d)))}))' "<OUT>" "<REPO>" "<TARGET>"
```

- If `module` is set: `MODULE` = `module`, `MODULE_DOC` = `doc`, `BATCH_IDS` = `batches`, `DATA_FILES` = `data`.
- If `spans` is printed: say the folder spans several modules, show the module ids (at most 3, plus how many more), and stop.
- If `candidates` is printed: say there is no such module or folder, show up to 3 similar candidates, and stop.

## 4. File docs (file-documenter)

All of `BATCH_IDS` (whatever their status), in waves of 5. For each wave:

1. ```bash
   for i in <id1> <id2> <id3> <id4> <id5>; do node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" batch "<REPO>" --out "<OUT>" --id $i; done
   ```
2. One Agent call per batch (`subagent_type: "doc-forge:file-documenter"`, `description: "document batch <id>"`). Prompt = common input block + `BATCH: <that batch's output JSON, as is>`.
3. If the answer is `batch <id>: <n> done` without `(failed:`, the batch is done; otherwise failed.
4. When the wave is over, in one Bash call, in order: `node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" status "<REPO>" --out "<OUT>" --id <id> --set done|failed; …`

If `BATCH_IDS` is empty (a module with only doc and data files), skip this step.

## 5. Module doc (module-synthesizer)

Agent call (`subagent_type: "doc-forge:module-synthesizer"`, `description: "document module"`). Prompt = common input block +

```
MODULE: <MODULE>
MODULE_DOC: <MODULE_DOC>
BATCH_IDS: <BATCH_IDS JSON array>
DATA_FILES: <DATA_FILES JSON array>
```

## 6. Verification (whole module) and one round of fixes

1. Run `module lookup` again with `<MODULE>` instead of `<TARGET>` to get the `fileDocs` that exist now.
2. `ALL_DOCS` = `[MODULE_DOC]` + `fileDocs`. Split into chunks of 15 or fewer; one Agent call per chunk (`subagent_type: "doc-forge:verifier"`, `description: "verify module <n>"`), prompt = common input block + `DOCS: <chunk JSON array>`. 5 per wave.
3. Take the text from the first `[` to the last `]` (the verifier sometimes adds prose before or after the JSON) and parse that as a JSON array. A parse failure goes into the report only, as "verifier output unparseable". Findings whose `problem` starts with `search limit exceeded:` go into the report only too.
4. Split the remaining findings and fix them once (5 per wave, no re-verification):
   - `03_files/...` → group by batch:
     ```bash
     node -e 'const p=require("path"),[o,...ds]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json")),r={};for(const d of ds){const x=m.files.find(x=>x.doc===d||x.path===d),b=x&&m.batches.find(b=>b.files.includes(x.path));(r[b?b.id:"none"]??=[]).push(d)}console.log(JSON.stringify(r))' "<OUT>" "<doc1>" "<doc2>"
     ```
     One file-documenter per batch: common input block + `BATCH: <JSON printed by batch --id N, via the step 4.1 command>` + `FINDINGS: <JSON array of the findings for that batch's docs>`.
   - `MODULE_DOC` → module-synthesizer: the 4 variables of step 5 + `FINDINGS: <JSON array of findings>`.

## 7. check and one round of reprocessing

Run `module lookup` again with `<MODULE>` to get `fileDocs`. `ONLY` = `MODULE_DOC` (if it exists) + `fileDocs`, joined with commas.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>" --only "<ONLY>"
```

`--only` skips the coverage check, so judge missing docs from `module lookup`'s `missing` (missing file docs) and whether `MODULE_DOC` exists (Glob).

If there are problems, reprocess **once** (5 per wave):

- Missing file docs → rerun that batch as in step 4 and record its status. Missing module doc → rerun step 5.
- `brokenRefs`, `brokenLinks`, `leaks` → turn them into findings (brokenRef → `{"doc":"<doc>","sentence":"the sentence with citation `<ref>`","problem":"broken citation (<reason>): fix it to a real file and line range, or remove the citation","evidence":""}`, leak → `{"doc":"<doc>","sentence":"line <line>","problem":"suspected secret leak (<type> <pattern>): replace the value with ***","evidence":""}`, brokenLink → `{"doc":"<doc>","sentence":"link `<link>`","problem":"link target missing (line <line>): per doc-style §7, take the target doc path from the manifest `doc` and build the relative path with `up` or the `link` command. If the file has no doc, write a backticked path instead of a link","evidence":""}`) and run fix runs for the writer by the rules of step 6.4.

Then run `module lookup` and check once more. Put whatever remains in the report.

## 8. Report

- Module doc: `<OUT>/<MODULE_DOC>`, number of file docs (`fileDocs` count / target count)
- Verification: number of findings, how many were passed on for fixing
- check result (broken citations, broken links, suspected leaks) and the estimate ratio (`estimates.ratio` as %)
- Remaining problems: failed batches, items left in check, `search limit exceeded`, parse failures. "None" if none
- Note that the overview and architecture were not changed; suggest `/doc-forge:docs-all` to bring everything in line
