---
name: doc-style
description: Shared writing rules and templates for doc-forge docs. doc-forge agents read this before writing any doc.
user-invocable: false
---

# doc-style: doc-forge writing rules

Before writing a doc, read this whole file and the template chosen under "Template selection" below.
Templates live in `templates/<LANG>/` next to this file (one folder per language code, e.g. `templates/en/`; same file names and section structure in every language).
Below, `<INVENTORY>` is the absolute path of `inventory.mjs` that the conducting skill passed in your prompt, `<REPO>` is the absolute path of the target repo, `<LANG>` is the output language code and `<TOP_DOCS>` is the `{"overview", "architecture"}` object of top-level doc names, both from your prompt (see §9).

The reader is a newcomer seeing this repo for the first time. The goal is not "the code was read" but "the structure and the reasons are understood".

## 1. Citations

End every sentence that states a fact with a citation in backticks: `path:line` or `path:start-end`. Paths are relative to the repo root, use `/`, and lines start at 1.
`check` counts a backticked span as a citation only when it has exactly this shape, and checks that the file exists and the line range lies inside it.

- Good: Returns 401 when the token has expired (`src/auth/JwtFilter.java:42-58`).
- Bad: Returns 401 when the token has expired (`JwtFilter.java` around line 42).

More rules:
- One citation per backtick span. For several, split the spans: (`a/B.java:3`, `a/C.java:9-12`).
- When you put a code snippet that is not a citation in backticks, do not give it the `path/name:number` shape. `check` would take it for a citation and report it as broken.
- `check` cannot verify a citation whose path contains a space. Write it in the same format, and be especially careful with the line numbers.
- For a `secret` file, cite the path only, without line numbers (`keys` output does not keep the original line numbers).

## 2. Confirmed vs. assumed

Every statement is one of two kinds.
- **Confirmed**: a fact you saw in the code. It carries a citation (§1). No extra marker.
- **Assumed**: the code alone does not reveal the intent. Start the sentence with the estimate marker for `<LANG>` and cite what you based the guess on. `check` counts the markers and reports the estimate ratio.

| `LANG` | Estimate marker |
|---|---|
| `en` | `Assumption:` |
| `ko` | `추정:` |

- Good (`en`): Assumption: kept for compatibility with the old payment module. Nothing calls it and its name is `legacyPay` (`src/pay/PayService.java:88-95`).
- Good (`ko`): 추정: 예전 결제 모듈과의 호환용으로 남긴 메서드다. 호출하는 곳이 없고 이름이 `legacyPay`다 (`src/pay/PayService.java:88-95`).
- Bad: This method exists for compatibility with the old payment module. (no citation, no marker)

Write the marker exactly as shown. Do not replace it with "probably", "seems to", "아마", "~인 듯" and the like.

## 3. No secret values

- **Never Read** a file with `secret: true`. Document it only from the output of `node <INVENTORY> keys <REPO> <file path>` (key names and structure; values are `***`).
- Keys, tokens and passwords hard-coded in source: write the name only, and the value as `***`.
- Never write `=` or `:` right after words like `password`, `secret`, `token`, `api_key` followed by something that looks like a value. `check`'s leak scan flags it.
- **Grep can open secret files too.** Content-mode Grep prints the matching lines (= the values). Whenever you content-Grep the whole repo, **always** add the `glob` below to leave out `secret` files (the same list as the `secret` rule in `inventory.mjs`):

  ```
  !**/{.env,.env.*,application.yml,application.yaml,application.properties,application-*.yml,application-*.yaml,application-*.properties,*.pem,*.key,*.p12,*.pfx,*.jks,*.PEM,*.KEY,*.P12,*.PFX,*.JKS,id_rsa,id_dsa,id_ecdsa,id_ed25519,secret.*,secrets.*,Secret.*,Secrets.*,SECRET.*,SECRETS.*,credentials,Credentials,CREDENTIALS,credentials.json,Credentials.json,CREDENTIALS.json,credentials.yml,Credentials.yml,CREDENTIALS.yml,credentials.yaml,Credentials.yaml,CREDENTIALS.yaml,credentials.xml,Credentials.xml,CREDENTIALS.xml,credentials.ini,Credentials.ini,CREDENTIALS.ini,credentials.toml,Credentials.toml,CREDENTIALS.toml,credentials.txt,Credentials.txt,CREDENTIALS.txt,credentials.properties,Credentials.properties,CREDENTIALS.properties,credentials.env,Credentials.env,CREDENTIALS.env,appsettings*.json,AppSettings*.json,*.tfvars,.npmrc,.pypirc,.netrc,config/database.yml,*serviceAccount*.json,*serviceaccount*.json}
  ```

  `inventory.mjs` matches this list case-insensitively. A case variant missing from the glob above (e.g. `ID_RSA`) is still a secret file if the manifest or batch says `secret: true`.

  Never content-Grep a single `secret` file by `path` either. If you need to know whether a secret file mentions a key, use `files_with_matches` mode (file names only) or the `keys` output. Treat any file that matches the list above the same way, even if the batch does not mark it `secret: true`.

- Good: The DB password comes from `DB_PASSWORD` (value `***`) (`.env`).
- Bad: Connects to the DB with `DB_PASSWORD=s3cr3tPass`.

## 4. No line-by-line narration

Do not translate code into sentences. Write **why** the code is there, **where it connects**, and **what to watch out for** when reading it.

- Good: Locks the stock before saving the order, so that concurrent orders cannot drive the stock negative (`src/order/OrderService.java:30-41`).
- Bad: Line 30 calls `stockRepo.lock()`, line 31 checks for `null` with an `if`, line 32 ...

## 5. Hidden-connection checklist

Imports and direct calls alone miss connections. For every file you document:
1. Grep the whole repo for this file's class/function/export names and its file name (without extension) to find **who calls this file**.
2. Grep this file for the patterns below. For every hit, Grep the whole repo again for the counterpart (injected type, event name, route path, config key, loaded name).
3. In the file doc's Connections section, separate **direct connections** (imports, calls) from **hidden connections** (the list below).

Every repo-wide content-mode Grep must carry the secret-exclusion `glob` from §3.

### Pattern list

In the code blocks below, a line starting with `#` names the language, and the line under it is a regex to put **as is** into Grep's `pattern` (ripgrep syntax, `|` means "or").

**DI (dependency injection)**: for constructor injection, Grep the constructor parameter type names again.
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

**Inheritance and interface implementation**: callers inject the interface (`UserService`), not the implementation class (`UserServiceImpl`). Grep the repo for the types this file implements or extends too, and list the places that use those types under "who calls this file" as hidden connections (via interface). When documenting an interface or parent class, Grep `implements <name>` and `extends <name>` and list the implementations.
```
# Java / JS / TS
\b(implements|extends)\s+\w+
# Kotlin
^\s*(\w+\s+)*class\s+\w+(\s*\(.*\))?\s*:\s*\w+
# Python
^class\s+\w+\(\w+
```

**Events**
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

**Routes**: where the folder structure is the route (Next.js, Nuxt: `pages/`, `app/`), check with Glob.
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

**AOP, filters, interceptors, global exception handling**: this file wraps other code. Write down the target (pointcut expression, URL pattern, paths registered in `addInterceptors`).
```
# Java / Kotlin (Spring)
@(Aspect|Around|Before|After|AfterReturning|AfterThrowing|Pointcut|ControllerAdvice|RestControllerAdvice|ExceptionHandler)\b|\b(implements|extends)\s+(Filter|OncePerRequestFilter|HandlerInterceptor|WebMvcConfigurer)\b
# JS / TS (NestJS etc.)
@(UseGuards|UseInterceptors|UseFilters|Catch)\(
# Python
@app\.middleware|MIDDLEWARE\s*=
```

**MyBatis mapper**: methods of a `@Mapper` interface are implemented in XML by `<select id="method name">` and the like. When documenting the interface, Grep `namespace="<package.InterfaceName>"` with `glob` `**/*.xml`; when documenting the XML, Grep Java for the namespace's interface name.
```
# Java
@Mapper\b
# XML
<mapper\s+namespace=|\bid="\w+"
```

**Config binding**: also look up each matched config key from the config-file side, as in "Reverse check for config files" below (secret files only in `files_with_matches` mode).
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

**Reflection and plugin loading**: for Java, also check `META-INF/services/*` files with Glob.
```
# Java / Kotlin
Class\.forName\(|ServiceLoader|getBean\(
# JS / TS (loading with a non-literal argument)
\brequire\(\s*[^'"\s)]|\bimport\(\s*[^'"\s)]
# Python
importlib|__import__\(|getattr\(|entry_points
# Go
plugin\.Open\(|reflect\.
```

**Schedules and messaging**
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

### Reverse check for config files (`config` kind)

A config file means nothing unless code reads it. To fill "Where it has effect" in `templates/<LANG>/file-short.md`, Grep the code side for every key (get the keys by reading the file, or from `keys` output for a `secret` file). Spring binds different spellings of one key (relaxed binding), so search one key in several shapes. For the key `app.jwt.access-token-ttl`:
```
app\.jwt\.access-token-ttl|accessTokenTtl|APP_JWT_ACCESS_TOKEN_TTL
```
```
@ConfigurationProperties\((prefix\s*=\s*)?"app\.jwt"
```
The first line finds `@Value("${app.jwt.access-token-ttl}")`, field names and the environment-variable spelling; the second finds classes that bind the whole prefix. With many keys, search by common prefix.

- Good (in `03_files/src/order/OrderEventListener.java.md`, `up` = `../../..`): **Hidden connections**: receives `OrderCreatedEvent` via `@EventListener`. It is published by [`OrderService`](../../../03_files/src/order/OrderService.java.md) (`src/order/OrderService.java:55`).
- Bad: **Connections**: nothing imports this file. (did not check event or DI callers)

## 6. Template selection

| `kind` | Template |
|---|---|
| `source` | `templates/<LANG>/file.md`. But if it has 50 lines or fewer and no logic (DTO, constants, interface declarations only, re-exports only): `templates/<LANG>/file-short.md` |
| `test` | `templates/<LANG>/test.md` |
| `config`, `sql` | `templates/<LANG>/file-short.md` (`secret` files too; use only `keys` output, per §3) |
| `doc`, `data` | No file doc. `data` files are listed one line each under the module doc's Files section |

Other docs: module docs use `templates/<LANG>/module.md`, `<TOP_DOCS.overview>` uses `templates/<LANG>/overview.md`, `<TOP_DOCS.architecture>` uses `templates/<LANG>/architecture.md`, and `04_flows/<feature>.md` uses `templates/<LANG>/flow.md`.

In a template, `<...>` marks a slot to fill (`<TOP_DOCS.overview>` / `<TOP_DOCS.architecture>` are the names from your prompt), and the one-line description under each section says what goes there. Replace the description line with the content. If a section has nothing to say, write "none" (in `<LANG>`) instead of deleting it.

## 7. Doc paths, header, links between docs

### Doc paths (relative to the output folder)

| Doc | Path |
|---|---|
| File doc | `03_files/<repo path>.md`. A **directory** segment starting with `.` becomes `_dot_<rest>` (file names stay). E.g. `src/a/B.java` → `03_files/src/a/B.java.md`, `.mvn/wrapper/w.properties` → `03_files/_dot_mvn/wrapper/w.properties.md`, `.env` → `03_files/.env.md` |
| Module doc | `02_modules/<module id, each segment starting with . turned into _dot_, joined with __>.md` (e.g. `api/user` → `02_modules/api__user.md`, `.devcontainer` → `02_modules/_dot_devcontainer.md`) |
| Overview, architecture | `<TOP_DOCS.overview>`, `<TOP_DOCS.architecture>`: e.g. `00_overview.md`, `01_architecture.md` for `en`; each language has its own names in `OUTPUT_LANGS`. Always take them from `TOP_DOCS` (they come from `inventory.mjs`); never type them yourself |
| Flow doc | `04_flows/<feature name>.md` |

### Base commit in the header

Every doc has a base line right under its title. The values come from `commit` in the manifest (`.doc-forge/manifest.json`).

| `LANG` | Git repo | `dirty` is true: append | Not a git repo (`commit` is `null`) |
|---|---|---|---|
| `en` | `> Based on: <first 7 chars of hash>` | ` (includes uncommitted changes)` | `> Based on: not a git repository (scanned <date of generatedAt>)` |
| `ko` | `> 기준: <hash 앞 7자리>` | ` (커밋 안 된 변경 포함)` | `> 기준: git 저장소 아님 (스캔 <generatedAt의 날짜>)` |

- Good: `> Based on: 3f9a2c1 (includes uncommitted changes)` / `> 기준: 3f9a2c1 (커밋 안 된 변경 포함)`
- Bad: `> Based on: latest version`

### Building relative links (never count `../`)

A link is a relative path starting from the location of the doc you are writing. Never count `../` yourself. Use only two values:

1. **Target doc path** (relative to OUT): look it up, never build it.
   - File doc: manifest `files[].doc` (in a batch list, each file's `doc`). To find it in the manifest, Grep `<OUT>/.doc-forge/manifest.json` for `"path": "<repo path>"` (regex special characters escaped with `\`) with `-A 8` and read the entry's `"doc"`.
   - Module doc: manifest `modules[].doc` (in a batch list, `moduleDoc`).
   - `<TOP_DOCS.overview>`, `<TOP_DOCS.architecture>`, `04_flows/<name>.md` as they are.
2. **Starting point**:
   - When writing a file doc: that file's `up` value from the batch list (the prefix up to the OUT root, e.g. `../../..`). Link = `<up>/<target doc path>`.
   - Any other doc: use the value of `{"link": "..."}` printed by `node "<INVENTORY>" link "<REPO>" --from "<this doc path>" --to "<target doc path>"` as is (already wrapped in `<...>` if it has a space). Without Bash: from `02_modules/*.md` and `04_flows/*.md` use `../<target doc path>`; from the overview and architecture docs use `<target doc path>`.

**Link only files that have a doc.** A file without `doc` (kind `doc`/`data`, e.g. `README.md`, and files excluded by scan) is never linked; write its backticked path (`README.md`) instead. Targets like `03_files/README.md.md` are never created.

Example from `03_files/src/order/OrderService.java.md` (batch `up` = `../../..`, `LANG` = `en`):
- module doc (`moduleDoc` = `02_modules/order.md`): `../../../02_modules/order.md`
- architecture: `../../../01_architecture.md`
- another file `src/pay/PayService.java` (manifest `doc` = `03_files/src/pay/PayService.java.md`): `../../../03_files/src/pay/PayService.java.md`
- `.mvn/wrapper/w.properties` (manifest `doc` = `03_files/_dot_mvn/wrapper/w.properties.md`): `../../../03_files/_dot_mvn/wrapper/w.properties.md`

If a path has a space, wrap the link target in `<...>`: `[my file](<../../03_files/lib/my file.js.md>)`.

- Good: `> Part of: [module order](../../../02_modules/order.md) · [Architecture](../../../01_architecture.md)`
- Bad: `> Part of: [module order](02_modules/order.md)` (does not start from the file doc's location)

`check` verifies that every relative link ending in `.md` leads to an existing doc. A link leaving the output folder is broken too.

When the Connections section mentions another file, link to that file's doc and cite the original code location. A module doc links all of its files' docs.

## 8. Mermaid

- At most 15 nodes per diagram. If there are more, split by layer or module.
- Node IDs are ASCII letters and digits; labels go inside double quotes, like `ID["label"]`. For a double quote inside a label, write `#quot;`.
- Edge labels are quoted too: `A -->|"calls"| B`. Sequence diagram participants: `participant C as Controller`.

- Good (`en`): `OrderSvc["Order service (OrderService)"] -->|"locks stock"| StockRepo["Stock repository"]`
- Good (`ko`): `OrderSvc["주문 서비스 (OrderService)"] -->|"재고 잠금"| StockRepo["재고 저장소"]`
- Bad: `주문 서비스(OrderService) --> 재고 저장소` (non-ASCII ID and unquoted parentheses break rendering)

## 9. Output language

`LANG` (a key of `OUTPUT_LANGS` in `inventory.mjs`, default `en`) comes from the manifest's `settings.lang` and is passed in your prompt.
- Write all prose, headings, link text, Mermaid labels, "none" placeholders and the estimate marker (§2) in `LANG`. Use the header line of §7 for `LANG`.
- Use the templates in `templates/<LANG>/`. This file refers to their sections by the English (`en`) heading; every other language's template has the same section at the same position.
- Code identifiers (class, function, variable and config key names), file paths and citations stay verbatim, in backticks.
- Top-level doc names come from `TOP_DOCS`; folder names `02_modules/`, `03_files/`, `04_flows/` are the same in every language. A flow doc's file name (`04_flows/<feature name>.md`) is written in `LANG`.

## 10. Other

- The target repo is read-only. Write only to the output folder.
- Write only your own docs. Never edit docs that another agent writes.
