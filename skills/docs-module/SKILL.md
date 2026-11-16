---
name: docs-module
description: module(패키지·폴더) 하나의 파일 문서들과 module 문서(02_modules)를 만들거나 다시 만든다. "이 모듈 문서화", "이 폴더 문서화", "이 패키지 문서 만들어 줘", "document this module" 같은 요청에 사용.
argument-hint: "<module id | folder path> [--out <dir>]"
---

# /doc-forge:docs-module — module 하나 문서화

메인 대화에서 실행하는 지휘 절차다. 문서는 직접 쓰지 않는다. 사용자에게 하는 말은 한국어로 한다.

## 고정 규칙

- 모든 경로는 큰따옴표로 감싼다. `<REPO>` 등 꺾쇠 자리는 실제 값으로 바꾼다.
- **Agent 호출은 한 메시지에 최대 5개**, 그 wave가 끝난 뒤 다음 wave.
- `status` 갱신은 한 번에 Bash 하나로, 병렬로 보내지 않는다 (여러 개는 한 Bash 안에서 `;`로 이어 순서대로).
- `scan` 출력은 화면에 찍지 않는다 (`>/dev/null`).
- 이 명령은 그 module의 파일 문서, module 문서, 그 batch 요약·module 요약만 쓴다. 개요·아키텍처·흐름 문서는 건드리지 않는다.
- 비밀 값은 어떤 프롬프트·보고에도 넣지 않는다.
- `inventory.mjs` 종료 코드: 0 성공, `check`는 문제 있으면 1 (JSON 유효), 2는 사용법 오류(stderr).

## Agent 공통 입력 블록

```
REPO: <REPO>
OUT: <OUT>
STYLE: ${CLAUDE_PLUGIN_ROOT}/skills/doc-style
INVENTORY: ${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs
COMMIT: <COMMIT>
```

`<COMMIT>`은 manifest의 `commit` 값을 JSON 그대로 (`null` 가능).

## 1. 경로 정하기

인자 = module id 또는 폴더 경로 (`<TARGET>`). 없으면 사용자에게 묻고 멈춘다.

`--out <dir>`이 있으면 그 값을 떼어 내 아래 명령의 마지막 인자로 넣는다 (없으면 빈 문자열 `""`). `docs-all`에 준 것과 같은 값이어야 같은 출력 폴더를 쓴다. 출력의 `REPO=`, `OUT=` 값을 이후 모든 명령과 프롬프트에 그대로 쓴다.

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out 값 또는 빈 문자열>"
```

## 2. scan과 COMMIT

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" >/dev/null && node -e 'console.log(JSON.stringify(require(process.argv[1]).commit))' "<OUT>/.doc-forge/manifest.json"
```

## 3. module 찾기 (아래 명령을 `module 조회`라 부른다)

```bash
node -e 'const p=require("path"),fs=require("fs"),[o,r,q]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json"));let x=m.modules.find(x=>x.id===q);if(!x){const rs=[p.relative(r,p.resolve(q)).split(p.sep).join("/"),q.split(String.fromCharCode(92)).join("/").replace(/^\.\//,"")].map(s=>s.replace(/\/+$/,"")).filter(s=>s&&!s.startsWith(".."));const ids=[...new Set(m.files.filter(f=>rs.some(s=>f.path===s||f.path.startsWith(s+"/"))).map(f=>f.module))];if(ids.length>1){console.log(JSON.stringify({module:null,spans:ids}));process.exit()}x=m.modules.find(y=>y.id===ids[0])}if(!x){const L=(a,b)=>{let v=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(v[j]+1,c[j-1]+1,v[j-1]+(a[i-1]===b[j-1]?0:1));v=c}return v[b.length]},s=y=>y.toLowerCase().includes(q.toLowerCase())?0:L(q.toLowerCase(),y.toLowerCase());console.log(JSON.stringify({module:null,candidates:m.modules.map(y=>[s(y.id),y.id]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(y=>y[1])}));process.exit()}const e=m.files.filter(f=>f.module===x.id&&f.kind!=="doc"&&f.kind!=="data").map(f=>f.doc);console.log(JSON.stringify({module:x.id,doc:x.doc,batches:m.batches.filter(b=>b.module===x.id).map(b=>b.id),data:m.files.filter(f=>f.module===x.id&&f.kind==="data").map(f=>f.path),fileDocs:e.filter(d=>fs.existsSync(p.join(o,d))),missing:e.filter(d=>!fs.existsSync(p.join(o,d)))}))' "<OUT>" "<REPO>" "<TARGET>"
```

- `module`이 있으면: `MODULE` = `module`, `MODULE_DOC` = `doc`, `BATCH_IDS` = `batches`, `DATA_FILES` = `data`.
- `spans`가 나오면: 그 폴더가 여러 module에 걸친다고 알리고 module id 목록(최대 3개 + 나머지 개수)을 보여 준 뒤 멈춘다.
- `candidates`가 나오면: 그런 module·폴더가 없다고 하고 비슷한 후보 최대 3개를 보여 준 뒤 멈춘다.

## 4. 파일 문서 (file-documenter)

`BATCH_IDS` 전부를 (status와 상관없이) 5개씩 wave로. wave마다:

1. ```bash
   for i in <id1> <id2> <id3> <id4> <id5>; do node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" batch "<REPO>" --out "<OUT>" --id $i; done
   ```
2. batch마다 Agent 호출 (`subagent_type: "doc-forge:file-documenter"`, `description: "batch <id> 문서화"`). 프롬프트 = 공통 입력 블록 + `BATCH: <그 batch 출력 JSON 그대로>`.
3. 답이 `batch <id>: <n>개 완료`이고 `(실패:`가 없으면 done, 아니면 failed.
4. wave가 끝나면 Bash 하나로 순서대로: `node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" status "<REPO>" --out "<OUT>" --id <id> --set done|failed; …`

`BATCH_IDS`가 비어 있으면 (문서·데이터 파일만 있는 module) 이 단계를 건너뛴다.

## 5. module 문서 (module-synthesizer)

Agent 호출 (`subagent_type: "doc-forge:module-synthesizer"`, `description: "module 문서화"`). 프롬프트 = 공통 입력 블록 +

```
MODULE: <MODULE>
MODULE_DOC: <MODULE_DOC>
BATCH_IDS: <BATCH_IDS JSON 배열>
DATA_FILES: <DATA_FILES JSON 배열>
```

## 6. 검증 (module 전체)과 한 번 수정

1. `module 조회`를 `<TARGET>` 대신 `<MODULE>`로 다시 돌려 지금 존재하는 `fileDocs`를 얻는다.
2. `DOCS 전체` = `[MODULE_DOC]` + `fileDocs`. 15개 이하 조각으로 나눠, 조각마다 Agent 호출 (`subagent_type: "doc-forge:verifier"`, `description: "module 검증 <n>"`), 프롬프트 = 공통 입력 블록 + `DOCS: <조각 JSON 배열>`. wave당 5개.
3. 각 답에서 ``` 울타리를 걷고 JSON 배열로 파싱한다. 파싱 실패는 "verifier output unparseable"로 보고에만 넣는다. `problem`이 `검색 범위 초과:`로 시작하는 지적도 보고에만.
4. 남은 지적을 나눠 한 번만 수정한다 (wave당 5개, 다시 검증하지 않음):
   - `03_files/...` → batch별로 묶는다:
     ```bash
     node -e 'const p=require("path"),[o,...ds]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json")),r={};for(const d of ds){const x=m.files.find(x=>x.doc===d||x.path===d),b=x&&m.batches.find(b=>b.files.includes(x.path));(r[b?b.id:"none"]??=[]).push(d)}console.log(JSON.stringify(r))' "<OUT>" "<doc1>" "<doc2>"
     ```
     batch마다 file-documenter: 공통 입력 블록 + `BATCH: <batch --id N 출력 JSON, 4단계 1번 명령으로 뽑음>` + `FINDINGS: <그 batch 문서들의 지적 JSON 배열>`.
   - `MODULE_DOC` → module-synthesizer: 5단계 변수 4개 + `FINDINGS: <지적 JSON 배열>`.

## 7. check와 한 번 재처리

`module 조회`를 `<MODULE>`로 다시 돌려 `fileDocs`를 얻는다. `ONLY` = `MODULE_DOC`(있을 때) + `fileDocs`를 쉼표로 이은 문자열.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>" --only "<ONLY>"
```

`--only`는 누락 검사를 하지 않으므로, 빠진 문서는 `module 조회`의 `missing`(없는 파일 문서)과 `MODULE_DOC` 존재 여부(Glob)로 판단한다.

문제가 있으면 **한 번만** 재처리한다 (wave당 5개):

- 빠진 파일 문서 → 그 batch를 4단계처럼 다시 실행하고 status 기록. 빠진 module 문서 → 5단계 다시 실행.
- `brokenRefs`·`brokenLinks`·`leaks` → 지적으로 바꿔 (brokenRef → `{"doc":"<doc>","sentence":"근거 `<ref>`가 있는 문장","problem":"깨진 근거(<reason>): 실제 파일·줄 범위로 고치거나 근거를 지울 것","evidence":""}`, leak → `{"doc":"<doc>","sentence":"<line>번째 줄","problem":"비밀 값 유출 의심(<type> <pattern>): 값을 ***로 바꿀 것","evidence":""}`, brokenLink → `{"doc":"<doc>","sentence":"링크 `<link>`","problem":"링크 대상 없음 (<line>번째 줄): doc-style §7대로 대상 문서 경로는 manifest `doc`에서, 상대 경로는 `up`이나 `link` 명령으로 다시 만들 것. 문서가 없는 파일이면 링크 대신 백틱 경로로 쓸 것","evidence":""}`) 6단계 4번 규칙대로 쓴 역할에게 수정 실행.

그다음 `module 조회`와 check를 한 번 더 돌린다. 남은 문제는 보고에 넣는다.

## 8. 보고 (한국어)

- module 문서: `<OUT>/<MODULE_DOC>`, 파일 문서 수 (`fileDocs` 개수 / 대상 수)
- 검증: 지적 수, 수정으로 넘긴 수
- check 결과(깨진 근거·깨진 링크·유출 의심 개수)와 추정 비율 (`estimates.ratio`를 %로)
- 남은 문제: failed batch, check에 남은 항목, `검색 범위 초과`, 파싱 실패. 없으면 "없음"
- 개요·아키텍처는 바뀌지 않았으니 전체를 맞추려면 `/doc-forge:docs-all`을 쓰라고 안내
