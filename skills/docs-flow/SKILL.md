---
name: docs-flow
description: '기능 하나(예: 로그인, 주문 생성)를 시작 지점부터 호출을 따라가며 단계별로 설명하는 흐름 문서(04_flows/<기능>.md, Mermaid 순서도 포함)를 만든다. "이 기능 흐름 문서화", "로그인 흐름 설명 문서", "요청이 어떻게 처리되는지 문서로", "trace this feature" 같은 요청에 사용.'
argument-hint: "\"<기능 설명>\" [--out <dir>]"
---

# /doc-forge:docs-flow — 기능 흐름 문서화

메인 대화에서 실행하는 지휘 절차다. 문서는 직접 쓰지 않는다. 사용자에게 하는 말은 한국어로 한다.

## 고정 규칙

- 모든 경로는 큰따옴표로 감싼다. `<REPO>` 등 꺾쇠 자리는 실제 값으로 바꾼다.
- 이 명령은 `04_flows/<기능 이름>.md` 하나만 쓴다. manifest가 이미 있으면 scan하지 않는다.
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

## 1. 경로와 기능

`--out <dir>`을 뗀 나머지 인자 전체(감싼 따옴표는 뗀다) = `FEATURE`. 비어 있으면 어떤 기능을 따라갈지 사용자에게 묻고 멈춘다.

`--out <dir>`이 있으면 그 값을 떼어 내 아래 명령의 마지막 인자로 넣는다 (없으면 빈 문자열 `""`). `docs-all`에 준 것과 같은 값이어야 같은 출력 폴더를 쓴다. 출력의 `REPO=`, `OUT=` 값을 이후 모든 명령과 프롬프트에 그대로 쓴다.

```bash
node -e 'const p=require("path"),f=s=>s.split(p.sep).join("/");let r;try{r=require("child_process").execFileSync("git",["rev-parse","--show-toplevel"],{stdio:["ignore","pipe","ignore"]}).toString().trim()}catch{r=process.cwd()}r=p.resolve(r);console.log("REPO="+f(r)+"\nOUT="+f(process.argv[1]?p.resolve(process.argv[1]):p.join(r,"docs","doc-forge")))' "<--out 값 또는 빈 문자열>"
```

## 2. manifest와 COMMIT

Glob으로 `<OUT>/.doc-forge/manifest.json`이 있는지 본다. 없을 때만:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" scan "<REPO>" --out "<OUT>" >/dev/null
```

그다음:

```bash
node -e 'console.log(JSON.stringify(require(process.argv[1]).commit))' "<OUT>/.doc-forge/manifest.json"
```

출력 한 줄이 `<COMMIT>`이다.

## 3. 흐름 추적 (flow-tracer)

Agent 호출 (`subagent_type: "doc-forge:flow-tracer"`, `description: "흐름 추적"`). 프롬프트 = 공통 입력 블록 +

```
FEATURE: <FEATURE>
시작 지점을 찾지 못하면 문서를 쓰지 말고 `flow 없음: <이유>` 한 줄로 답한다.
```

- 답이 `flow <기능 이름>: 04_flows/<기능 이름>.md`이고 그 파일이 Glob으로 있으면: `DOC` = `04_flows/<기능 이름>.md`.
- `flow 없음`이거나 문서가 없으면: 그 기능을 찾지 못했다고 알리고, 후보를 최대 3개 보여 준 뒤 멈춘다. 후보는 manifest에서 찾는다: `FEATURE`의 핵심 단어(영어 식별자로도 바꿔 본다, 예: 로그인 → login, auth)로 `<OUT>/.doc-forge/manifest.json`을 Grep (`"path": ".*<단어>`, 정규식 특수문자는 `\`로 이스케이프, `head_limit: 3`)한 경로와, 이미 있는 `<OUT>/04_flows/*.md` 이름.

## 4. 검증과 한 번 수정

1. Agent 호출 (`subagent_type: "doc-forge:verifier"`, `description: "흐름 문서 검증"`). 프롬프트 = 공통 입력 블록 + `DOCS: ["<DOC>"]`.
2. 답에서 ``` 울타리를 걷고 JSON 배열로 파싱한다. 파싱이 안 되면 "verifier output unparseable"을 보고에 넣고 수정은 건너뛴다. `problem`이 `검색 범위 초과:`로 시작하는 지적은 보고에만.
3. 남은 지적이 있으면 flow-tracer를 한 번 더 부른다: 공통 입력 블록 + `FEATURE: <FEATURE>` + `FINDINGS: <지적 JSON 배열>`. 다시 검증하지 않는다.

## 5. check와 한 번 재처리

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/inventory.mjs" check "<REPO>" --out "<OUT>" --only "<DOC>"
```

`ok`가 false면 `brokenRefs`·`brokenLinks`·`leaks`를 지적으로 바꿔 (brokenRef → `{"doc":"<doc>","sentence":"근거 `<ref>`가 있는 문장","problem":"깨진 근거(<reason>): 실제 파일·줄 범위로 고치거나 근거를 지울 것","evidence":""}`, leak → `{"doc":"<doc>","sentence":"<line>번째 줄","problem":"비밀 값 유출 의심(<type> <pattern>): 값을 ***로 바꿀 것","evidence":""}`, brokenLink → `{"doc":"<doc>","sentence":"링크 `<link>`","problem":"링크 대상 없음 (<line>번째 줄): doc-style §7대로 대상 문서 경로는 manifest `doc`에서, 상대 경로는 `up`이나 `link` 명령으로 다시 만들 것. 문서가 없는 파일이면 링크 대신 백틱 경로로 쓸 것","evidence":""}`) flow-tracer 수정 실행(`FEATURE` + `FINDINGS`)을 한 번 하고 check를 다시 돌린다. 남은 문제는 보고에 넣는다.

## 6. 보고 (한국어)

- 흐름 문서: `<OUT>/<DOC>`
- 검증: 지적 수, 수정 여부
- check 결과(깨진 근거·깨진 링크·유출 의심 개수)와 추정 비율 (`estimates.ratio`를 %로)
- 남은 문제 (없으면 "없음")
- manifest가 오래됐을 수 있으면 (이번에 scan하지 않았으면) 코드가 바뀐 뒤라면 `/doc-forge:docs-all`로 manifest를 새로 만들 수 있다고 한 줄 안내
