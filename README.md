# doc-forge

문서가 없는 레포를 **처음부터 끝까지 전부 읽고**, 새로 들어온 사람이 한 번에 이해할 수 있는 한국어 문서를 만드는 [Claude Code](https://claude.com/claude-code) 플러그인입니다.

```
docs/doc-forge/
├─ 00_개요.md            무엇을 · 왜 하는 프로젝트인지, 기술 스택, 추천 읽기 순서, 실행 방법
├─ 01_아키텍처.md        계층 구조, 요청 · 데이터 흐름, Mermaid 다이어그램
├─ 02_modules/           module마다: 역할, 파일 구성, 다른 module과의 관계
├─ 03_files/             파일마다: 왜 있는지, 핵심 구성요소, 부르는 곳 · 불리는 곳, 숨은 연결
└─ 04_flows/             기능 하나를 시작 지점부터 따라가는 흐름 문서
```

## 무엇이 다른가

- **빠짐없이 읽는다.** 스크립트가 레포의 파일 목록을 만들고, 문서가 없는 파일이 하나라도 있으면 검사에서 실패합니다. "주요 파일 몇 개만 요약"하지 않습니다.
- **모든 설명에 근거가 있다.** 문장마다 `` `src/order/OrderService.java:42-58` `` 같은 근거를 붙이고, 근거가 실제로 있는 파일 · 줄인지 기계적으로 검사합니다. 코드로 확인 못 한 내용은 `추정:`으로 따로 표시합니다.
- **검토 agent가 코드와 대조한다.** 쓴 agent와 다른 agent가 문서를 실제 코드와 맞춰 보고, 틀린 문장만 고칩니다.
- **숨은 연결까지 찾는다.** import뿐 아니라 Spring DI, 이벤트, 라우트 등록, 설정 바인딩, MyBatis 매퍼처럼 코드에 바로 보이지 않는 연결을 찾아 적습니다.
- **비밀 값을 문서에 넣지 않는다.** `.env` 같은 비밀 파일은 열지 않고 키 이름만 보며, 문서에 비밀 값이 들어갔는지 자동으로 검사합니다.
- **중간에 멈춰도 이어서 한다.** 다시 실행하면 끝난 부분은 건너뛰고, 바뀐 파일이 든 부분만 다시 처리합니다.

## 빠른 시작

### 1. 설치

Claude Code 안에서:

```
/plugin marketplace add doyeon789/doc-forge
/plugin install doc-forge@doc-forge
```

또는 레포를 받아 폴더를 직접 지정해 켭니다:

```bash
git clone https://github.com/doyeon789/doc-forge.git
cd <문서를 만들 레포>
claude --plugin-dir "<doc-forge 폴더 경로>"
```

### 2. 실행

문서를 만들 레포 폴더에서 Claude Code를 켜고:

```
/doc-forge:docs-all
```

결과는 `docs/doc-forge/`에 생깁니다. `00_개요.md`부터 읽으세요.

### 먼저 예제로 시험해 보기

`examples/mini-shop/`은 일부러 숨은 연결(동적 라우트 등록, 이벤트, 환경변수)과 가짜 비밀 값을 넣어 둔 작은 Express 앱입니다.

```bash
cp -r examples/mini-shop /tmp/mini-shop && cd /tmp/mini-shop
git init -q && git add -A && git commit -qm init
claude --plugin-dir "<doc-forge 폴더 경로>"
# Claude Code 안에서: /doc-forge:docs-all
```

## 필요한 것

- Claude Code
- Node.js 18 이상 (보조 스크립트 `scripts/inventory.mjs`, 외부 의존성 없음)
- **Windows**: Claude Code의 Bash 도구가 Git Bash여야 합니다 (명령이 POSIX 문법).
- **권한**: agent가 `node`를 실행합니다. `Bash(node:*)`을 허용하세요. 거부되면 비밀 파일 문서를 키 이름 없이 쓰게 됩니다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `/doc-forge:docs-all [--fresh] [--out <dir>]` | 레포 전체 문서화 (개요 · 아키텍처 · module · 파일) 후 검증 |
| `/doc-forge:docs-file <파일 경로> [--out <dir>]` | 파일 하나의 문서를 만들거나 다시 만든다 |
| `/doc-forge:docs-module <module 또는 폴더> [--out <dir>]` | module 하나의 파일 문서들과 module 문서를 만든다 |
| `/doc-forge:docs-flow "<기능 설명>" [--out <dir>]` | 기능 하나(예: "주문 생성")의 흐름 문서를 만든다 (Mermaid 순서도 포함) |

- `--fresh`: 이전 진행 상태를 버리고 처음부터 다시 합니다.
- `--out <dir>`: 출력 폴더 (기본 `<레포 루트>/docs/doc-forge`). 다른 명령도 `docs-all`과 같은 값을 줘야 같은 출력 폴더를 씁니다.
- 처리할 묶음(batch)이 20개를 넘으면 시작 전에 규모를 보여 주고 진행 여부를 묻습니다. 큰 레포는 시간과 토큰이 많이 듭니다.

## 동작 방식

```
/doc-forge:docs-all
 ├─ ① scan ─────────────── 파일 목록 · 종류 · module 판정, 묶음(batch) 나누기 → manifest.json
 ├─ ② file-documenter ×N ─ 묶음마다 파일 문서 작성 (한 번에 최대 5개 동시)
 ├─ ③ module-synthesizer ─ module 문서 작성
 ├─ ④ architect ────────── 개요 · 아키텍처 문서 작성
 ├─ ⑤ verifier ─────────── 상위 문서 전부 + 파일 문서 20% 표본을 코드와 대조, 틀린 문장만 수정
 └─ ⑥ check ────────────── 누락 · 깨진 근거 · 깨진 링크 · 비밀 값 유출 검사, 문제 있는 부분만 한 번 더 처리
```

| 구성 | 역할 |
|---|---|
| `skills/docs-*` | 사용자가 부르는 명령. 순서를 지휘한다 |
| `skills/doc-style` | 모든 agent가 따르는 문서 작성 규칙과 템플릿 |
| `agents/` | 파일 · module · 개요 · 흐름을 쓰는 agent와 검토 agent |
| `scripts/inventory.mjs` | 파일 목록, 묶음 나누기, 근거 · 링크 · 비밀 값 검사 같은 기계적인 일 |

출력 폴더를 통째로 지우지 않습니다. 각 명령은 자기가 만드는 파일만 덮어쓰고, `docs-all`은 `04_flows/`를 건드리지 않습니다.

## 비밀 값 처리

- `.env*`, `*.pem` · `*.key` 같은 키 파일, `application*.yml|properties`, `secret(s).*`, `credentials.*`, `appsettings*.json`, `*.tfvars`, `.npmrc` 등을 비밀 파일로 봅니다 (전체 목록은 `scripts/inventory.mjs`의 `SECRET_FILE_PATTERNS`).
- agent는 비밀 파일을 열지 않고 `inventory.mjs keys`로 **키 이름과 구조만** 받습니다 (값은 `***`).
- 값은 어디에도 저장하지 않습니다. 마지막 검사 때만 읽어 문서에 들어갔는지 비교하고 버립니다. AWS 키, JWT, private key, `password=...`, URL 속 자격 증명 같은 흔한 모양도 함께 찾습니다.
- `manifest.json`에는 변경 감지용으로 모든 파일의 sha1이 들어갑니다. 출력 폴더를 공개할 때는 `.doc-forge/`를 빼세요.

## 알려진 한계

- 근거 검사는 공백이 든 경로와, `/`가 없으면서 실제로 없는 경로(`127.0.0.1:80` 같은 것)는 보지 않습니다.
- 묶음은 줄 수로 나눕니다 (묶음당 최대 2,500줄 · 25개 파일). 코드 난이도는 보지 않습니다.
- Claude Code는 `.mvn` 같은 `.`으로 시작하는 폴더 아래에 파일을 쓰지 않아서, 문서 경로에서는 그 폴더를 `_dot_mvn`처럼 바꿉니다.
- 비밀 값 대조는 키 이름이 비밀처럼 보이는 값(`password`, `secret`, `token`, `..._key` 등)만 씁니다. `.example` · `.sample` · `.template` 파일의 값은 자리표시자로 보고 대조하지 않습니다.
- 이어하기 판단은 파일 수정 시각을 씁니다. 출력 폴더를 복사해 시각이 바뀌면 판단이 틀릴 수 있습니다.
- 코드 주석이 오래된 결정을 담고 있으면 문서도 그대로 옮길 수 있습니다. 팀 결정 문서가 있다면 함께 확인하세요.

## 개발

```bash
node --test
```

## 라이선스

[MIT](LICENSE)
