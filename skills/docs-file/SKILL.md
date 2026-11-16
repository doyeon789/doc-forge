---
name: docs-file
description: Creates or regenerates the newcomer doc for one file (03_files/<path>.md), in English by default or Korean with --lang ko. Use for requests like "document this file", "write a doc for this file", "regenerate this file's doc".
argument-hint: "<file path> [--lang en|ko] [--out <dir>]"
---

# /doc-forge:docs-file — document one file

A conducting procedure that runs in the main conversation. It never writes docs itself. Talk to the user in the language they are using.

## Fixed rules

- Wrap every path in double quotes. Replace angle-bracket slots such as `<REPO>` with the real values.
- Never print the `scan` output (`>/dev/null`).
- This command changes only that file's doc and that file's line in its batch summary. It never touches batch status.
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

Argument = the target file path (`<TARGET>`; absolute, relative, or with `\` separators). If missing, ask the user for the path and stop.

Take `--lang <en|ko>` out of the arguments if present. If `--out <dir>` is present, take it out and pass its value as the last argument of the command below (otherwise an empty string `""`). It must be the same value given to `docs-all` to use the same output folder. Use the printed `REPO=` and `OUT=` values as they are in every later command and prompt.

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out value or empty string>"
```

## 2. scan, COMMIT, LANG, TOP_DOCS

Add `--lang <en|ko>` only when the user gave it (without it, scan keeps the previous run's language, default `en`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" [--lang <en|ko>] >/dev/null && node -e 'const m=require(process.argv[1]);console.log(JSON.stringify({commit:m.commit,lang:m.settings.lang,topDocs:m.topDocs}))' "<OUT>/.doc-forge/manifest.json"
```

The one output line gives `<COMMIT>` (`commit`), `<LANG>` (`lang`) and `<TOP_DOCS>` (`topDocs`).

## 3. Find the target file

```bash
node -e 'const p=require("path"),[o,r,q]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json")),rs=[p.relative(r,p.resolve(q)).split(p.sep).join("/"),q.split(String.fromCharCode(92)).join("/").replace(/^\.\//,"")],f=m.files.find(f=>rs.includes(f.path)),ex=m.excluded.find(e=>rs.includes(e.path));if(f&&f.kind!=="doc"&&f.kind!=="data"){const b=m.batches.find(b=>b.files.includes(f.path));console.log(JSON.stringify({doc:f.doc,realBatch:b.id,path:f.path}));process.exit()}if(f||ex){console.log(JSON.stringify({doc:null,path:(f||ex).path,reason:f?"kind:"+f.kind:ex.reason}));process.exit()}const L=(a,b)=>{let v=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(v[j]+1,c[j-1]+1,v[j-1]+(a[i-1]===b[j-1]?0:1));v=c}return v[b.length]},k=p.posix.basename(rs[1]).toLowerCase(),s=y=>y.toLowerCase().includes(k)?0:L(k,p.posix.basename(y).toLowerCase());console.log(JSON.stringify({doc:null,candidates:m.files.map(y=>[s(y.path),y.path]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(y=>y[1])}))' "<OUT>" "<REPO>" "<TARGET>"
```

- If there is a `doc`: `DOC` = `doc` (doc path relative to OUT), `REAL_BATCH` = `realBatch`, `BATCH` = the output of the command below (the batch exactly as the real `batch` CLI gives it, with `moduleDoc`, `up`, `lang`, `topDocs` and so on, keeping only this file and with id set to 0; id 0 keeps the real batch summary from being overwritten).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" batch "<REPO>" --out "<OUT>" --id <realBatch> | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));b.id=0;b.files=b.files.filter(f=>f.path===process.argv[1]);console.log(JSON.stringify(b))' "<path>"
```
- If `reason` is `kind:doc` or `kind:data`: say "this kind (existing docs and data files) gets no file doc" and stop. For any other `reason`, say the file was excluded by scan, with the reason, and stop.
- If `candidates` is printed: say "no such file", show up to 3 similar candidates, and stop.

## 4. Write the doc (file-documenter)

Agent call (`subagent_type: "doc-forge:file-documenter"`, `description: "document file"`). Prompt = common input block +

```
BATCH: <the step 3 batch object JSON, as is>
```

If the answer is not `batch 0: 1 done`, remember it as failed (step 6 checks).

## 5. Verification and one round of fixes

1. Agent call (`subagent_type: "doc-forge:verifier"`, `description: "verify file doc"`). Prompt = common input block + `DOCS: ["<DOC>"]`.
2. Strip ``` fences from the answer and parse it as a JSON array. If it does not parse, put "verifier output unparseable" in the report and skip the fix.
3. Findings whose `problem` starts with `search limit exceeded:` go into the report only. If others remain, call file-documenter once more: common input block + `BATCH: <the same batch object>` + `FINDINGS: <JSON array of findings>`. Do not verify again.

## 6. check and one round of reprocessing

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>" --only "<DOC>"
```

- Exit code 2 with `no such doc`: the doc was not written. Redo step 4 once and run check again.
- `ok` is false (`brokenRefs`, `brokenLinks`, `leaks`): turn each item into a finding (brokenRef → `{"doc":"<doc>","sentence":"the sentence with citation `<ref>`","problem":"broken citation (<reason>): fix it to a real file and line range, or remove the citation","evidence":""}`, leak → `{"doc":"<doc>","sentence":"line <line>","problem":"suspected secret leak (<type> <pattern>): replace the value with ***","evidence":""}`, brokenLink → `{"doc":"<doc>","sentence":"link `<link>`","problem":"link target missing (line <line>): per doc-style §7, take the target doc path from the manifest `doc` and build the relative path with `up` or the `link` command. If the file has no doc, write a backticked path instead of a link","evidence":""}`), run one file-documenter fix run, and run check again.
- Whatever still remains goes into the report.

## 7. Merge the batch summary

If `<OUT>/.doc-forge/summaries/batch-0.md` exists, merge its one line into the real batch summary and delete `batch-0.md`:

```bash
node -e 'const fs=require("fs"),p=require("path"),[o,id]=process.argv.slice(1),d=p.join(o,".doc-forge","summaries"),n=p.join(d,"batch-0.md"),t=p.join(d,"batch-"+id+".md"),line=fs.readFileSync(n,"utf8").split(/\r?\n/).find(l=>l.startsWith("- "));if(!line){fs.rmSync(n);console.log("skipped: batch-0.md had no summary line");process.exit()}const key=line.split(" — ")[0],old=fs.existsSync(t)?fs.readFileSync(t,"utf8").split(/\r?\n/).filter(l=>l.startsWith("- ")):[],i=old.findIndex(l=>l.split(" — ")[0]===key);if(i<0)old.push(line);else old[i]=line;fs.writeFileSync(t,old.join("\n")+"\n");fs.rmSync(n);console.log("merged: batch-"+id+".md")' "<OUT>" "<REAL_BATCH>"
```

If the output is `skipped: …` (the agent wrote no summary line), only `batch-0.md` was deleted. Leave the real batch summary as it is and add "batch summary line not updated" to the remaining problems in the report.

## 8. Report

- Doc written: `<OUT>/<DOC>`
- Verification: number of findings, whether fixed
- check result (broken citations, broken links, suspected leaks) and the estimate ratio (`estimates.ratio` as %)
- Remaining problems ("None" if none). Note that module docs and the overview were not changed; suggest `/doc-forge:docs-module` or `/doc-forge:docs-all` if needed
