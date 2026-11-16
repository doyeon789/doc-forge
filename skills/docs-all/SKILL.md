---
name: docs-all
description: 문서 없는 레포 전체를 끝까지 읽고 신입용 한국어 문서(개요·아키텍처·module·파일 문서)를 docs/doc-forge/에 만든다. "레포 문서화", "레포 전체 문서 만들어 줘", "프로젝트 문서화", "온보딩 문서 생성", "document this repo" 같은 요청에 사용. 중단된 실행은 이어서 한다.
argument-hint: "[--fresh] [--out <dir>]"
---

# /doc-forge:docs-all — 레포 전체 문서화

이 skill은 메인 대화에서 실행되는 지휘 절차다. 문서는 직접 쓰지 않는다. Bash로 `inventory.mjs`를 돌리고, Agent 도구로 doc-forge agent를 부른다.
아래 단계를 순서대로 지킨다. 사용자에게 하는 말은 한국어로 한다.

## 고정 규칙

- 모든 경로는 큰따옴표로 감싼다 (공백·한글 경로가 있다). `<REPO>` 등 꺾쇠 자리는 1단계에서 정한 실제 값으로 바꾼다.
- **Agent 호출은 한 메시지에 최대 5개.** 그 묶음(wave)이 모두 끝난 뒤 다음 묶음을 보낸다.
- `status` 갱신은 한 번에 Bash 하나로, 병렬로 보내지 않는다 (manifest를 읽고-고쳐-쓰기 한다). 여러 개는 한 Bash 안에서 `;`로 이어 순서대로 실행해도 된다.
- `scan` 결과(manifest 전체)는 화면에 찍지 않는다 (`>/dev/null`). 필요한 값은 아래 요약 명령으로만 본다.
- `04_flows/`의 문서는 쓰지도 고치지도 않는다 (`/doc-forge:docs-flow` 담당).
- 비밀 값은 어떤 프롬프트·보고에도 넣지 않는다.
- `inventory.mjs` 종료 코드: 0 성공, `check`는 문제 있으면 1 (stdout JSON은 그대로 유효), 2는 사용법 오류(stderr 메시지).

## Agent 공통 입력 블록

모든 agent 프롬프트는 아래 다섯 줄로 시작하고, 그 뒤에 agent별 변수를 붙인다. 변수 이름은 그대로 쓴다.

```
REPO: <REPO>
OUT: <OUT>
STYLE: ${CLAUDE_PLUGIN_ROOT}/skills/doc-style
INVENTORY: ${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs
COMMIT: <COMMIT>
```

`<COMMIT>`은 3단계 요약의 `commit` 값을 JSON 그대로 (`{"hash":"…","dirty":false}` 또는 `null`).

## 1. 경로 정하기

인자에서 `--fresh` 여부와 `--out <dir>` 값을 읽는다. 다음을 실행한다 (`--out`이 없으면 마지막 인자를 빈 문자열 `""`로):

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out 값 또는 빈 문자열>"
```

출력의 `REPO=`, `OUT=` 값(절대 경로)을 이후 모든 명령과 프롬프트에 그대로 쓴다.

## 2. scan

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" [--fresh] >/dev/null
```

`--fresh`는 사용자가 줬을 때만 붙인다. 실패하면 stderr를 보여 주고 멈춘다.

## 3. 요약과 시작 확인

```bash
node -e 'const fs=require("fs"),p=require("path"),o=process.argv[1],m=require(p.join(o,".doc-forge","manifest.json")),S=".doc-forge/summaries/",t=r=>{try{return fs.statSync(p.join(o,r)).mtimeMs}catch{return null}},ls=(r,f)=>{try{return fs.readdirSync(p.join(o,r)).filter(f)}catch{return[]}},d=f=>f.kind!=="doc"&&f.kind!=="data",todo=m.batches.filter(b=>b.status!=="done").map(b=>b.id),modules=m.modules.map(x=>{const bs=m.batches.filter(b=>b.module===x.id).map(b=>b.id),dt=t(x.doc);return{id:x.id,doc:x.doc,batches:bs,data:m.files.filter(f=>f.module===x.id&&f.kind==="data").map(f=>f.path),redo:dt===null||bs.some(i=>todo.includes(i)||(t(S+"batch-"+i+".md")??0)>dt)}}),top=["00_개요.md","01_아키텍처.md"].map(t),sm=ls(S,n=>n.startsWith("module-")).map(n=>t(S+n));console.log(JSON.stringify({commit:m.commit,files:m.files.length,documented:m.files.filter(d).length,excluded:m.excluded.length,batches:m.batches.length,todo,architect:modules.some(x=>x.redo)||top.includes(null)||Math.min(...top)<Math.max(0,...sm),flows:ls("04_flows",n=>n.endsWith(".md")).map(n=>"04_flows/"+n),modules}))' "<OUT>"
```

- `todo` = 이번에 돌릴 batch id (`pending`·`failed`. `done`은 건너뜀).
- `modules[]` = 각 module의 `id`, `doc`(OUT 기준 module 문서 경로), 소속 `batches`, `data` 파일 목록, `redo`. 이 값을 끝까지 쓴다.
- `redo`가 true인 module = `REDO_MODULES`: 소속 batch가 `todo`에 있거나, module 문서가 없거나, module 문서가 소속 batch 요약(`summaries/batch-<id>.md`)보다 오래됨 (중단된 실행 이어하기).
- `architect`가 true면 6단계를 돌린다: `REDO_MODULES`가 있거나, `00_개요.md`·`01_아키텍처.md`가 없거나, 둘 중 하나가 가장 새 module 요약(`summaries/module-*.md`)보다 오래됨.
- `flows` = 이미 있는 흐름 문서 (OUT 기준 `04_flows/<이름>.md`). 검증만 하고 고치지 않는다.
- `todo`와 `REDO_MODULES`가 비어 있고 `architect`가 false면 4~6단계를 건너뛰고 7단계(검증)로 간다.

사용자에게 보여 준다: 파일 수(`files`, 그중 문서 대상 `documented`, 제외 `excluded`), 전체 batch 수와 이번에 돌릴 batch 수(`todo` 개수), module 수, 예상 agent 실행 횟수 ≈ `todo` 개수 + `REDO_MODULES` 개수 + (`architect`면 1) + verifier 조각 수(상위 1 + `REDO_MODULES`마다 1 + 나머지 module 문서 15개당 1). 수정·재시도 실행은 따로 더해질 수 있다고 덧붙인다.

`todo`가 20개를 넘으면 AskUserQuestion으로 "진행" / "취소"를 묻는다. 취소면 멈춘다.

## 4. 파일 문서 (file-documenter)

`todo`를 앞에서부터 5개씩 끊어 wave로 처리한다. wave마다:

1. 그 wave의 batch JSON을 한 번에 뽑는다:
   ```bash
   for i in <id1> <id2> <id3> <id4> <id5>; do node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" batch "<REPO>" --out "<OUT>" --id $i; done
   ```
2. 한 메시지에 batch마다 Agent 호출 하나 (`subagent_type: "doc-forge:file-documenter"`, `description: "batch <id> 문서화"`). 프롬프트 = 공통 입력 블록 + 다음 한 줄 (해당 batch의 출력 줄을 바꾸지 않고 그대로):
   ```
   BATCH: <batch --id N 출력 JSON>
   ```
3. 결과 판정: 답이 `batch <id>: <n>개 완료`이고 `(실패:`가 없으면 done, 그 밖(실패 목록 있음, 형식 다름, 오류)은 failed. 실패한 경로는 기억해 두었다가 보고에 넣는다.
4. wave가 끝나면 Bash 하나로 순서대로 기록한다:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" status "<REPO>" --out "<OUT>" --id <id1> --set done; node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" status "<REPO>" --out "<OUT>" --id <id2> --set failed
   ```

## 5. module 문서 (module-synthesizer)

`REDO_MODULES`를 5개씩 wave로. module마다 Agent 호출 (`subagent_type: "doc-forge:module-synthesizer"`, `description: "module <id> 문서화"`). 프롬프트 = 공통 입력 블록 +

```
MODULE: <modules[].id>
MODULE_DOC: <modules[].doc>
BATCH_IDS: <modules[].batches, JSON 배열>
DATA_FILES: <modules[].data, JSON 배열>
```

답이 `module <id>: <doc> 완료`가 아니면 실패로 기억한다 (9단계 check가 빠진 module 문서를 잡는다).

## 6. 개요·아키텍처 (architect)

3단계 `architect`가 true면 Agent 호출 하나 (`subagent_type: "doc-forge:architect"`, `description: "개요·아키텍처 문서화"`). 프롬프트 = 공통 입력 블록만.

## 7. 검증 (verifier)과 한 번 수정

### 7-1. 검증 묶음 만들기

검증은 이번에 무엇을 다시 썼는지와 상관없이 매번 한다 (중단된 실행에서 검증이 빠지지 않게).

- **상위 묶음**: `00_개요.md`, `01_아키텍처.md`(있는 것) + 3단계 `flows` 전부.
- **나머지 module 문서 묶음**: `redo`가 false인 모든 module의 `doc` (파일 문서 표본 없음).
- **다시 쓴 module 묶음** (`REDO_MODULES`마다): 그 module 문서(`modules[].doc`) + 존재하는 표본 파일 문서:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" sample "<REPO>" --out "<OUT>" --module "<module id>" | node -e 'const fs=require("fs"),p=require("path");let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log(JSON.stringify(JSON.parse(s).filter(d=>fs.existsSync(p.join(process.argv[1],d))))))' "<OUT>"
  ```
  출력은 OUT 기준 `03_files/...md` 배열이다 (batch가 실패해 없는 문서는 빠짐).
- 묶음이 15개 문서를 넘으면 15개 이하로 나눈다. 나뉜 조각 하나가 verifier 호출 하나다.

### 7-2. verifier 실행

조각들을 5개씩 wave로. 조각마다 Agent 호출 (`subagent_type: "doc-forge:verifier"`, `description: "문서 검증 <묶음 이름>"`). 프롬프트 = 공통 입력 블록 +

```
DOCS: <OUT 기준 문서 경로 JSON 배열>
```

답 처리: 앞뒤 공백과 ``` 코드 울타리를 걷어 내고 JSON 배열로 파싱한다. 파싱이 안 되면 그 조각에 대해 지적 하나 `{"doc":"<조각의 첫 문서>","problem":"verifier output unparseable"}`를 남기되, 수정으로 넘기지 않고 보고에만 넣는다.

### 7-3. 표본에서 지적이 나온 module은 전부 검증

다시 쓴 module 묶음에서 `03_files/` 문서에 대한 지적이 하나라도 나왔으면 (단, `problem`이 `검색 범위 초과:`로 시작하는 것만 있으면 제외), 그 module의 나머지 파일 문서를 모두 검증한다:

```bash
node -e 'const p=require("path"),fs=require("fs"),[o,r,q]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json"));let x=m.modules.find(x=>x.id===q);if(!x){const rs=[p.relative(r,p.resolve(q)).split(p.sep).join("/"),q.split(String.fromCharCode(92)).join("/").replace(/^\.\//,"")].map(s=>s.replace(/\/+$/,"")).filter(s=>s&&!s.startsWith(".."));const ids=[...new Set(m.files.filter(f=>rs.some(s=>f.path===s||f.path.startsWith(s+"/"))).map(f=>f.module))];if(ids.length>1){console.log(JSON.stringify({module:null,spans:ids}));process.exit()}x=m.modules.find(y=>y.id===ids[0])}if(!x){const L=(a,b)=>{let v=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(v[j]+1,c[j-1]+1,v[j-1]+(a[i-1]===b[j-1]?0:1));v=c}return v[b.length]},s=y=>y.toLowerCase().includes(q.toLowerCase())?0:L(q.toLowerCase(),y.toLowerCase());console.log(JSON.stringify({module:null,candidates:m.modules.map(y=>[s(y.id),y.id]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(y=>y[1])}));process.exit()}const e=m.files.filter(f=>f.module===x.id&&f.kind!=="doc"&&f.kind!=="data").map(f=>f.doc);console.log(JSON.stringify({module:x.id,doc:x.doc,batches:m.batches.filter(b=>b.module===x.id).map(b=>b.id),data:m.files.filter(f=>f.module===x.id&&f.kind==="data").map(f=>f.path),fileDocs:e.filter(d=>fs.existsSync(p.join(o,d))),missing:e.filter(d=>!fs.existsSync(p.join(o,d)))}))' "<OUT>" "<REPO>" "<module id>"
```

`fileDocs`에서 이미 표본으로 검증한 문서를 빼고, 15개 이하 조각으로 나눠 7-2와 같이 verifier를 돌린다 (wave당 5개). 이 확대 검증은 module마다 한 번뿐이다.

### 7-4. 지적을 쓴 역할에게 한 번만 돌려주기

모든 지적을 모은다. `problem`이 `검색 범위 초과:`로 시작하는 것과 `verifier output unparseable`은 수정으로 넘기지 않고 보고에만 넣는다. 나머지를 `doc`으로 나눈다:

- `03_files/...` → batch별로 묶는다:
  ```bash
  node -e 'const p=require("path"),[o,...ds]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json")),r={};for(const d of ds){const x=m.files.find(x=>x.doc===d||x.path===d),b=x&&m.batches.find(b=>b.files.includes(x.path));(r[b?b.id:"none"]??=[]).push(d)}console.log(JSON.stringify(r))' "<OUT>" "<doc1>" "<doc2>"
  ```
  batch마다 file-documenter 수정 실행: 프롬프트 = 공통 입력 블록 + `BATCH: <batch --id N 출력 JSON, 4단계 1번 명령으로 뽑음>` + `FINDINGS: <그 batch 문서들의 지적 JSON 배열>`. (`none`에 든 문서는 보고에만.)
- `02_modules/...` → 해당 module의 module-synthesizer 수정 실행: 5단계 변수 4개 + `FINDINGS: <그 문서의 지적 JSON 배열>`.
- `00_개요.md`, `01_아키텍처.md` → architect 수정 실행: 공통 입력 블록 + `FINDINGS: <두 문서의 지적 JSON 배열>`.
- `04_flows/...` → 고치지 않는다. 보고에 "흐름 문서 지적 n건, `/doc-forge:docs-flow`로 다시 만들 것"으로 넣는다.

수정 실행들도 5개씩 wave로 보낸다. 수정 후 다시 검증하지 않는다 (한 번만 고친다). batch status는 바꾸지 않는다.

## 8. prune

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" prune "<REPO>" --out "<OUT>"
```

`removed`에 나온 문서 수를 보고용으로 기억한다.

## 9. check와 한 번 재처리

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>"
```

stdout JSON: `{ok, missingFileDocs[], missingModuleDocs[], brokenRefs[{doc,ref,reason}], brokenLinks[{doc,line,link}], leaks[{doc,line,type,pattern?}], estimates{confirmed,estimated,ratio}}`. 종료 코드 1이어도 JSON은 유효하다.

`ok`가 false면 **한 번만** 재처리한다:

1. `missingFileDocs`의 경로(레포 경로)를 그대로 7-4의 batch 묶기 명령에 넣어 batch id를 찾는다. 그 batch들을 4단계처럼 다시 실행(일반 모드)하고 status를 기록한다.
2. `missingModuleDocs`의 module은 5단계처럼 다시 실행(일반 모드).
3. `brokenRefs`·`brokenLinks`·`leaks`는 문서별 지적으로 바꾼다 (비밀 값은 출력에 없으니 넣지 않는다):
   - brokenRef → `{"doc":"<doc>","sentence":"근거 `<ref>`가 있는 문장","problem":"깨진 근거(<reason>): 실제 파일·줄 범위로 고치거나 근거를 지울 것","evidence":""}`
   - leak → `{"doc":"<doc>","sentence":"<line>번째 줄","problem":"비밀 값 유출 의심(<type> <pattern>): 값을 ***로 바꿀 것","evidence":""}`
   - brokenLink → `{"doc":"<doc>","sentence":"링크 `<link>`","problem":"링크 대상 없음 (<line>번째 줄): doc-style §7대로 대상 문서 경로는 manifest `doc`에서, 상대 경로는 `up`이나 `link` 명령으로 다시 만들 것. 문서가 없는 파일이면 링크 대신 백틱 경로로 쓸 것","evidence":""}`
   1번에서 다시 돌린 batch의 문서는 빼고, 나머지를 7-4와 같은 규칙으로 쓴 역할에게 수정 실행으로 넘긴다 (`04_flows/`는 보고만).
   요약 파일의 leak(`doc`이 `.doc-forge/summaries/`로 시작, 전체 check만 요약을 본다)은 그 요약을 쓴 역할의 수정 실행으로 같은 방식(leak 지적, `doc` = 그 요약 경로)으로 넘긴다:
   - `.doc-forge/summaries/batch-<id>.md` → batch `<id>`의 file-documenter 수정 실행 (`BATCH`는 4단계 1번 명령으로 뽑음, 1번에서 다시 돌린 batch면 빼기). 같은 batch의 `03_files/` 지적과 한 실행에 합친다.
   - `.doc-forge/summaries/module-<base>.md` → `modules[].doc`이 `02_modules/<base>.md`인 module의 module-synthesizer 수정 실행. 같은 module 문서 지적과 한 실행에 합친다.
4. 재처리 실행도 wave당 5개. 끝나면 check를 한 번 더 돌린다. 그래도 남은 문제는 고치지 않고 보고에 넣는다.

## 10. 최종 보고 (한국어)

다음을 짧게 보고한다:

- 출력 위치: `<OUT>`
- 파일 수(전체 / 문서 대상 / 제외), module 수, 이번에 처리한 batch 수, prune으로 지운 문서 수
- check 결과: 통과 여부, 남은 누락·깨진 근거·깨진 링크·유출 의심 개수
- 추정 비율: 마지막 check의 `estimates.ratio`를 %로 (확인 `confirmed`개 / 추정 `estimated`개)
- 검증: 지적 수와 수정으로 넘긴 수
- 남은 문제: failed batch(실패 경로), check에 남은 항목, 흐름 문서 지적, `검색 범위 초과`, verifier 출력 파싱 실패. 없으면 "없음"
- failed batch가 있으면 `/doc-forge:docs-all`을 다시 실행하면 그 batch만 이어서 한다고 안내
