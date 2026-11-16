import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_FILE_PATTERNS, LANG_CODES, OUTPUT_LANGS } from './inventory.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = ['overview', 'architecture', 'module', 'file', 'file-short', 'test', 'flow'];

const exists = rel => fs.existsSync(path.join(ROOT, ...rel.split('/')));
const list = dir => (exists(dir) ? fs.readdirSync(path.join(ROOT, dir)) : []);

// frontmatter: `key: value` lines between the first two `---` lines
function parse(rel) {
  const text = fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  assert.ok(m, `${rel}: missing frontmatter`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

const skills = () => list('skills').filter(d => exists(`skills/${d}/SKILL.md`)).map(d => ({ name: d, rel: `skills/${d}/SKILL.md` }));
const agents = () => list('agents').filter(f => f.endsWith('.md')).map(f => ({ name: f.slice(0, -3), rel: `agents/${f}` }));

test('every skill has frontmatter name == folder and a description', () => {
  for (const s of skills()) {
    const { meta } = parse(s.rel);
    assert.equal(meta.name, s.name, `${s.rel}: name`);
    assert.ok(meta.description, `${s.rel}: description`);
  }
});

test('frontmatter values parse as YAML: unquoted values have no ": "', () => {
  // Claude Code drops every frontmatter field when YAML fails; an unquoted "e.g.: x" is such a failure
  for (const f of [...skills(), ...agents()]) {
    for (const [k, v] of Object.entries(parse(f.rel).meta)) {
      if (/^["']/.test(v)) continue;
      assert.ok(!/:\s/.test(v), `${f.rel}: ${k} has an unquoted ": " — wrap the value in quotes`);
    }
  }
});

test('doc-style is not user-invocable', () => {
  assert.ok(exists('skills/doc-style/SKILL.md'), 'skills/doc-style/SKILL.md missing');
  assert.equal(parse('skills/doc-style/SKILL.md').meta['user-invocable'], 'false');
});

test('every agent has name == filename, description, tools', () => {
  for (const a of agents()) {
    const { meta, body } = parse(a.rel);
    assert.equal(meta.name, a.name, `${a.rel}: name`);
    assert.ok(meta.description, `${a.rel}: description`);
    assert.ok(meta.tools, `${a.rel}: tools`);
    // agents get absolute paths from the conducting skill; variables do not expand there
    assert.ok(!body.includes('${CLAUDE_PLUGIN_ROOT}'), `${a.rel}: must not use \${CLAUDE_PLUGIN_ROOT}`);
  }
});

const bodies = () => [...skills(), ...agents()].map(x => ({ rel: x.rel, body: parse(x.rel).body }));

test('every referenced doc-forge:<agent> exists', () => {
  for (const { rel, body } of bodies())
    for (const [, x] of body.matchAll(/doc-forge:([\w-]+)/g))
      assert.ok(exists(`agents/${x}.md`) || exists(`skills/${x}/SKILL.md`), `${rel}: doc-forge:${x} has no agents/${x}.md or skills/${x}/`);
});

test('every referenced plugin path exists', () => {
  for (const { rel, body } of bodies())
    for (const [, p] of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)(?=[`\s)"']|$)/g))
      assert.ok(exists(p), `${rel}: \${CLAUDE_PLUGIN_ROOT}/${p} does not exist`);
});

test('doc-style §3 Grep glob lists exactly the secret file patterns of inventory.mjs', () => {
  const { body } = parse('skills/doc-style/SKILL.md');
  const m = body.match(/^\s*!\*\*\/\{(.+)\}\s*$/m);
  assert.ok(m, 'doc-style §3 glob line missing');
  const alts = m[1].split(',');
  const lower = new Set(alts.map(a => a.toLowerCase()));
  // every pattern is covered (case variants allowed), and nothing else is listed
  assert.deepEqual([...lower].sort(), [...new Set(SECRET_FILE_PATTERNS.map(p => p.toLowerCase()))].sort());
  for (const p of SECRET_FILE_PATTERNS) assert.ok(alts.includes(p), `glob lacks ${p} as written`);
});

test('doc-style references all 7 templates; each exists in every output language with the same headings', () => {
  const { body } = parse('skills/doc-style/SKILL.md');
  const headings = rel => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').split(String.fromCharCode(10)).filter(l => /^#{2,} /.test(l)).map(l => l.match(/^#+/)[0]);
  for (const t of TEMPLATES) {
    assert.ok(body.includes(`templates/<LANG>/${t}.md`), `SKILL.md does not mention templates/<LANG>/${t}.md`);
    for (const lang of LANG_CODES) assert.ok(exists(`skills/doc-style/templates/${lang}/${t}.md`), `templates/${lang}/${t}.md missing`);
    const [first, ...rest] = LANG_CODES.map(lang => headings(`skills/doc-style/templates/${lang}/${t}.md`));
    for (const h of rest) assert.deepEqual(h, first, `templates/*/${t}.md: section structure differs between languages`);
  }
  assert.deepEqual(list('skills/doc-style/templates').sort(), [...LANG_CODES].sort(), 'templates/ holds only one folder per language');
});

test('doc-style lists every output language: estimate marker row (§2) and header row (§7)', () => {
  const { body } = parse('skills/doc-style/SKILL.md');
  const rows = body.split(String.fromCharCode(10)).filter(l => l.startsWith('| `'));
  for (const code of LANG_CODES) {
    const mine = rows.filter(l => l.startsWith('| `' + code + '` |'));
    assert.ok(mine.some(l => l.includes('`' + OUTPUT_LANGS[code].estimate + '`')), `doc-style §2 lacks the ${code} estimate marker row`);
    assert.ok(mine.some(l => l.includes('`> ')), `doc-style §7 lacks the ${code} header row`);
  }
});
