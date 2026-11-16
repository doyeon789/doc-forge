---
name: doc-style
description: doc-forge 문서 작성 공통 규칙과 템플릿. doc-forge agent들이 문서를 쓰기 전에 읽는다.
user-invocable: false
---

# doc-style: doc-forge 문서 작성 규칙

문서를 쓰기 전에 이 파일 전체와, 아래 "템플릿 선택"에서 고른 템플릿을 읽는다.
템플릿은 이 파일과 같은 폴더의 `templates/` 안에 있다.
아래에서 `<INVENTORY>`는 지휘 skill이 프롬프트로 넘긴 `inventory.mjs`의 절대 경로, `<REPO>`는 대상 레포의 절대 경로다.

독자는 이 레포를 처음 보는 신입이다. 목표는 "코드를 읽었다"가 아니라 "구조와 이유를 이해했다"는 상태를 만드는 것이다.

## 1. 근거 표기

사실을 말하는 문장 끝에 근거를 백틱 안에 `경로:줄` 또는 `경로:시작-끝`으로 단다. 경로는 레포 루트 기준, 구분자는 `/`, 줄 번호는 1부터.
`check`는 백틱 안이 정확히 이 모양일 때만 근거로 세고, 파일이 있는지와 줄 범위가 파일 안인지 검사한다.

- 좋은 예: 토큰이 만료되면 401을 돌려준다 (`src/auth/JwtFilter.java:42-58`).
- 나쁜 예: 토큰이 만료되면 401을 돌려준다 (`JwtFilter.java` 42줄 근처).

추가 규칙:
- 한 백틱 안에 근거 하나. 여러 개면 백틱을 나눈다: (`a/B.java:3`, `a/C.java:9-12`).
- 근거가 아닌 코드 조각을 백틱에 넣을 때 `경로/이름:숫자` 모양을 만들지 않는다. `check`가 근거로 오인해 깨진 근거로 보고한다.
- 경로에 공백이 있으면 `check`가 그 근거를 검사하지 못한다. 형식은 똑같이 쓰고, 줄 번호를 특히 정확히 적는다.
- `secret` 파일은 줄 번호 없이 경로만 쓴다 (`keys` 출력은 원본 줄 번호를 보장하지 않는다).

## 2. 확인 / 추정 구분

모든 설명은 둘 중 하나다.
- **확인**: 코드에서 직접 본 사실. 근거(1절)를 단다. 따로 표시하지 않는다.
- **추정**: 코드만으로 의도를 알 수 없을 때. 문장을 `추정:`으로 시작하고 무엇을 보고 추정했는지 근거를 단다. `check`는 `추정:` 개수를 세어 추정 비율을 보고한다.

- 좋은 예: 추정: 예전 결제 모듈과의 호환용으로 남긴 메서드다. 호출하는 곳이 없고 이름이 `legacyPay`다 (`src/pay/PayService.java:88-95`).
- 나쁜 예: 이 메서드는 예전 결제 모듈과의 호환용이다. (근거도 `추정:`도 없음)

`추정:`은 그 문자 그대로 쓴다. "아마", "~인 듯" 같은 말로 대신하지 않는다.

## 3. 비밀 값 금지

- `secret: true`인 파일은 **절대 Read로 열지 않는다**. `node <INVENTORY> keys <REPO> <파일 경로>` 출력(키 이름과 구조, 값은 `***`)만 보고 문서화한다.
- 코드 안에 박힌 키·토큰·비밀번호도 이름만 쓰고 값은 `***`로 쓴다.
- `password`, `secret`, `token`, `api_key` 같은 단어 바로 뒤에 `=`나 `:`를 붙여 값처럼 보이는 글자를 쓰지 않는다. `check`의 유출 검사에 걸린다.
- **Grep도 비밀 파일을 열 수 있다.** content 모드 Grep은 걸린 줄(= 값)을 그대로 보여 준다. 레포 전체를 content 모드로 Grep할 때는 **항상** 아래 `glob`을 붙여 `secret` 파일을 뺀다 (`inventory.mjs`의 `secret` 판정과 같은 목록):

  ```
  !**/{.env,.env.*,application.yml,application.yaml,application.properties,application-*.yml,application-*.yaml,application-*.properties,*.pem,*.key,*.p12,*.pfx,*.jks,*.PEM,*.KEY,*.P12,*.PFX,*.JKS,id_rsa,id_dsa,id_ecdsa,id_ed25519,secret.*,secrets.*,Secret.*,Secrets.*,SECRET.*,SECRETS.*,credentials,Credentials,CREDENTIALS,credentials.json,Credentials.json,CREDENTIALS.json,credentials.yml,Credentials.yml,CREDENTIALS.yml,credentials.yaml,Credentials.yaml,CREDENTIALS.yaml,credentials.xml,Credentials.xml,CREDENTIALS.xml,credentials.ini,Credentials.ini,CREDENTIALS.ini,credentials.toml,Credentials.toml,CREDENTIALS.toml,credentials.txt,Credentials.txt,CREDENTIALS.txt,credentials.properties,Credentials.properties,CREDENTIALS.properties,credentials.env,Credentials.env,CREDENTIALS.env,appsettings*.json,AppSettings*.json,*.tfvars,.npmrc,.pypirc,.netrc,config/database.yml,*serviceAccount*.json,*serviceaccount*.json}
  ```

  `inventory.mjs`는 이 목록을 대소문자 구분 없이 맞춘다. 위 glob에 없는 대소문자 변형(예: `ID_RSA`)이라도 manifest·batch에서 `secret: true`이면 비밀 파일이다.

  `secret` 파일 하나를 `path`로 지정해 content 모드 Grep하지도 않는다. 비밀 파일이 어떤 키를 언급하는지 알아야 하면 `files_with_matches` 모드(파일 이름만 나옴)나 `keys` 출력만 쓴다. batch 목록에서 `secret: true`가 아니어도 위 목록에 맞는 파일은 같은 방식으로 다룬다.

- 좋은 예: `DB_PASSWORD`(값 `***`)로 DB 접속 비밀번호를 받는다 (`.env`).
- 나쁜 예: `DB_PASSWORD=s3cr3tPass`로 DB에 접속한다.

## 4. "한 줄씩 읽어 주기" 금지

코드를 문장으로 옮기지 않는다. 그 코드가 **왜** 있는지, **어디와 연결되는지**, 읽을 때 **무엇을 조심해야 하는지**를 쓴다.

- 좋은 예: 주문 저장 전에 재고를 먼저 잠근다. 동시 주문으로 재고가 음수가 되는 것을 막기 위해서다 (`src/order/OrderService.java:30-41`).
- 나쁜 예: 30줄에서 `stockRepo.lock()`을 호출하고, 31줄에서 `if`로 `null`을 검사하고, 32줄에서 ...

## 5. 숨은 연결 확인 목록

import·직접 호출만 보면 연결을 놓친다. 파일을 문서화할 때마다:
1. 이 파일의 클래스·함수·export 이름과 파일 이름(확장자 뺀 것)으로 레포 전체를 Grep해서 **이 파일을 부르는 곳**을 찾는다.
2. 아래 패턴을 이 파일에 Grep해서, 걸린 것이 있으면 그 상대편(주입되는 타입, 이벤트 이름, 라우트 경로, 설정 키, 로딩되는 이름)을 다시 레포 전체에서 Grep한다.
3. 파일 문서 "연결" 절에 **직접 연결**(import·호출)과 **숨은 연결**(아래 목록)을 나눠 적는다.

레포 전체 content 모드 Grep에는 3절의 비밀 파일 제외 `glob`을 반드시 붙인다.

### 패턴 목록

코드 블록 안에서 `#`으로 시작하는 줄은 언어 이름이고, 그 아래 줄이 **그대로** Grep의 `pattern`에 넣는 정규식이다 (ripgrep 문법, `|`는 "또는").

**DI(의존성 주입)**: 생성자 주입이면 생성자 인자 타입 이름을 다시 Grep한다.
```
# Java / Kotlin
@(Autowired|Inject|Bean|Component|Service|Repository|Controller|RestController|Configuration|RequiredArgsConstructor)\b
# JS / TS
@Injectable|@Inject\(|\binject\(|provide:\s
# Python
Depends\(|@inject\b
# Go
wire\.Build|fx\.Provide
```

**상속·인터페이스 구현**: 호출하는 쪽은 구현 클래스(`UserServiceImpl`)가 아니라 인터페이스(`UserService`)를 주입받는다. 이 파일이 구현·상속하는 타입 이름도 레포 전체에서 Grep해서, 그 타입을 쓰는 곳을 "이 파일을 부르는 곳"에 숨은 연결(인터페이스 경유)로 적는다. 인터페이스·부모 클래스를 문서화할 때는 `implements <이름>`, `extends <이름>`을 Grep해서 구현체 목록을 적는다.
```
# Java / JS / TS
\b(implements|extends)\s+\w+
# Kotlin
^\s*(\w+\s+)*class\s+\w+(\s*\(.*\))?\s*:\s*\w+
# Python
^class\s+\w+\(\w+
```

**이벤트**
```
# Java / Kotlin
@(EventListener|TransactionalEventListener)\b|publishEvent\(
# JS / TS
\.emit\(|\.on\(|addEventListener\(|\$emit\(
# Python
\.connect\(|@receiver\(|Signal\(
# Go
\bchan\b|Subscribe\(
```

**라우트**: Next.js·Nuxt처럼 폴더 구조가 곧 라우트인 경우(`pages/`, `app/`)는 Glob으로 확인한다.
```
# Java / Kotlin
@(Get|Post|Put|Delete|Patch|Request)Mapping\b|@RestController\b
# JS / TS
\b(app|router)\.(get|post|put|delete|patch|use)\(|path:\s*['"]
# Python
@\w+\.route\(|@router\.(get|post|put|delete|patch)\(|urlpatterns|\bpath\(
# Go
HandleFunc\(|\.(GET|POST|PUT|DELETE|PATCH)\(
```

**AOP·필터·인터셉터·전역 예외 처리**: 이 파일이 다른 코드 앞뒤에 끼어드는 경우. 대상(pointcut 식, URL 패턴, `addInterceptors`에 등록된 경로)을 적는다.
```
# Java / Kotlin (Spring)
@(Aspect|Around|Before|After|AfterReturning|AfterThrowing|Pointcut|ControllerAdvice|RestControllerAdvice|ExceptionHandler)\b|\b(implements|extends)\s+(Filter|OncePerRequestFilter|HandlerInterceptor|WebMvcConfigurer)\b
# JS / TS (NestJS 등)
@(UseGuards|UseInterceptors|UseFilters|Catch)\(
# Python
@app\.middleware|MIDDLEWARE\s*=
```

**MyBatis mapper**: `@Mapper` 인터페이스의 메서드는 XML의 `<select id="메서드 이름">` 등으로 구현된다. 인터페이스를 문서화하면 `namespace="<패키지.인터페이스 이름>"`을 `glob` `**/*.xml`로 Grep하고, XML을 문서화하면 namespace의 인터페이스 이름을 Java에서 Grep한다.
```
# Java
@Mapper\b
# XML
<mapper\s+namespace=|\bid="\w+"
```

**설정 바인딩**: 걸린 설정 키는 아래 "설정 파일 역방향 확인"처럼 설정 파일 쪽에서도 찾는다 (비밀 파일은 `files_with_matches` 모드로만).
```
# Java / Kotlin
@Value\(|@ConfigurationProperties|getProperty\(
# JS / TS
process\.env\.|import\.meta\.env\.|config\.get\(
# Python
os\.environ|os\.getenv\(|\bsettings\.
# Go
os\.Getenv\(|viper\.
```

**리플렉션·플러그인 로딩**: Java는 `META-INF/services/*` 파일도 Glob으로 확인한다.
```
# Java / Kotlin
Class\.forName\(|ServiceLoader|getBean\(
# JS / TS (문자열 리터럴이 아닌 인자로 불러오기)
\brequire\(\s*[^'"\s)]|\bimport\(\s*[^'"\s)]
# Python
importlib|__import__\(|getattr\(|entry_points
# Go
plugin\.Open\(|reflect\.
```

**스케줄·메시지**
```
# Java / Kotlin
@(Scheduled|KafkaListener|RabbitListener|JmsListener|SqsListener)\b
# JS / TS
cron\.schedule\(|\.subscribe\(|\.process\(
# Python
@shared_task|@\w+\.task\b|schedule\.every
# Go
AddFunc\(
```

### 설정 파일 역방향 확인 (`config` kind)

설정 파일은 코드가 불러 주지 않으면 의미가 없다. `templates/file-short.md`의 "영향을 주는 곳"을 채우려면 키마다 코드 쪽을 Grep한다 (키 목록은 파일을 Read하거나, `secret` 파일이면 `keys` 출력에서 얻는다). Spring은 표기를 바꿔 묶으므로(relaxed binding) 한 키를 여러 모양으로 찾는다. 키 `app.jwt.access-token-ttl`이면:
```
app\.jwt\.access-token-ttl|accessTokenTtl|APP_JWT_ACCESS_TOKEN_TTL
```
```
@ConfigurationProperties\((prefix\s*=\s*)?"app\.jwt"
```
첫 줄은 `@Value("${app.jwt.access-token-ttl}")`·필드 이름·환경 변수 표기를, 둘째 줄은 prefix로 묶어 받는 클래스를 찾는다. 키가 많으면 공통 prefix 단위로 찾는다.

- 좋은 예 (`03_files/src/order/OrderEventListener.java.md`에서, `up` = `../../..`): **숨은 연결**: `OrderCreatedEvent`를 `@EventListener`로 받는다. 발행하는 곳은 [`OrderService`](../../../03_files/src/order/OrderService.java.md)다 (`src/order/OrderService.java:55`).
- 나쁜 예: **연결**: 이 파일을 import하는 곳이 없다. (이벤트·DI로 불리는 경우를 확인하지 않음)

## 6. 템플릿 선택

| `kind` | 템플릿 |
|---|---|
| `source` | `templates/file.md`. 단, 50줄 이하이고 로직이 없으면(DTO, 상수 모음, 인터페이스 선언만, re-export만) `templates/file-short.md` |
| `test` | `templates/test.md` |
| `config`, `sql` | `templates/file-short.md` (`secret` 파일도 여기. 3절대로 `keys` 출력만 사용) |
| `doc`, `data` | 파일 문서 없음. `data`는 module 문서 "파일 구성"에 한 줄 목록으로 적는다 |

나머지 문서: module 문서는 `templates/module.md`, `00_개요.md`는 `templates/overview.md`, `01_아키텍처.md`는 `templates/architecture.md`, `04_flows/<기능>.md`는 `templates/flow.md`.

템플릿의 `<...>`는 채울 자리, 각 절 아래 한 줄 설명은 그 절에 쓸 내용이다. 설명 줄은 지우고 내용으로 바꾼다. 쓸 내용이 없는 절은 "없음"이라고 쓰고 지우지 않는다.

## 7. 문서 경로, 머리말, 문서 간 링크

### 문서 경로 (출력 폴더 기준)

| 문서 | 경로 |
|---|---|
| 파일 문서 | `03_files/<레포 경로>.md`. 단 `.`으로 시작하는 **폴더** 조각은 `_dot_<나머지>`로 바꾼다 (파일 이름은 그대로). 예: `src/a/B.java` → `03_files/src/a/B.java.md`, `.mvn/wrapper/w.properties` → `03_files/_dot_mvn/wrapper/w.properties.md`, `.env` → `03_files/.env.md` |
| module 문서 | `02_modules/<module id 조각마다 . 시작이면 _dot_로 바꾸고 / 를 __ 로 이은 것>.md` (예: `api/user` → `02_modules/api__user.md`, `.devcontainer` → `02_modules/_dot_devcontainer.md`) |
| 개요·아키텍처 | `00_개요.md`, `01_아키텍처.md` |
| 흐름 문서 | `04_flows/<기능 이름>.md` |

### 머리말의 기준 커밋

모든 문서는 제목 바로 아래에 기준 줄을 둔다. 값은 manifest(`.doc-forge/manifest.json`)의 `commit`에서 가져온다.
- `> 기준: <hash 앞 7자리>` , `dirty`가 true면 뒤에 ` (커밋 안 된 변경 포함)`
- `commit`이 `null`(git 아님)이면 `> 기준: git 저장소 아님 (스캔 <generatedAt의 날짜>)`

- 좋은 예: `> 기준: 3f9a2c1 (커밋 안 된 변경 포함)`
- 나쁜 예: `> 기준: 최신 버전`

### 상대 링크 만들기 (`../`를 세지 않는다)

링크는 지금 쓰는 문서의 위치에서 출발하는 상대 경로다. `../` 개수를 직접 세지 않는다. 두 값만 쓴다:

1. **대상 문서 경로** (OUT 기준): 직접 만들지 않고 가져온다.
   - 파일 문서: manifest `files[].doc` (batch 목록이면 각 파일의 `doc`). manifest에서 찾으려면 `<OUT>/.doc-forge/manifest.json`을 `"path": "<레포 경로>"`(정규식 특수문자는 `\`로 이스케이프)로 Grep하고 `-A 8`로 그 항목의 `"doc"`을 읽는다.
   - module 문서: manifest `modules[].doc` (batch 목록이면 `moduleDoc`).
   - `00_개요.md`, `01_아키텍처.md`, `04_flows/<이름>.md`는 그 이름 그대로.
2. **출발점**:
   - 파일 문서를 쓸 때: batch 목록의 그 파일 `up` 값(OUT 루트까지 올라가는 접두어, 예: `../../..`). 링크 = `<up>/<대상 문서 경로>`.
   - 그 밖의 문서: `node "<INVENTORY>" link "<REPO>" --from "<지금 문서 경로>" --to "<대상 문서 경로>"`가 출력하는 `{"link": "..."}`의 값을 그대로 쓴다 (공백이 있으면 이미 `<...>`로 감싸져 있다). Bash를 쓸 수 없으면: `02_modules/*.md`·`04_flows/*.md`에서는 `../<대상 문서 경로>`, `00_개요.md`·`01_아키텍처.md`에서는 `<대상 문서 경로>`.

**문서가 있는 파일만 링크한다.** `doc`가 없는 파일(kind `doc`·`data`, 예: `README.md`, 그리고 scan에서 제외된 파일)은 링크하지 않고 백틱 경로(`README.md`)로만 쓴다. `03_files/README.md.md` 같은 대상은 만들어지지 않는다.

예: `03_files/src/order/OrderService.java.md`(batch의 `up` = `../../..`)에서
- module 문서(`moduleDoc` = `02_modules/order.md`): `../../../02_modules/order.md`
- 아키텍처: `../../../01_아키텍처.md`
- 다른 파일 `src/pay/PayService.java`(manifest `doc` = `03_files/src/pay/PayService.java.md`): `../../../03_files/src/pay/PayService.java.md`
- `.mvn/wrapper/w.properties`(manifest `doc` = `03_files/_dot_mvn/wrapper/w.properties.md`): `../../../03_files/_dot_mvn/wrapper/w.properties.md`

경로에 공백이 있으면 링크 대상을 `<...>`로 감싼다: `[한글 파일](<../../03_files/lib/한글 파일.js.md>)`.

- 좋은 예: `> 소속: [module order](../../../02_modules/order.md) · [아키텍처](../../../01_아키텍처.md)`
- 나쁜 예: `> 소속: [module order](02_modules/order.md)` (파일 문서 위치에서 출발하지 않음)

`check`는 `.md`로 끝나는 상대 링크가 실제 문서로 이어지는지 본다. 출력 폴더 밖으로 나가는 링크도 깨진 링크다.

연결 절에서 다른 파일을 말할 때는 그 파일의 문서로 링크하고, 근거는 원본 코드 위치로 단다. module 문서는 소속 파일 문서를 모두 링크한다.

## 8. Mermaid

- 다이어그램 하나에 노드 15개 이하. 넘치면 계층·module별로 다이어그램을 나눈다.
- 노드 ID는 영문·숫자, 라벨은 `ID["한글 라벨"]`처럼 큰따옴표 안에. 라벨 안에 큰따옴표가 필요하면 `#quot;`로 쓴다.
- 엣지 라벨도 따옴표로: `A -->|"호출"| B`. 순서도(`sequenceDiagram`)의 참여자는 `participant C as 컨트롤러`.

- 좋은 예: `OrderSvc["주문 서비스 (OrderService)"] -->|"재고 잠금"| StockRepo["재고 저장소"]`
- 나쁜 예: `주문 서비스(OrderService) --> 재고 저장소` (한글 ID, 따옴표 없는 괄호로 렌더링 실패)

## 9. 기타

- 문서는 한국어로, 코드 식별자(클래스·함수·변수·설정 키 이름)는 원문 그대로 백틱 안에 쓴다.
- 대상 레포는 읽기 전용이다. 쓰기는 출력 폴더에만 한다.
- 자기 담당 문서만 쓴다. 다른 agent가 쓰는 문서를 고치지 않는다.
