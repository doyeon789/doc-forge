import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = { maxLines: 2500, maxFiles: 25, moduleSplitThreshold: 40, sampleRate: 0.2 };

// Output language: top-level doc names and the estimate marker (doc-style "Output language").
const TOP_DOCS = {
  en: { overview: '00_overview.md', architecture: '01_architecture.md' },
  ko: { overview: '00_개요.md', architecture: '01_아키텍처.md' },
};
export const LANG_CODES = Object.keys(TOP_DOCS);
export const ESTIMATE_MARKERS = ['Assumption:', '추정:'];
export function topDocs(lang) {
  if (!TOP_DOCS[lang]) throw new Error(`--lang must be one of: ${LANG_CODES.join(', ')}`);
  return { ...TOP_DOCS[lang] };
}

export function countLines(text) {
  if (text === '') return 0;
  const parts = text.split(/\r\n|\r|\n/);
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.length;
}

const LANGS = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  vue: 'vue', svelte: 'svelte', java: 'java', kt: 'kotlin', kts: 'kotlin', py: 'python', go: 'go', rs: 'rust',
  rb: 'ruby', php: 'php', cs: 'csharp', cpp: 'cpp', cc: 'cpp', c: 'c', h: 'c', hpp: 'cpp', swift: 'swift',
  scala: 'scala', dart: 'dart', sh: 'shell', bash: 'shell', ps1: 'powershell', html: 'html', css: 'css',
  scss: 'scss', sql: 'sql', md: 'markdown', mdx: 'markdown', rst: 'rst', json: 'json', yml: 'yaml', yaml: 'yaml',
  toml: 'toml', ini: 'ini', properties: 'properties', xml: 'xml', gradle: 'gradle', csv: 'csv', tsv: 'csv',
};
const CODE_LANGS = new Set(['javascript', 'typescript', 'vue', 'svelte', 'java', 'kotlin', 'python', 'go', 'rust',
  'ruby', 'php', 'csharp', 'cpp', 'c', 'swift', 'scala', 'dart', 'shell', 'powershell']);
const CONFIG_EXT = new Set(['json', 'yml', 'yaml', 'toml', 'ini', 'properties', 'xml', 'gradle']);

export function classify(relPath, text) {
  const base = relPath.split('/').pop();
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  const lang = LANGS[ext] ?? (base === 'Dockerfile' ? 'dockerfile' : base === 'Makefile' ? 'makefile' : 'text');
  const isEnv = /^\.env(\.|$)/.test(base);

  let kind;
  if (ext === 'sql') kind = 'sql';
  else if (['md', 'mdx', 'rst', 'adoc'].includes(ext)) kind = 'doc';
  else if (ext === 'csv' || ext === 'tsv' || (ext === 'json' && /(^|\/)(fixtures?|testdata|__fixtures__|mocks?|data)\//.test(relPath))) kind = 'data';
  else if (CODE_LANGS.has(lang) && (/(^|\/)(tests?|__tests__|spec)\//.test(relPath)
    || /\.(test|spec)\.[^/]+$/.test(base) || /Tests?\.(java|kt)$/.test(base) || /^test_.*\.py$/.test(base) || /_test\.go$/.test(base))) kind = 'test';
  else if (CONFIG_EXT.has(ext) || base === 'Dockerfile' || base === 'Makefile' || isEnv) kind = 'config';
  else kind = 'source';

  const secret = SECRET_RES.some(re => re.test(relPath));
  return { lang, kind, secret };
}

// Secret file globs, matched case-insensitively against the file name (or the path tail for patterns with '/').
// doc-style §3's Grep exclusion glob must list exactly these (plugin.test.mjs checks it).
export const SECRET_FILE_PATTERNS = ['.env', '.env.*', 'application.yml', 'application.yaml', 'application.properties',
  'application-*.yml', 'application-*.yaml', 'application-*.properties', '*.pem', '*.key', '*.p12', '*.pfx', '*.jks',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'secret.*', 'secrets.*', 'credentials', 'credentials.json', 'credentials.yml', 'credentials.yaml', 'credentials.xml', 'credentials.ini', 'credentials.toml', 'credentials.txt', 'credentials.properties', 'credentials.env', 'appsettings*.json', '*.tfvars',
  '.npmrc', '.pypirc', '.netrc', 'config/database.yml', '*serviceAccount*.json'];
const SECRET_RES = SECRET_FILE_PATTERNS.map(g => new RegExp(`(^|/)${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`, 'i'));

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'target', 'out', '.next', '.nuxt', 'coverage',
  'vendor', '__pycache__', '.gradle', '.idea', '.vscode', 'venv', '.venv']);
const LOCKFILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Cargo.lock', 'Gemfile.lock', 'composer.lock', 'go.sum']);
const ASSET_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg', 'tiff', 'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'jar', 'war', 'pdf']);

async function excludeReason(repo, rel, outRel) {
  if (outRel && (rel === outRel || rel.startsWith(outRel + '/'))) return 'output-dir';
  const segs = rel.split('/');
  if (segs.slice(0, -1).some(s => EXCLUDED_DIRS.has(s))) return 'excluded-dir';
  const base = segs[segs.length - 1];
  if (LOCKFILES.has(base)) return 'lockfile';
  if (/\.(min\.js|min\.css|map)$/.test(base)) return 'minified';
  if (ASSET_EXT.has(base.split('.').pop().toLowerCase())) return 'asset';
  const fh = await fs.open(path.join(repo, ...segs), 'r');
  try {
    const buf = Buffer.alloc(8192);
    const { bytesRead } = await fh.read(buf, 0, 8192, 0);
    if (buf.subarray(0, bytesRead).includes(0)) return 'binary';
  } finally { await fh.close(); }
  return null;
}

async function walk(repo, dir = '') {
  const out = [];
  for (const e of await fs.readdir(path.join(repo, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!EXCLUDED_DIRS.has(e.name)) out.push(...await walk(repo, rel)); }
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

export async function listFiles(repo, { outRel } = {}) {
  let all;
  const isGit = await fs.stat(path.join(repo, '.git')).then(() => true, () => false);
  if (isGit) {
    const raw = execFileSync('git', ['-C', repo, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { maxBuffer: 1 << 28 }).toString('utf8');
    all = [...new Set(raw.split('\0').filter(Boolean))].map(p => p.split(path.sep).join('/'));
  } else all = (await walk(repo)).map(p => p.split(path.sep).join('/'));

  const files = [], excluded = [];
  for (const rel of all.sort()) {
    let reason;
    try { reason = await excludeReason(repo, rel, outRel); }
    catch (e) {
      if (e.code === 'ENOENT') continue; // tracked but deleted
      reason = 'unreadable';
    }
    if (reason === 'output-dir') continue; // our own docs are not part of the repo's file count
    if (reason) excluded.push({ path: rel, reason }); else files.push(rel);
  }
  return { files, excluded };
}

export const BUILD_FILES = ['package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'pyproject.toml', 'setup.py', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile'];
const SRC_PREFIXES = ['src/main/java/', 'src/main/kotlin/', 'src/test/java/', 'src/test/kotlin/', 'src/main/resources/', 'src/test/resources/', 'src/', 'lib/', 'app/'];

export function assignModules(paths, buildRoots) {
  // per file: project root and the folder segments left after stripping source-root prefixes
  const info = paths.map(p => {
    if (!p.includes('/')) return { p, root: true };
    const proot = buildRoots.filter(r => r === '' || p.startsWith(r + '/')).sort((a, b) => b.length - a.length)[0];
    if (proot === undefined) { const [first, ...rest] = p.split('/'); return { p, proot: first, dirs: [], rest }; }
    let rel = proot ? p.slice(proot.length + 1) : p;
    const pre = SRC_PREFIXES.find(s => rel.startsWith(s));
    if (pre) rel = rel.slice(pre.length);
    return { p, proot, rel };
  });
  // longest shared package folder prefix of java/kotlin files, per project root
  const pkg = new Map();
  for (const i of info) {
    if (i.rel === undefined || !/\.(java|kt)$/.test(i.p)) continue;
    const dirs = i.rel.split('/').slice(0, -1);
    const cur = pkg.get(i.proot);
    if (!cur) pkg.set(i.proot, dirs);
    else { let n = 0; while (n < cur.length && n < dirs.length && cur[n] === dirs[n]) n++; cur.length = n; }
  }
  for (const i of info) {
    if (i.rel === undefined) continue;
    const segs = i.rel.split('/');
    const strip = /\.(java|kt)$/.test(i.p) ? pkg.get(i.proot).length : 0;
    i.dirs = segs.slice(0, -1).slice(strip);
  }
  const id = (i, depth) => [i.proot, ...i.dirs.slice(0, depth)].filter(Boolean).join('/') || '_root';
  const out = new Map(), counts = new Map();
  for (const i of info) {
    if (i.root) { out.set(i.p, '_root'); continue; }
    const m = i.rest ? i.proot : id(i, 1);
    out.set(i.p, m); counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  // split oversized modules one level deeper
  for (const i of info) {
    if (i.root || i.rest || i.dirs.length < 2 || counts.get(out.get(i.p)) <= DEFAULTS.moduleSplitThreshold) continue;
    out.set(i.p, id(i, 2));
  }
  return out;
}

// Claude Code refuses writes under some dot directories (.mvn, .devcontainer), so a leading '.' of a directory segment becomes _dot_.
const undot = seg => (seg.startsWith('.') ? `_dot_${seg.slice(1)}` : seg);
export const moduleDocPath = id => `02_modules/${id.split('/').map(undot).join('__')}.md`;
export const fileDocPath = rel => { const s = rel.split('/'); return `03_files/${[...s.slice(0, -1).map(undot), s[s.length - 1]].join('/')}.md`; };

// Relative link between two OUT-relative doc paths; wrapped in <> when it has a space (doc-style §7).
export function relLink(from, to) {
  const l = path.posix.relative(path.posix.dirname(from), to);
  return l.includes(' ') ? `<${l}>` : l;
}
// prefix from a doc's folder up to OUT, e.g. 03_files/src/a.js.md -> ../..
const upOf = doc => path.posix.relative(path.posix.dirname(doc), '.') || '.';

const sha1 = data => crypto.createHash('sha1').update(data).digest('hex');

export function makeBatches(entries, { maxLines = DEFAULTS.maxLines, maxFiles = DEFAULTS.maxFiles } = {}) {
  const byModule = new Map();
  for (const e of entries) {
    if (e.kind === 'doc' || e.kind === 'data') continue;
    if (!byModule.has(e.module)) byModule.set(e.module, []);
    byModule.get(e.module).push(e);
  }
  const batches = [];
  const push = (module, list, large) => batches.push({
    id: batches.length + 1, module, files: list.map(e => e.path), lines: list.reduce((n, e) => n + e.lines, 0),
    large, fingerprint: sha1(list.map(e => e.path + e.sha1).join('')), status: 'pending',
  });
  for (const [module, list] of byModule) {
    let cur = [], curLines = 0;
    const flush = () => { if (cur.length) push(module, cur, false); cur = []; curLines = 0; };
    for (const e of [...list].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
      if (e.lines > maxLines) { flush(); push(module, [e], true); continue; }
      if (cur.length >= maxFiles || curLines + e.lines > maxLines) flush();
      cur.push(e); curLines += e.lines;
    }
    flush();
  }
  return batches;
}

const manifestPath = out => path.join(out, '.doc-forge', 'manifest.json');
const resolveOut = (repo, out) => path.resolve(out ?? path.join(repo, 'docs', 'doc-forge'));

export async function scan(repo, { out, fresh, lang } = {}) {
  if (lang !== undefined) topDocs(lang); // validate before touching anything
  repo = path.resolve(repo);
  out = resolveOut(repo, out);
  let outRel = path.relative(repo, out).split(path.sep).join('/').replace(/\/+$/, '');
  if (outRel === '' || outRel.startsWith('..') || path.isAbsolute(outRel)) outRel = null;

  const { files: paths, excluded } = await listFiles(repo, { outRel });
  const entries = [];
  for (const p of paths) {
    const buf = await fs.readFile(path.join(repo, ...p.split('/')));
    const text = buf.toString('utf8');
    // secret contents feed lines/sha1 only and are never stored
    entries.push({ path: p, ...classify(p, text), lines: countLines(text), sha1: sha1(buf) });
  }
  const buildRoots = paths.filter(p => BUILD_FILES.includes(p.split('/').pop())).map(p => p.split('/').slice(0, -1).join('/'));
  const mods = assignModules(paths, buildRoots);
  for (const e of entries) { e.module = mods.get(e.path); if (documented(e)) e.doc = fileDocPath(e.path); }
  const counts = new Map();
  for (const e of entries) counts.set(e.module, (counts.get(e.module) ?? 0) + 1);
  const modules = [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, files]) => ({ id, doc: moduleDocPath(id), files }));

  const batches = makeBatches(entries);
  const prev = await fs.readFile(manifestPath(out), 'utf8').then(JSON.parse, () => null);
  lang ??= TOP_DOCS[prev?.settings?.lang] ? prev.settings.lang : 'en';
  if (!fresh) {
    const done = new Map((prev?.batches ?? []).map(b => [b.fingerprint, b.status]));
    for (const b of batches) b.status = done.get(b.fingerprint) ?? 'pending';
  }
  await moveSummaries(out, prev?.batches ?? [], batches);

  let commit = null;
  try {
    const git = (...a) => execFileSync('git', ['-C', repo, ...a], { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
    const hash = git('rev-parse', 'HEAD').trim();
    const dirty = git('status', '--porcelain', '--', '.', ...(outRel ? [`:(exclude)${outRel}`] : [])).trim() !== '';
    commit = { hash, dirty };
  } catch { /* not a git repo, or no commits */ }

  const manifest = { version: 1, repo, generatedAt: new Date().toISOString(), commit, settings: { ...DEFAULTS, lang }, topDocs: topDocs(lang), files: entries, excluded, modules, batches };
  await fs.mkdir(path.dirname(manifestPath(out)), { recursive: true });
  await fs.writeFile(manifestPath(out), JSON.stringify(manifest, null, 2));
  return manifest;
}

// Batch ids are renumbered every scan, but summaries are keyed by id: move each summary to its batch's new id,
// drop summaries of batches that no longer exist. Two phases so a rename never overwrites a not-yet-moved file.
async function moveSummaries(out, prevBatches, batches) {
  const dir = path.join(out, '.doc-forge', 'summaries');
  const newId = new Map(batches.map(b => [b.fingerprint, b.id]));
  const moved = [];
  for (const b of prevBatches) {
    if (newId.get(b.fingerprint) === b.id) continue;
    const tmp = path.join(dir, `batch-${b.id}.md.moving`);
    try { await fs.rename(path.join(dir, `batch-${b.id}.md`), tmp); } catch { continue; }
    moved.push([tmp, newId.get(b.fingerprint)]);
  }
  for (const [tmp, id] of moved) {
    if (id === undefined) await fs.rm(tmp);
    else await fs.rename(tmp, path.join(dir, `batch-${id}.md`));
  }
}

export async function setStatus(out, id, status) {
  const m = JSON.parse(await fs.readFile(manifestPath(out), 'utf8'));
  const b = m.batches.find(b => b.id === Number(id));
  if (!b) throw new Error(`unknown batch id: ${id}`);
  b.status = status;
  await fs.writeFile(manifestPath(out), JSON.stringify(m, null, 2));
}

const UNSUPPORTED = '(unsupported format: contents hidden)';

// Masks every value; only key names/structure survive. Line-based, so exotic syntax degrades to '***', never to a leak.
export function extractKeys(relPath, text) {
  const base = path.posix.basename(relPath.replace(/\\/g, '/'));
  const ext = path.posix.extname(base).toLowerCase();
  const lines = text.split(/\r\n|\r|\n/);
  const blank = l => l.trim() === '';
  const isComment = (l, bang) => (bang ? /^\s*[#!]/ : /^\s*#/).test(l);
  // comments survive unless they look like they hold a key/value
  const maskComment = l => (/=|:(\s|$)/.test(l) ? l.match(/^\s*[#!]+/)[0] + ' ***' : l);
  const BS = 92; // backslash char code, avoids escaping slips
  const endsBs = l => l.charCodeAt(l.length - 1) === BS;
  const closesWith = (l, q) => l.length > 0 && l.endsWith(q) && l.charCodeAt(l.length - 2) !== BS;
  const unclosed = v => (/^["'`]/.test(v) && !(v.length >= 2 && closesWith(v, v[0])) ? v[0] : null);
  if (['.pem', '.key', '.p12', '.jks'].includes(ext) || /^id_(rsa|dsa|ecdsa|ed25519)/.test(base)) return '(key file: contents hidden)';
  if (base === '.env' || base.startsWith('.env.') || ext === '.env') {
    let open = null; // quote char of a multi-line value
    const out = [];
    for (const l of lines) {
      if (open) { if (closesWith(l.trimEnd(), open)) open = null; continue; }
      if (blank(l)) { out.push(l); continue; }
      if (isComment(l, false)) { out.push(maskComment(l)); continue; }
      const m = l.match(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_.]*\s*=)(.*)$/);
      if (!m) { out.push('***'); continue; }
      out.push(m[1] + '***');
      open = unclosed(m[2].trim());
    }
    return out.join('\n');
  }
  if (ext === '.properties') {
    let cont = false;
    const out = [];
    for (const l of lines) {
      if (cont) { cont = endsBs(l); continue; } // continuation of a masked value
      if (blank(l)) { out.push(l); continue; }
      if (isComment(l, true)) { out.push(maskComment(l)); continue; }
      const m = l.match(/^(\s*[^\s=:]+)(\s*[=:]\s*|\s+)/);
      cont = endsBs(l);
      out.push(m ? m[1] + m[2] + '***' : l); // key with no value
    }
    return out.join('\n');
  }
  if (ext === '.yml' || ext === '.yaml') {
    const out = [];
    let skip = -1; // drop following lines indented deeper than this (block / multi-line scalars)
    let open = null; // quote char of a multi-line quoted scalar
    const indentOf = l => l.match(/^ */)[0].length;
    lines.forEach((l, i) => {
      const indent = indentOf(l);
      if (open) { if (closesWith(l.trimEnd(), open)) open = null; return; }
      if (skip >= 0) { if (blank(l) || indent > skip) return; skip = -1; }
      if (blank(l) || /^(---|\.\.\.)\s*$/.test(l)) { out.push(l); return; }
      if (isComment(l, false)) { out.push(maskComment(l)); return; }
      const pad = l.match(/^\s*/)[0];
      const m = l.match(/^(\s*(?:-\s+)*)("[^"]*"|'[^']*'|[\w.\-"' ]+?):(?:\s+(.*))?$/);
      if (m) {
        const col = m[1].length, v = m[3]?.trim() ?? '';
        if (v === '' || v.startsWith('#')) {
          const next = lines.slice(i + 1).find(x => !blank(x));
          if (!m[1].includes('-') || (next !== undefined && indentOf(next) > col)) { out.push(m[1] + m[2] + ':'); return; }
          out.push(m[1] + '***'); skip = indent; return;
        }
        out.push(`${m[1]}${m[2]}: ***`);
        skip = col; open = unclosed(v);
        return;
      }
      const item = l.match(/^(\s*(?:-\s+)+)(\S.*)$/);
      if (item) { out.push(item[1] + '***'); skip = indent; open = unclosed(item[2].trim()); return; }
      out.push(pad + '***');
    });
    return out.join('\n');
  }
  if (ext === '.json') {
    const mask = v => Array.isArray(v) ? v.map(mask) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x)])) : '***';
    try { return JSON.stringify(mask(JSON.parse(text)), null, 2); } catch { return UNSUPPORTED; }
  }
  return UNSUPPORTED;
}

// Only values whose key name (full dotted path for YAML/JSON) looks secret are collected; plain config values
// such as database=postgres would otherwise flag every sentence that names them.
// auth only as its own key segment (or auth token): oauth2.client-id and author are not secrets
const SECRET_KEY = /(pass(word|wd)?|pwd|secret|token|api[_-]?key|private[_-]?key|credential|(^|[._-])auth([._-]|$)|auth[_-]?token|salt|signature|signing|access[_-]?key|(^|[._-])key$)/i;

// Collects secret values with the same line/format rules extractKeys masks. Values live only in the caller's local variable.
function secretValues(relPath, text) {
  const base = path.posix.basename(relPath), ext = path.posix.extname(base).toLowerCase();
  const lines = text.split(/\r\n|\r|\n/);
  const vals = new Set();
  // example/sample/template files hold placeholders (project keys, k8s kinds); they are still keys-only for agents
  if (/(^|\.)(example|sample|template)(\.|$)/i.test(base)) return vals;
  let key = ''; // key that owns the value being added (continuation lines keep it)
  const everyValue = /^secrets?\./i.test(base); // secret.* / secrets.* hold nothing but secrets
  const add = v => {
    if (!everyValue && !SECRET_KEY.test(key)) return;
    v = v.trim().replace(/^["'`]/, '').replace(/["'`]$/, '');
    if (v.length >= 6 && !v.includes('${') && v !== '***') vals.add(v);
  };
  const BS = 92;
  const closesWith = (l, q) => l.length > 0 && l.endsWith(q) && l.charCodeAt(l.length - 2) !== BS;
  const unclosed = v => (/^["'`]/.test(v) && !(v.length >= 2 && closesWith(v, v[0])) ? v[0] : null);
  if (base === '.env' || base.startsWith('.env.') || ext === '.env') {
    let open = null;
    for (const l of lines) {
      if (open) { add(l); if (closesWith(l.trimEnd(), open)) open = null; continue; }
      if (/^\s*#/.test(l)) continue;
      const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=(.*)$/);
      if (!m) continue;
      key = m[1]; add(m[2]); open = unclosed(m[2].trim());
    }
  } else if (ext === '.properties') {
    let cont = false;
    for (const l of lines) {
      if (cont) { add(l.replace(/\\$/, '')); cont = l.charCodeAt(l.length - 1) === BS; continue; }
      if (/^\s*[#!]/.test(l) || l.trim() === '') continue;
      const m = l.match(/^\s*([^\s=:]+)(?:\s*[=:]\s*|\s+)(.*)$/);
      if (m) { key = m[1]; add(m[2].replace(/\\$/, '')); }
      cont = l.charCodeAt(l.length - 1) === BS;
    }
  } else if (ext === '.yml' || ext === '.yaml') {
    let skip = -1, open = null;
    const stack = []; // [indent, key] of enclosing mapping keys
    const at = (ind, k) => {
      while (stack.length && stack[stack.length - 1][0] >= ind) stack.pop();
      if (k !== null) stack.push([ind, k]);
      key = stack.map(x => x[1]).join('.');
    };
    for (const l of lines) {
      const indent = l.match(/^ */)[0].length;
      if (open) { add(l); if (closesWith(l.trimEnd(), open)) open = null; continue; }
      if (skip >= 0) { if (l.trim() === '' || indent > skip) { add(l); continue; } skip = -1; }
      if (l.trim() === '' || /^\s*#/.test(l) || /^(---|\.\.\.)\s*$/.test(l)) continue;
      const m = l.match(/^(\s*(?:-\s+)*)("[^"]*"|'[^']*'|[\w.\-"' ]+?):(?:\s+(.*))?$/);
      if (m) {
        const v = m[3]?.trim() ?? '';
        at(m[1].length, m[2].trim().replace(/^["']|["']$/g, ''));
        if (v === '' || v.startsWith('#')) continue;
        add(v); skip = m[1].length; open = unclosed(v);
        continue;
      }
      const item = l.match(/^(\s*(?:-\s+)+)(\S.*)$/);
      if (item) { at(item[1].length, null); add(item[2]); skip = indent; open = unclosed(item[2].trim()); }
    }
  } else if (ext === '.json') {
    const walkJson = (v, k) => {
      if (Array.isArray(v)) v.forEach(x => walkJson(x, k));
      else if (v !== null && typeof v === 'object') Object.entries(v).forEach(([n, x]) => walkJson(x, k ? `${k}.${n}` : n));
      else if (typeof v === 'string' || typeof v === 'number') { key = k; add(String(v)); }
    };
    try { walkJson(JSON.parse(text), ''); } catch { /* unparseable: nothing to collect */ }
  }
  return [...vals];
}

const LEAK_PATTERNS = {
  'aws-key': /AKIA[0-9A-Z]{16}/,
  jwt: /eyJ[\w-]+\.[\w-]+\.[\w-]+/,
  'private-key': /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  assignment: /(password|passwd|secret|token|api[_-]?key)["']?\s*[=:]\s*(?!["']?\*\*\*)\S{6,}/i,
  'url-credential': /[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@/,
};

// Relative Markdown links to .md docs: returns [{ line, link, target }] where target is the decoded path without #anchor.
function mdLinks(text) {
  const res = [];
  text.split(/\r\n|\r|\n/).forEach((l, i) => {
    for (const m of l.matchAll(/\]\((<[^>]*>|[^)\s]*)(?:\s+"[^"]*")?\)/g)) {
      const link = m[1].replace(/^<|>$/g, '');
      let target = link.split('#')[0];
      if (!target.endsWith('.md') || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
      try { target = decodeURIComponent(target); } catch { /* keep as written */ }
      res.push({ line: i + 1, link, target });
    }
  });
  return res;
}

async function mdFiles(dir, rel = '') {
  const res = [];
  for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { if (e.name !== '.doc-forge') res.push(...await mdFiles(dir, r)); }
    else if (e.isFile() && e.name.endsWith('.md')) res.push(r);
  }
  return res;
}

export async function check(repo, { out, only } = {}) {
  repo = path.resolve(repo);
  out = resolveOut(repo, out);
  const manifest = await fs.readFile(manifestPath(out), 'utf8').then(JSON.parse, () => { throw new Error('run scan first'); });
  const exists = p => fs.stat(path.join(out, ...p.split('/'))).then(s => s.isFile(), () => false);

  let docs;
  const report = { ok: false, missingFileDocs: [], missingModuleDocs: [], brokenRefs: [], brokenLinks: [], leaks: [], estimates: null };
  if (only) {
    docs = only.map(p => p.replace(/\\/g, '/'));
    for (const d of docs) if (d.split('/').includes('..') || path.isAbsolute(d) || !await exists(d)) throw new Error(`no such doc: ${d}`);
  } else {
    docs = (await mdFiles(out)).sort();
    for (const f of manifest.files) if (f.kind !== 'doc' && f.kind !== 'data' && !await exists(fileDocPath(f.path))) report.missingFileDocs.push(f.path);
    for (const m of manifest.modules) if (!await exists(m.doc)) report.missingModuleDocs.push(m.id);
  }

  // secret values are read here only and dropped when the function returns
  const secrets = [];
  for (const f of manifest.files) {
    if (!f.secret) continue;
    const text = await fs.readFile(path.join(repo, ...f.path.split('/')), 'utf8').catch(() => null);
    if (text !== null) secrets.push(...secretValues(f.path, text));
  }

  const lineCache = new Map();
  const linesOf = async p => {
    if (!lineCache.has(p)) {
      const bad = p.split('/').includes('..') || path.isAbsolute(p);
      lineCache.set(p, bad ? null : await fs.readFile(path.join(repo, ...p.split('/')), 'utf8').then(countLines, () => null));
    }
    return lineCache.get(p);
  };
  const leaksIn = (doc, text) => text.split(/\r\n|\r|\n/).forEach((l, i) => {
    if (secrets.some(s => l.includes(s))) report.leaks.push({ doc, line: i + 1, type: 'secret-value' });
    for (const [pattern, re] of Object.entries(LEAK_PATTERNS)) if (re.test(l)) report.leaks.push({ doc, line: i + 1, type: 'pattern', pattern });
  });
  let confirmed = 0, estimated = 0;
  for (const doc of docs) {
    const text = await fs.readFile(path.join(out, ...doc.split('/')), 'utf8');
    for (const m of text.matchAll(/`([^`\s]+?):(\d+)(?:-(\d+))?`/g)) {
      const [, p, a, b] = m, from = Number(a), to = b === undefined ? from : Number(b);
      if (p.includes('://')) continue;
      const n = await linesOf(p);
      // shortcut: a non-existent path without '/' (127.0.0.1:80 etc.) is not a citation; tighten if root-file typos slip through
      if (n === null && !p.includes('/')) continue;
      confirmed++;
      const ref = m[0].slice(1, -1);
      if (n === null) report.brokenRefs.push({ doc, ref, reason: 'no-such-file' });
      else if (from < 1 || from > to || to > n) report.brokenRefs.push({ doc, ref, reason: 'line-out-of-range' });
    }
    for (const { line, link, target } of mdLinks(text)) {
      const to = path.posix.normalize(path.posix.join(path.posix.dirname(doc), target));
      if (to.startsWith('../') || to === '..' || !await exists(to)) report.brokenLinks.push({ doc, line, link });
    }
    for (const mk of ESTIMATE_MARKERS) estimated += text.split(mk).length - 1;
    leaksIn(doc, text);
  }
  // summaries feed module/architect agents: leak check only (no refs, links or coverage)
  if (!only) {
    const dir = path.join(out, '.doc-forge', 'summaries');
    const names = await fs.readdir(dir).catch(() => []);
    for (const n of names.filter(n => n.endsWith('.md')).sort()) leaksIn(`.doc-forge/summaries/${n}`, await fs.readFile(path.join(dir, n), 'utf8'));
  }
  const total = confirmed + estimated;
  report.estimates = { confirmed, estimated, ratio: total ? estimated / total : 0 };
  report.ok = !report.missingFileDocs.length && !report.missingModuleDocs.length && !report.brokenRefs.length && !report.brokenLinks.length && !report.leaks.length;
  await fs.writeFile(path.join(out, '.doc-forge', 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

const documented = f => f.kind !== 'doc' && f.kind !== 'data';

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample(manifest, moduleId, { rate = DEFAULTS.sampleRate, seed = 0 } = {}) {
  const paths = manifest.files.filter(f => f.module === moduleId && documented(f)).map(f => f.path).sort();
  const rnd = mulberry32(seed);
  for (let i = paths.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [paths[i], paths[j]] = [paths[j], paths[i]]; }
  return paths.length ? paths.slice(0, Math.max(1, Math.round(paths.length * rate))).sort().map(fileDocPath) : [];
}

export async function prune(repo, { out } = {}) {
  repo = path.resolve(repo);
  out = resolveOut(repo, out);
  const manifest = await fs.readFile(manifestPath(out), 'utf8').then(JSON.parse, () => { throw new Error('run scan first'); });
  const keep = new Set([...manifest.files.filter(documented).map(f => fileDocPath(f.path)), ...manifest.modules.map(m => m.doc)]);
  const removed = [];
  // lstat + skipping symlinks keeps deletion inside out
  const walk = async rel => {
    let entries;
    try { entries = await fs.readdir(path.join(out, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = `${rel}/${e.name}`, abs = path.join(out, rel, e.name);
      const st = await fs.lstat(abs);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        await walk(r);
        if (!(await fs.readdir(abs)).length) await fs.rmdir(abs);
      } else if (st.isFile() && e.name.endsWith('.md') && !keep.has(r)) { await fs.rm(abs); removed.push(r); }
    }
  };
  await walk('03_files'); await walk('02_modules');
  return removed;
}

async function main(argv) {
  const [cmd, repoArg, ...rest] = argv;
  const opt = {}, positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) { positional.push(rest[i]); continue; }
    const k = rest[i].slice(2);
    opt[k] = rest[i + 1] === undefined || rest[i + 1].startsWith('--') ? true : rest[++i];
  }
  const usage = msg => { console.error(msg); process.exit(2); };
  if (!['scan', 'batch', 'status', 'keys', 'check', 'sample', 'prune', 'link'].includes(cmd)) usage(`unknown subcommand: ${cmd ?? ''}\nusage: inventory.mjs <scan|batch|status|keys|check|sample|prune|link> <repo> [options]`);
  if (!repoArg) usage(`${cmd}: missing <repo>`);
  const repo = path.resolve(repoArg), out = resolveOut(repo, opt.out);
  let result;
  switch (cmd) {
    case 'keys': {
      const file = positional[0];
      if (!file) usage('keys: missing <file>');
      const abs = path.resolve(repo, file), rel = path.relative(repo, abs);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) usage('keys: file is outside the repo');
      const text = await fs.readFile(abs, 'utf8').catch(() => usage('keys: cannot read file'));
      console.log(extractKeys(rel.split(path.sep).join('/'), text));
      return;
    }
    case 'link': {
      const norm = p => (typeof p === 'string' ? p.replace(/\\/g, '/') : null);
      const from = norm(opt.from), to = norm(opt.to);
      if ([from, to].some(p => !p || p.split('/').includes('..') || path.isAbsolute(p))) usage('link: need --from <doc> --to <doc>, both relative to OUT');
      result = { link: relLink(from, to) };
      break;
    }
    case 'scan': {
      if (opt.lang !== undefined && !LANG_CODES.includes(opt.lang)) usage(`scan: --lang must be one of: ${LANG_CODES.join(', ')}`);
      result = await scan(repo, { out, fresh: !!opt.fresh, lang: opt.lang });
      break;
    }
    case 'check': {
      const only = typeof opt.only === 'string' ? opt.only.split(',').filter(Boolean) : undefined;
      result = await check(repo, { out, only }).catch(e => usage(e.message));
      if (!result.ok) process.exitCode = 1;
      break;
    }
    case 'sample': {
      if (typeof opt.module !== 'string') usage('sample: need --module M');
      if (opt.seed !== undefined && !/^-?[0-9]+$/.test(opt.seed)) usage('sample: --seed must be an integer');
      const m = await fs.readFile(manifestPath(out), 'utf8').then(JSON.parse, () => usage('run scan first'));
      result = sample(m, opt.module, { seed: opt.seed === undefined ? Date.now() : Number(opt.seed) });
      break;
    }
    case 'prune': result = { removed: await prune(repo, { out }).catch(e => usage(e.message)) }; break;
    case 'batch': {
      if (!/^[0-9]+$/.test(opt.id)) usage('batch: --id must be a positive integer');
      const m = JSON.parse(await fs.readFile(manifestPath(out), 'utf8'));
      const b = m.batches.find(b => b.id === Number(opt.id));
      if (!b) usage(`unknown batch id: ${opt.id}`);
      const byPath = new Map(m.files.map(f => [f.path, f]));
      const lang = m.settings?.lang ?? 'en';
      result = { id: b.id, module: b.module, lang, topDocs: topDocs(lang), moduleDoc: moduleDocPath(b.module), large: b.large, files: b.files.map(p => {
        const f = byPath.get(p), doc = fileDocPath(p);
        return { path: p, doc, up: upOf(doc), kind: f.kind, lines: f.lines, secret: f.secret };
      }) };
      break;
    }
    case 'status': {
      if (!/^[0-9]+$/.test(opt.id) || !['pending', 'done', 'failed'].includes(opt.set)) usage('status: need --id N (integer) --set pending|done|failed');
      await setStatus(out, opt.id, opt.set);
      result = { id: Number(opt.id), status: opt.set };
      break;
    }
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
}
