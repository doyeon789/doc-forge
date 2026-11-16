---
name: docs-file
description: 파일 하나에 대한 신입용 한국어 문서(03_files/<경로>.md)를 만들거나 다시 만든다. "이 파일 문서화", "이 파일 문서 만들어 줘", "파일 문서 다시 써 줘", "document this file" 같은 요청에 사용.
argument-hint: "<file path> [--out <dir>]"
---

# /doc-forge:docs-file — 파일 하나 문서화

메인 대화에서 실행하는 지휘 절차다. 문서는 직접 쓰지 않는다. 사용자에게 하는 말은 한국어로 한다.

## 고정 규칙

- 모든 경로는 큰따옴표로 감싼다. `<REPO>` 등 꺾쇠 자리는 실제 값으로 바꾼다.
- `scan` 출력은 화면에 찍지 않는다 (`>/dev/null`).
- 이 명령은 그 파일의 문서와 그 파일이 속한 batch 요약의 한 줄만 바꾼다. batch status는 건드리지 않는다.
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

인자 = 대상 파일 경로 (`<TARGET>`, 절대·상대·`\` 구분자 모두 가능). 없으면 사용자에게 경로를 묻고 멈춘다.

`--out <dir>`이 있으면 그 값을 떼어 내 아래 명령의 마지막 인자로 넣는다 (없으면 빈 문자열 `""`). `docs-all`에 준 것과 같은 값이어야 같은 출력 폴더를 쓴다. 출력의 `REPO=`, `OUT=` 값을 이후 모든 명령과 프롬프트에 그대로 쓴다.

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out 값 또는 빈 문자열>"
```

## 2. scan과 COMMIT

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" >/dev/null && node -e 'console.log(JSON.stringify(require(process.argv[1]).commit))' "<OUT>/.doc-forge/manifest.json"
```

출력 한 줄이 `<COMMIT>`이다.

## 3. 대상 파일 찾기

```bash
node -e 'const p=require("path"),[o,r,q]=process.argv.slice(1),m=require(p.join(o,".doc-forge","manifest.json")),rs=[p.relative(r,p.resolve(q)).split(p.sep).join("/"),q.split(String.fromCharCode(92)).join("/").replace(/^\.\//,"")],f=m.files.find(f=>rs.includes(f.path)),ex=m.excluded.find(e=>rs.includes(e.path));if(f&&f.kind!=="doc"&&f.kind!=="data"){const b=m.batches.find(b=>b.files.includes(f.path));console.log(JSON.stringify({doc:f.doc,realBatch:b.id,path:f.path}));process.exit()}if(f||ex){console.log(JSON.stringify({doc:null,path:(f||ex).path,reason:f?"kind:"+f.kind:ex.reason}));process.exit()}const L=(a,b)=>{let v=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(v[j]+1,c[j-1]+1,v[j-1]+(a[i-1]===b[j-1]?0:1));v=c}return v[b.length]},k=p.posix.basename(rs[1]).toLowerCase(),s=y=>y.toLowerCase().includes(k)?0:L(k,p.posix.basename(y).toLowerCase());console.log(JSON.stringify({doc:null,candidates:m.files.map(y=>[s(y.path),y.path]).sort((a,b)=>a[0]-b[0]).slice(0,3).map(y=>y[1])}))' "<OUT>" "<REPO>" "<TARGET>"
```

- `doc`가 있으면: `DOC` = `doc` (OUT 기준 문서 경로), `REAL_BATCH` = `realBatch`, `BATCH` = 아래 명령의 출력 (실제 `batch` CLI가 주는 `moduleDoc`·`up` 등을 그대로 갖고, 이 파일 하나만 남기고 id를 0으로 바꾼 batch. 실제 batch 요약을 덮어쓰지 않으려고 id 0을 쓴다).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" batch "<REPO>" --out "<OUT>" --id <realBatch> | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));b.id=0;b.files=b.files.filter(f=>f.path===process.argv[1]);console.log(JSON.stringify(b))' "<path>"
```
- `reason`이 `kind:doc`·`kind:data`면: "이 종류(기존 문서·데이터 파일)는 파일 문서를 만들지 않는다"고 알리고 멈춘다. 다른 `reason`이면 scan에서 제외된 파일이라고 이유와 함께 알리고 멈춘다.
- `candidates`가 나오면: "그런 파일이 없다"고 하고 비슷한 후보 최대 3개를 보여 준 뒤 멈춘다.

## 4. 문서 쓰기 (file-documenter)

Agent 호출 (`subagent_type: "doc-forge:file-documenter"`, `description: "파일 문서화"`). 프롬프트 = 공통 입력 블록 +

```
BATCH: <3단계 batch 객체 JSON 그대로>
```

답이 `batch 0: 1개 완료`가 아니면 실패로 기억한다 (6단계가 확인한다).

## 5. 검증과 한 번 수정

1. Agent 호출 (`subagent_type: "doc-forge:verifier"`, `description: "파일 문서 검증"`). 프롬프트 = 공통 입력 블록 + `DOCS: ["<DOC>"]`.
2. 답에서 ``` 울타리를 걷고 JSON 배열로 파싱한다. 파싱이 안 되면 "verifier output unparseable"을 보고에 넣고 수정은 건너뛴다.
3. `problem`이 `검색 범위 초과:`로 시작하는 지적은 보고에만 넣는다. 나머지가 있으면 file-documenter를 한 번 더 부른다: 공통 입력 블록 + `BATCH: <같은 batch 객체>` + `FINDINGS: <지적 JSON 배열>`. 다시 검증하지 않는다.

## 6. check와 한 번 재처리

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>" --only "<DOC>"
```

- 종료 코드 2와 `no such doc`: 문서가 안 써졌다. 4단계를 한 번 다시 하고 check를 다시 돌린다.
- `ok`가 false (`brokenRefs`·`brokenLinks`·`leaks`): 각 항목을 지적으로 바꿔 (brokenRef → `{"doc":"<doc>","sentence":"근거 `<ref>`가 있는 문장","problem":"깨진 근거(<reason>): 실제 파일·줄 범위로 고치거나 근거를 지울 것","evidence":""}`, leak → `{"doc":"<doc>","sentence":"<line>번째 줄","problem":"비밀 값 유출 의심(<type> <pattern>): 값을 ***로 바꿀 것","evidence":""}`, brokenLink → `{"doc":"<doc>","sentence":"링크 `<link>`","problem":"링크 대상 없음 (<line>번째 줄): doc-style §7대로 대상 문서 경로는 manifest `doc`에서, 상대 경로는 `up`이나 `link` 명령으로 다시 만들 것. 문서가 없는 파일이면 링크 대신 백틱 경로로 쓸 것","evidence":""}`) file-documenter 수정 실행을 한 번 하고 check를 다시 돌린다.
- 그래도 남은 문제는 보고에 넣는다.

## 7. batch 요약 합치기

`<OUT>/.doc-forge/summaries/batch-0.md`가 있으면 그 한 줄을 실제 batch 요약에 합치고 `batch-0.md`를 지운다:

```bash
node -e 'const fs=require("fs"),p=require("path"),[o,id]=process.argv.slice(1),d=p.join(o,".doc-forge","summaries"),n=p.join(d,"batch-0.md"),t=p.join(d,"batch-"+id+".md"),line=fs.readFileSync(n,"utf8").split(/\r?\n/).find(l=>l.startsWith("- "));if(!line){fs.rmSync(n);console.log("skipped: batch-0.md had no summary line");process.exit()}const key=line.split(" — ")[0],old=fs.existsSync(t)?fs.readFileSync(t,"utf8").split(/\r?\n/).filter(l=>l.startsWith("- ")):[],i=old.findIndex(l=>l.split(" — ")[0]===key);if(i<0)old.push(line);else old[i]=line;fs.writeFileSync(t,old.join("\n")+"\n");fs.rmSync(n);console.log("merged: batch-"+id+".md")' "<OUT>" "<REAL_BATCH>"
```

출력이 `skipped: …`이면 (agent가 요약 줄을 못 썼음) `batch-0.md`만 지워진 것이다. 실제 batch 요약은 그대로 두고, 보고의 남은 문제에 "batch 요약 줄 갱신 안 됨"을 넣는다.

## 8. 보고 (한국어)

- 만든 문서: `<OUT>/<DOC>`
- 검증: 지적 수, 수정 여부
- check 결과(깨진 근거·깨진 링크·유출 의심 개수)와 추정 비율 (`estimates.ratio`를 %로)
- 남은 문제 (없으면 "없음"). module 문서·개요는 바뀌지 않았으니 필요하면 `/doc-forge:docs-module`이나 `/doc-forge:docs-all`을 쓰라고 안내
