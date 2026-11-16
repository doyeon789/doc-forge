---
name: docs-all
description: Reads an undocumented repo end to end and writes onboarding docs for newcomers (overview, architecture, module and file docs) into docs/doc-forge/, in English by default or Korean with --lang ko. Use for requests like "document this repo", "generate docs for the whole repo", "write onboarding docs for this project". Resumes an interrupted run.
argument-hint: "[--lang en|ko] [--fresh] [--out <dir>]"
---

# /doc-forge:docs-all — document the whole repo

This skill is a conducting procedure that runs in the main conversation. It never writes docs itself: it runs `inventory.mjs` with Bash and calls doc-forge agents with the Agent tool.
Follow the steps below in order. Talk to the user in the language they are using.

## Fixed rules

- Wrap every path in double quotes (paths may contain spaces or non-ASCII characters). Replace angle-bracket slots such as `<REPO>` with the real values from step 1.
- **At most 5 Agent calls per message.** Send the next group (wave) only after the whole wave has finished.
- Update `status` with one Bash call at a time, never in parallel (it reads, edits and writes the manifest). Several updates may be chained with `;` in one Bash call.
- Never print the `scan` result (the whole manifest) (`>/dev/null`). Look at the values you need only through the summary commands below.
- Never write or edit docs in `04_flows/` (that belongs to `/doc-forge:docs-flow`).
- Never put secret values into any prompt or report.
- `inventory.mjs` exit codes: 0 success; `check` exits 1 when it finds problems (its stdout JSON is still valid); 2 is a usage error (message on stderr).

## Common agent input block

Every agent prompt starts with the seven lines below, followed by the agent-specific variables. Keep the variable names as they are.

```
REPO: <REPO>
OUT: <OUT>
STYLE: ${CLAUDE_PLUGIN_ROOT}/skills/doc-style
INVENTORY: ${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs
COMMIT: <COMMIT>
LANG: <LANG>
TOP_DOCS: <TOP_DOCS>
```

`<COMMIT>`, `<LANG>` and `<TOP_DOCS>` are the `commit`, `lang` and `topDocs` values of the step 3 summary, as JSON/text exactly as printed (`commit` is `{"hash":"…","dirty":false}` or `null`; `lang` is `en` or `ko`; `topDocs` is `{"overview":"…","architecture":"…"}`). Below, `<OVERVIEW>` and `<ARCHITECTURE>` mean `topDocs.overview` and `topDocs.architecture`; never type these names yourself.

## 1. Resolve paths

Read `--lang <en|ko>`, `--fresh` and `--out <dir>` from the arguments. Run the following (if there is no `--out`, pass an empty string `""` as the last argument):

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out value or empty string>"
```

Use the printed `REPO=` and `OUT=` values (absolute paths) as they are in every later command and prompt.

## 2. scan

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" [--lang <en|ko>] [--fresh] >/dev/null
```

Add `--lang` and `--fresh` only when the user gave them. Without `--lang`, scan keeps the language of the previous run (default `en`). If scan fails, show its stderr and stop.

## 3. Summary and go-ahead

```bash
node -e 'const fs=require("fs"),p=require("path"),o=process.argv[1],m=require(p.join(o,".doc-forge","manifest.json")),S=".doc-forge/summaries/",t=r=>{try{return fs.statSync(p.join(o,r)).mtimeMs}catch{return null}},ls=(r,f)=>{try{return fs.readdirSync(p.join(o,r)).filter(f)}catch{return[]}},d=f=>f.kind!=="doc"&&f.kind!=="data",todo=m.batches.filter(b=>b.status!=="done").map(b=>b.id),modules=m.modules.map(x=>{const bs=m.batches.filter(b=>b.module===x.id).map(b=>b.id),dt=t(x.doc);return{id:x.id,doc:x.doc,batches:bs,data:m.files.filter(f=>f.module===x.id&&f.kind==="data").map(f=>f.path),redo:dt===null||bs.some(i=>todo.includes(i)||(t(S+"batch-"+i+".md")??0)>dt)}}),top=[m.topDocs.overview,m.topDocs.architecture].map(t),sm=ls(S,n=>n.startsWith("module-")).map(n=>t(S+n));console.log(JSON.stringify({commit:m.commit,lang:m.settings.lang,topDocs:m.topDocs,files:m.files.length,documented:m.files.filter(d).length,excluded:m.excluded.length,batches:m.batches.length,todo,architect:modules.some(x=>x.redo)||top.includes(null)||Math.min(...top)<Math.max(0,...sm),flows:ls("04_flows",n=>n.endsWith(".md")).map(n=>"04_flows/"+n),modules}))' "<OUT>"
```

- `lang`, `topDocs` = `<LANG>`, `<TOP_DOCS>` of the common input block.
- `todo` = the batch ids to run this time (`pending` and `failed`; `done` is skipped).
- `modules[]` = each module's `id`, `doc` (module doc path relative to OUT), its `batches`, its `data` files, and `redo`. Use these values to the end.
- Modules with `redo` true = `REDO_MODULES`: one of its batches is in `todo`, or the module doc is missing, or the module doc is older than one of its batch summaries (`summaries/batch-<id>.md`) (resuming an interrupted run).
- If `architect` is true, run step 6: there are `REDO_MODULES`, or `<OVERVIEW>`/`<ARCHITECTURE>` is missing, or one of them is older than the newest module summary (`summaries/module-*.md`).
- `flows` = existing flow docs (`04_flows/<name>.md` relative to OUT). They are verified only, never edited.
- If `todo` and `REDO_MODULES` are empty and `architect` is false, skip steps 4–6 and go to step 7 (verification).

Show the user: number of files (`files`, of which `documented` get docs, `excluded` excluded), output language (`lang`), total batches and batches to run now (size of `todo`), number of modules, and the expected number of agent runs ≈ size of `todo` + number of `REDO_MODULES` + (1 if `architect`) + number of verifier chunks (1 for the top group + 1 per `REDO_MODULES` + 1 per 15 remaining module docs). Add that fix and retry runs may come on top.

If `todo` has more than 20 ids, ask "Proceed" / "Cancel" with AskUserQuestion. On cancel, stop.

## 4. File docs (file-documenter)

Process `todo` from the front, 5 at a time, as waves. For each wave:

1. Print the batch JSON of the wave in one go:
   ```bash
   for i in <id1> <id2> <id3> <id4> <id5>; do node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" batch "<REPO>" --out "<OUT>" --id $i; done
   ```
2. In one message, one Agent call per batch (`subagent_type: "doc-forge:file-documenter"`, `description: "document batch <id>"`). Prompt = common input block + this one line (that batch's output line, unchanged):
   ```
   BATCH: <JSON printed by batch --id N>
   ```
3. Judge the result: if the answer is `batch <id>: <n> done` without `(failed:`, the batch is done; anything else (a failed list, another format, an error) is failed. Remember the failed paths for the report.
4. When the wave is over, record the results in one Bash call, in order:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" status "<REPO>" --out "<OUT>" --id <id1> --set done; node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" status "<REPO>" --out "<OUT>" --id <id2> --set failed
   ```

## 5. Module docs (module-synthesizer)

`REDO_MODULES` in waves of 5. One Agent call per module (`subagent_type: "doc-forge:module-synthesizer"`, `description: "document module <id>"`). Prompt = common input block +

```
MODULE: <modules[].id>
MODULE_DOC: <modules[].doc>
BATCH_IDS: <modules[].batches, JSON array>
DATA_FILES: <modules[].data, JSON array>
```

If the answer is not `module <id>: <doc> done`, remember it as failed (the step 9 check catches missing module docs).

## 6. Overview and architecture (architect)

If `architect` from step 3 is true, one Agent call (`subagent_type: "doc-forge:architect"`, `description: "document overview and architecture"`). Prompt = common input block only.

## 7. Verification (verifier) and one round of fixes

### 7-1. Build verification groups

Verify on every run, no matter what was rewritten this time (so an interrupted run never skips verification).

- **Top group**: `<OVERVIEW>`, `<ARCHITECTURE>` (those that exist) + all `flows` from step 3.
- **Remaining module docs group**: the `doc` of every module whose `redo` is false (no file-doc samples).
- **Rewritten module group** (one per `REDO_MODULES`): that module's doc (`modules[].doc`) + the sampled file docs that exist:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" sample "<REPO>" --out "<OUT>" --module "<module id>" | node -e 'const fs=require("fs"),p=require("path");let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log(JSON.stringify(JSON.parse(s).filter(d=>fs.existsSync(p.join(process.argv[1],d))))))' "<OUT>"
  ```
  The output is an array of `03_files/...md` paths relative to OUT (docs missing because their batch failed are left out).
- Split any group with more than 15 docs into chunks of 15 or fewer. Each chunk is one verifier call.

### 7-2. Run the verifier

Chunks in waves of 5. One Agent call per chunk (`subagent_type: "doc-forge:verifier"`, `description: "verify docs <group name>"`). Prompt = common input block +

```
DOCS: <JSON array of doc paths relative to OUT>
```

Handling the answer: strip surrounding whitespace and ``` code fences and parse it as a JSON array. If it does not parse, record one finding `{"doc":"<first doc of the chunk>","problem":"verifier output unparseable"}` for that chunk; put it in the report only, never pass it on for fixing.

### 7-3. A module whose sample got findings is verified in full

If a rewritten module group got any finding on a `03_files/` doc (ignoring the case where every such finding's `problem` starts with `search limit exceeded:`), verify all remaining file docs of that module:

```bash
node -e 'const p=require("path"),fs=require("fs"),[o,r,q]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json"));let x=m.modules.find(x=>x.id===q);if(!x){const rs=[p.relative(r,p.resolve(q)).split(p.sep).join("/"),q.split(String.fromCharCode(92)).join("/").replace(/^\.\//,"")].map(s=>s.replace(/\/+$/,"")).filter(s=>s&&!s.startsWith(".."));const ids=[...new Set(m.files.filter(f=>rs.some(s=>f.path===s||f.path.startsWith(s+"/"))).map(f=>f.module))];if(ids.length>1){console.log(JSON.stringify({module:null,spans:ids}));process.exit()}x=m.modules.find(y=>y.id===ids[0])}if(!x){const L=(a,b)=>{let v=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(v[j]+1,c[j-1]+1,v[j-1]+(a[i-1]===b[j-1]?0:1));v=c}return v[b.length]},s=y=>y.toLowerCase().includes(q.toLowerCase())?0:L(q.toLowerCase(),y.toLowerCase());console.log(JSON.stringify({module:null,candidates:m.modules.map(y=>[s(y.id),y.id]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(y=>y[1])}));process.exit()}const e=m.files.filter(f=>f.module===x.id&&f.kind!=="doc"&&f.kind!=="data").map(f=>f.doc);console.log(JSON.stringify({module:x.id,doc:x.doc,batches:m.batches.filter(b=>b.module===x.id).map(b=>b.id),data:m.files.filter(f=>f.module===x.id&&f.kind==="data").map(f=>f.path),fileDocs:e.filter(d=>fs.existsSync(p.join(o,d))),missing:e.filter(d=>!fs.existsSync(p.join(o,d)))}))' "<OUT>" "<REPO>" "<module id>"
```

Remove the docs already verified as samples from `fileDocs`, split the rest into chunks of 15 or fewer, and run the verifier as in 7-2 (5 per wave). This widened verification happens only once per module.

### 7-4. Hand findings back to the writer, once

Collect all findings. Findings whose `problem` starts with `search limit exceeded:` and `verifier output unparseable` go into the report only, never to a fix. Split the rest by `doc`:

- `03_files/...` → group by batch:
  ```bash
  node -e 'const p=require("path"),[o,...ds]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json")),r={};for(const d of ds){const x=m.files.find(x=>x.doc===d||x.path===d),b=x&&m.batches.find(b=>b.files.includes(x.path));(r[b?b.id:"none"]??=[]).push(d)}console.log(JSON.stringify(r))' "<OUT>" "<doc1>" "<doc2>"
  ```
  One file-documenter fix run per batch: prompt = common input block + `BATCH: <JSON printed by batch --id N, via the step 4.1 command>` + `FINDINGS: <JSON array of the findings for that batch's docs>`. (Docs under `none` go into the report only.)
- `02_modules/...` → a module-synthesizer fix run for that module: the 4 variables of step 5 + `FINDINGS: <JSON array of that doc's findings>`.
- `<OVERVIEW>`, `<ARCHITECTURE>` → an architect fix run: common input block + `FINDINGS: <JSON array of the findings for the two docs>`.
- `04_flows/...` → never fixed. Report "n findings on flow docs; regenerate them with `/doc-forge:docs-flow`".

Send fix runs in waves of 5 too. Do not verify again after fixing (fix only once). Do not change batch status.

## 8. prune

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" prune "<REPO>" --out "<OUT>"
```

Remember the number of docs in `removed` for the report.

## 9. check and one round of reprocessing

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>"
```

stdout JSON: `{ok, missingFileDocs[], missingModuleDocs[], brokenRefs[{doc,ref,reason}], brokenLinks[{doc,line,link}], leaks[{doc,line,type,pattern?}], estimates{confirmed,estimated,ratio}}`. The JSON is valid even with exit code 1.

If `ok` is false, reprocess **once**:

1. Feed the paths in `missingFileDocs` (repo paths) as they are to the 7-4 batch grouping command to find their batch ids. Rerun those batches as in step 4 (normal mode) and record their status.
2. Rerun the modules in `missingModuleDocs` as in step 5 (normal mode).
3. Turn `brokenRefs`, `brokenLinks` and `leaks` into per-doc findings (the output has no secret values; do not add any):
   - brokenRef → `{"doc":"<doc>","sentence":"the sentence with citation `<ref>`","problem":"broken citation (<reason>): fix it to a real file and line range, or remove the citation","evidence":""}`
   - leak → `{"doc":"<doc>","sentence":"line <line>","problem":"suspected secret leak (<type> <pattern>): replace the value with ***","evidence":""}`
   - brokenLink → `{"doc":"<doc>","sentence":"link `<link>`","problem":"link target missing (line <line>): per doc-style §7, take the target doc path from the manifest `doc` and build the relative path with `up` or the `link` command. If the file has no doc, write a backticked path instead of a link","evidence":""}`
   Leave out the docs of batches rerun in item 1, and pass the rest as fix runs to the writer, by the same rules as 7-4 (`04_flows/` only reported).
   A leak in a summary file (`doc` starts with `.doc-forge/summaries/`; only the full check reads summaries) goes the same way (a leak finding with `doc` = that summary path) to the fix run of the role that wrote it:
   - `.doc-forge/summaries/batch-<id>.md` → a file-documenter fix run for batch `<id>` (`BATCH` via the step 4.1 command; skip if that batch was rerun in item 1). Merge it into one run with that batch's `03_files/` findings.
   - `.doc-forge/summaries/module-<base>.md` → a module-synthesizer fix run for the module whose `modules[].doc` is `02_modules/<base>.md`. Merge it into one run with that module doc's findings.
4. Reprocessing runs go in waves of 5 too. When they finish, run check once more. Do not fix what remains; put it in the report.

## 10. Final report

Report briefly, in the user's language:

- Output location: `<OUT>`, output language `<LANG>`
- Number of files (total / documented / excluded), number of modules, batches processed this time, docs removed by prune
- check result: pass or not, and the remaining counts of missing docs, broken citations, broken links and suspected leaks
- Estimate ratio: the last check's `estimates.ratio` as % (`confirmed` confirmed / `estimated` assumed)
- Verification: number of findings and how many were passed on for fixing
- Remaining problems: failed batches (failed paths), items left in check, flow doc findings, `search limit exceeded`, unparseable verifier output. "None" if there are none
- If any batch failed, tell the user that running `/doc-forge:docs-all` again continues with just those batches
