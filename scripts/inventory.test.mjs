import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { countLines, classify, listFiles, assignModules, moduleDocPath, fileDocPath, makeBatches, scan, setStatus, extractKeys, check, sample, prune } from './inventory.mjs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const run = args => execFileSync(process.execPath, ['scripts/inventory.mjs', ...args], { encoding: 'utf8' });

export async function makeRepo(files, { git = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-forge-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split('/'));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  if (git) {
    const g = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...a], { stdio: 'ignore' });
    g('init'); g('add', '-A'); g('commit', '-m', 'init');
  }
  return dir;
}

test('countLines', () => {
  assert.equal(countLines(''), 0); assert.equal(countLines('a'), 1);
  assert.equal(countLines('a\n'), 1); assert.equal(countLines('a\r\nb'), 2); assert.equal(countLines('a\n\nb\n'), 3);
});
test('classify kind', () => {
  const k = p => classify(p, '').kind;
  assert.equal(k('src/main/java/a/UserService.java'), 'source');
  assert.equal(k('src/test/java/a/UserServiceTest.java'), 'test');
  assert.equal(k('web/src/app.spec.ts'), 'test'); assert.equal(k('tests/test_api.py'), 'test'); assert.equal(k('pkg/x_test.go'), 'test');
  assert.equal(k('db/V1__init.sql'), 'sql');
  assert.equal(k('package.json'), 'config'); assert.equal(k('tsconfig.json'), 'config'); assert.equal(k('pom.xml'), 'config');
  assert.equal(k('Dockerfile'), 'config'); assert.equal(k('src/main/resources/application.yml'), 'config'); assert.equal(k('.env'), 'config');
  assert.equal(k('README.md'), 'doc'); assert.equal(k('docs/guide.md'), 'doc');
  assert.equal(k('test/fixtures/users.json'), 'data'); assert.equal(k('data/items.csv'), 'data');
});
test('classify secret', () => {
  for (const p of ['.env', '.env.local', 'certs/server.pem', 'k/id_rsa', 'src/main/resources/application.yml', 'src/main/resources/application-prod.properties', 'config/secrets.json'])
    assert.equal(classify(p, '').secret, true, p);
  for (const p of ['src/env.ts', 'package.json']) assert.equal(classify(p, '').secret, false, p);
});
test('classify secret: credentials, appsettings, tfvars, rc files, database.yml, service accounts (any case)', () => {
  for (const p of ['credentials.json', 'credentials', '.aws/credentials', 'aws/Credentials', 'x/CREDENTIALS.YML', 'appsettings.json', 'api/appsettings.Development.json', 'AppSettings.json',
    'infra/prod.tfvars', '.npmrc', 'x/.pypirc', '.netrc', 'config/database.yml', 'app/config/database.yml',
    'gcp/my-serviceAccount-key.json', 'serviceaccount.json', 'K/ID_RSA', 'CERT.PEM', '.ENV'])
    assert.equal(classify(p, '').secret, true, p);
  for (const p of ['CredentialsService.java', 'credentials.ts', 'CredentialsController.cs', 'Credentials.test.js', 'appsettings.yml', 'database.yml', 'db/config/database.yaml.bak', 'src/settings.json', 'serviceAccount.ts'])
    assert.equal(classify(p, '').secret, false, p);
});
test('listFiles: git repo, exclusions, Korean names, posix paths', async () => {
  const repo = await makeRepo({
    'src/app.js': 'x', 'src/한글 파일.js': 'y', 'node_modules/a/i.js': 'z', 'dist/b.js': 'z',
    'package-lock.json': '{}', 'web/app.min.js': 'z', 'img/logo.png': Buffer.from([0x89, 0x50]),
    'bin/data.bin': Buffer.from([1, 0, 2]), 'docs/doc-forge/00_개요.md': 'old', 'README.md': '# r',
  }, { git: true });
  const { files, excluded } = await listFiles(repo, { outRel: 'docs/doc-forge' });
  assert.deepEqual(files.sort(), ['README.md', 'src/app.js', 'src/한글 파일.js']);
  const reason = Object.fromEntries(excluded.map(e => [e.path, e.reason]));
  assert.equal(reason['package-lock.json'], 'lockfile'); assert.equal(reason['web/app.min.js'], 'minified');
  assert.equal(reason['img/logo.png'], 'asset'); assert.equal(reason['bin/data.bin'], 'binary');
  assert.ok(!('docs/doc-forge/00_개요.md' in reason), 'output-dir files are skipped, not reported as excluded');
  assert.ok(files.concat(excluded.map(e => e.path)).every(p => !p.includes('\\')));
});
test('listFiles: non-git folder walks with same rules', async () => {
  const repo = await makeRepo({ 'a/b.js': 'x', 'node_modules/c.js': 'x', 'target/d.class': 'x' });
  const { files } = await listFiles(repo, {});
  assert.deepEqual(files, ['a/b.js']);
});
test('listFiles: no outRel excludes nothing as output-dir', async () => {
  const repo = await makeRepo({ 'docs/doc-forge/a.md': 'x' });
  const { files } = await listFiles(repo, {});
  assert.deepEqual(files, ['docs/doc-forge/a.md']);
});
test('listFiles: deleted file skipped, unreadable file reported', async () => {
  const repo = await makeRepo({ 'gone.js': 'x', 'dir.js': 'y', 'ok.js': 'z' }, { git: true });
  await fs.rm(path.join(repo, 'gone.js'));
  await fs.rm(path.join(repo, 'dir.js'));
  await fs.mkdir(path.join(repo, 'dir.js')); // tracked path now a directory -> open/read fails (not ENOENT)
  const { files, excluded } = await listFiles(repo, {});
  assert.deepEqual(files, ['ok.js']);
  assert.deepEqual(excluded, [{ path: 'dir.js', reason: 'unreadable' }]);
});
test('assignModules: multi-project repo', () => {
  const paths = ['README.md', 'docker-compose.yml',
    'backend/pom.xml', 'backend/src/main/java/com/example/shop/controller/UserController.java',
    'backend/src/main/java/com/example/shop/service/UserService.java',
    'backend/src/main/java/com/example/shop/ShopApplication.java',
    'backend/src/test/java/com/example/shop/service/UserServiceTest.java',
    'frontend/package.json', 'frontend/src/views/Home.vue', 'frontend/src/main.js',
    'infrastructure/terraform/main.tf'];
  const m = assignModules(paths, ['backend', 'frontend']);
  assert.equal(m.get('README.md'), '_root');
  assert.equal(m.get('backend/src/main/java/com/example/shop/controller/UserController.java'), 'backend/controller');
  assert.equal(m.get('backend/src/test/java/com/example/shop/service/UserServiceTest.java'), 'backend/service');
  assert.equal(m.get('backend/src/main/java/com/example/shop/ShopApplication.java'), 'backend');
  assert.equal(m.get('backend/pom.xml'), 'backend');
  assert.equal(m.get('frontend/src/views/Home.vue'), 'frontend/views');
  assert.equal(m.get('frontend/src/main.js'), 'frontend');
  assert.equal(m.get('infrastructure/terraform/main.tf'), 'infrastructure');
  assert.equal(paths.filter(p => !m.get(p)).length, 0);
});
test('assignModules: root build file, scripts folder', () => {
  const m = assignModules(['package.json', 'src/routes/user.js', 'src/index.js', 'scripts/seed.js'], ['']);
  assert.equal(m.get('src/routes/user.js'), 'routes'); assert.equal(m.get('src/index.js'), '_root');
  assert.equal(m.get('scripts/seed.js'), 'scripts'); assert.equal(m.get('package.json'), '_root');
});
test('assignModules: split module over 40 files', () => {
  const paths = [...Array(30)].map((_, i) => `src/api/user/u${i}.js`).concat([...Array(15)].map((_, i) => `src/api/order/o${i}.js`));
  const m = assignModules(paths, ['']);
  assert.equal(m.get('src/api/user/u0.js'), 'api/user'); assert.equal(m.get('src/api/order/o0.js'), 'api/order');
});
test('doc paths', () => {
  assert.equal(moduleDocPath('backend/controller'), '02_modules/backend__controller.md');
  assert.equal(fileDocPath('src/a.js'), '03_files/src/a.js.md');
});
test('doc paths: leading-dot directory segments become _dot_, file names stay', () => {
  assert.equal(fileDocPath('.mvn/wrapper/maven-wrapper.properties'), '03_files/_dot_mvn/wrapper/maven-wrapper.properties.md');
  assert.equal(fileDocPath('.env'), '03_files/.env.md');
  assert.equal(fileDocPath('a/.b/.c'), '03_files/a/_dot_b/.c.md');
  assert.equal(moduleDocPath('.devcontainer'), '02_modules/_dot_devcontainer.md');
  assert.equal(moduleDocPath('a/.b'), '02_modules/a___dot_b.md');
});

test('makeBatches: limits, module grouping, doc/data skipped, large file alone', () => {
  const e = (path, module, lines, kind = 'source') => ({ path, module, lines, kind });
  const entries = [...Array(30)].map((_, i) => e(`a/f${i}.js`, 'a', 10))
    .concat([e('b/big.js', 'b', 3000), e('b/s1.js', 'b', 1500), e('b/s2.js', 'b', 1500), e('b/README.md', 'b', 5, 'doc'), e('b/x.json', 'b', 5, 'data')]);
  const bs = makeBatches(entries);
  assert.deepEqual(bs.filter(b => b.module === 'a').map(b => b.files.length), [25, 5]);
  const big = bs.find(b => b.files.includes('b/big.js'));
  assert.equal(big.large, true); assert.equal(big.files.length, 1);
  assert.ok(!bs.some(b => b.files.includes('b/README.md') || b.files.includes('b/x.json')));
  assert.ok(bs.every(b => b.large || b.lines <= 2500));
  assert.deepEqual(bs.map(b => b.id), bs.map((_, i) => i + 1));
  assert.ok(bs.every(b => b.status === 'pending'));
});
test('scan writes manifest with commit, excluded, modules', async () => {
  const repo = await makeRepo({ 'package.json': '{}', 'src/routes/a.js': 'a\nb\n', 'package-lock.json': '{}' }, { git: true });
  const m = await scan(repo, {});
  const saved = JSON.parse(await readFile(join(repo, 'docs/doc-forge/.doc-forge/manifest.json'), 'utf8'));
  assert.deepEqual(saved.files.map(f => f.path), m.files.map(f => f.path));
  assert.match(m.commit.hash, /^[0-9a-f]{40}$/); assert.equal(m.commit.dirty, false);
  assert.ok(m.excluded.some(x => x.path === 'package-lock.json'));
  assert.equal(m.files.find(f => f.path === 'src/routes/a.js').lines, 2);
  assert.ok(m.modules.some(x => x.id === 'routes' && x.doc === '02_modules/routes.md'));
  assert.equal(m.files.find(f => f.path === 'src/routes/a.js').doc, '03_files/src/routes/a.js.md');
  assert.equal(m.files.find(f => f.path === 'package.json').doc, '03_files/package.json.md');
});
test('scan keeps done status only for unchanged batches; --fresh resets', async () => {
  const repo = await makeRepo({ 'a/x.js': '1', 'b/y.js': '1' });
  const m1 = await scan(repo, {});
  for (const b of m1.batches) await setStatus(join(repo, 'docs/doc-forge'), b.id, 'done');
  await writeFile(join(repo, 'b/y.js'), '2');
  const m2 = await scan(repo, {});
  const st = mod => m2.batches.find(b => b.module === mod).status;
  assert.equal(st('a'), 'done'); assert.equal(st('b'), 'pending');
  const m3 = await scan(repo, { fresh: true });
  assert.ok(m3.batches.every(b => b.status === 'pending'));
});
test('scan moves batch summaries with their batches when ids shift; drops gone batches', async () => {
  const repo = await makeRepo({ 'a/x.js': '1', 'b/y.js': '1', 'c/z.js': '1' });
  const out = join(repo, 'docs/doc-forge'), sum = id => join(out, '.doc-forge/summaries', `batch-${id}.md`);
  const m1 = await scan(repo, {});
  await mkdir(dirname(sum(1)), { recursive: true });
  for (const b of m1.batches) { await setStatus(out, b.id, 'done'); await writeFile(sum(b.id), `- ${b.module}`); }
  await mkdir(join(repo, '0')); await writeFile(join(repo, '0/new.js'), '1'); // module "0" sorts first and shifts every id
  await rm(join(repo, 'c/z.js'));
  const m2 = await scan(repo, {});
  const id = mod => m2.batches.find(b => b.module === mod).id;
  assert.notEqual(id('a'), m1.batches.find(b => b.module === 'a').id);
  for (const mod of ['a', 'b']) assert.equal(await readFile(sum(id(mod)), 'utf8'), `- ${mod}`);
  await assert.rejects(readFile(sum(id('0')), 'utf8'));
  assert.equal(m2.batches.length, 3);
  await assert.rejects(readFile(sum(4), 'utf8'));
});

test('non-git repo: commit is null', async () => {
  const repo = await makeRepo({ 'a.js': '1' });
  assert.equal((await scan(repo, {})).commit, null);
});
test('CLI batch and status', async () => {
  const repo = await makeRepo({ 'a/x.js': '1' });
  run(['scan', repo]);
  const b = JSON.parse(run(['batch', repo, '--id', '1']));
  assert.deepEqual(b.files.map(f => f.path), ['a/x.js']);
  assert.deepEqual(b.files.map(f => f.doc), ['03_files/a/x.js.md']);
  run(['status', repo, '--id', '1', '--set', 'done']);
  assert.equal(JSON.parse(await readFile(join(repo, 'docs/doc-forge/.doc-forge/manifest.json'), 'utf8')).batches[0].status, 'done');
});
test('CLI status/batch reject bad args with exit 2', async () => {
  const repo = await makeRepo({ 'a/x.js': '1' });
  run(['scan', repo]);
  const code = args => { try { run(args); return 0; } catch (e) { return e.status; } };
  assert.equal(code(['status', repo, '--id', '--set', 'done']), 2);
  assert.equal(code(['status', repo, '--id', '1.5', '--set', 'done']), 2);
  assert.equal(code(['status', repo, '--id', '1', '--set', 'bogus']), 2);
  assert.equal(code(['status', repo, '--id', '1']), 2);
  assert.equal(code(['batch', repo, '--id', '1.5']), 2);
  assert.equal(JSON.parse(await readFile(join(repo, 'docs/doc-forge/.doc-forge/manifest.json'), 'utf8')).batches[0].status, 'pending');
});

test('extractKeys masks values in all formats', () => {
  const env = extractKeys('.env', 'DB_PASSWORD=hunter22\n# comment\nPORT=8080\n');
  assert.match(env, /DB_PASSWORD=\*\*\*/); assert.match(env, /PORT=\*\*\*/); assert.doesNotMatch(env, /hunter22|8080/);
  const yml = extractKeys('application.yml', 'spring:\n  datasource:\n    password: s3cretpw\n    url: jdbc:mysql://db/x\n');
  assert.match(yml, /spring:\n  datasource:\n    password: \*\*\*\n    url: \*\*\*/); assert.doesNotMatch(yml, /s3cretpw|jdbc/);
  const props = extractKeys('a.properties', 'jwt.secret=abcdefgh\n');
  assert.equal(props.trim(), 'jwt.secret=***');
  const json = extractKeys('secrets.json', '{"api":{"key":"zzzzzz","n":3}}');
  assert.deepEqual(JSON.parse(json), { api: { key: '***', n: '***' } });
  assert.equal(extractKeys('server.pem', '-----BEGIN PRIVATE KEY-----\nAAA\n'), '(키 파일: 내용 비공개)');
});
test('CLI keys refuses paths outside repo', () => {
  assert.throws(() => run(['keys', process.cwd(), '../outside.env']));
});
test('extractKeys masks YAML lists, block scalars, bad JSON, properties forms', () => {
  const y = extractKeys('c.yaml', 'a:\n  - one1\n  - k: two2\n  pem: |\n    LINE-secret\n    more-secret\n  next: v3\n# c\n');
  assert.equal(y, 'a:\n  - ***\n  - k: ***\n  pem: ***\n  next: ***\n# c\n');
  assert.equal(extractKeys('x.json', '{bad secret'), '(형식 미지원: 내용 비공개)');
  assert.equal(extractKeys('x.toml', 'a=secret'), '(형식 미지원: 내용 비공개)');
  assert.equal(extractKeys('a.properties', 'k: v1\nk2 v2\n').trim(), 'k: ***\nk2 ***');
});
test('CLI keys skips option values when picking the file argument', async () => {
  const repo = await makeRepo({ '.env': 'TOKEN=abc123\n' });
  assert.equal(run(['keys', repo, '--out', join(repo, 'docs/doc-forge'), '.env']).trim(), 'TOKEN=***');
});
test('CLI keys prints masked output; missing file/args exit 2', async () => {
  const repo = await makeRepo({ '.env': 'TOKEN=abc123\n' });
  assert.equal(run(['keys', repo, '.env']).trim(), 'TOKEN=***');
  const code = args => { try { run(args); return 0; } catch (e) { return e.status; } };
  assert.equal(code(['keys', repo, 'nope.env']), 2);
  assert.equal(code(['keys', repo]), 2);
  assert.equal(code(['keys', repo, '../outside.env']), 2);
});
test('extractKeys closes value leaks (multi-line, list colon, comments)', () => {
  const env = extractKeys('.env', 'K="-----BEGIN\nMIIEvQIBADANBgkq==\nabc=def\n-----END"\nA=1\n# DB_PASSWORD=hunter2\n# plain note\nweird line=x\n!bang=zz\n');
  assert.equal(env, 'K=***\nA=***\n# ***\n# plain note\n***\n***\n');
  const y = extractKeys('a.yml', 'k: some text\n  more words: here\nq: "abc\n  def: ghi\n  end"\nlist:\n  - hunter2:\n  - real:\n      x: 1\n  - a b\n# pw: hunter2\n!x: y\nz:\n');
  assert.equal(y, 'k: ***\nq: ***\nlist:\n  - ***\n  - real:\n      x: ***\n  - ***\n# ***\n***\nz:\n');
  assert.equal(extractKeys('a.properties', '# pw=hunter2\n! pw: x\n# hi\nk=v\n'), '# ***\n! ***\n# hi\nk=***\n');
  for (const out of [env, y]) assert.doesNotMatch(out, /hunter2|MIIEv|abc=|more words|def|ghi/);
});
test('extractKeys: properties continuation chain and env escaped/backtick quotes', () => {
  const bs = String.fromCharCode(92), q = String.fromCharCode(34), bt = String.fromCharCode(96);
  const props = extractKeys('a.properties', ['k=a' + bs, 'secret=zz' + bs, 'more=q', 'next=1'].join('\n'));
  assert.equal(props, 'k=***\nnext=***');
  const e1 = extractKeys('.env', ['K=' + q + 'abc' + bs + q + 'def', 'secret=1', q, 'Z=1'].join('\n'));
  assert.equal(e1, 'K=***\nZ=***');
  const e2 = extractKeys('.env', ['K=' + bt + 'a', 'b=c' + bt, 'Y=1'].join('\n'));
  assert.equal(e2, 'K=***\nY=***');
  assert.equal(extractKeys('.env', 'A=' + q + 'x' + q + '\nB=2'), 'A=***\nB=***');
});

async function docsRepo() {
  const repo = await makeRepo({ 'src/a.js': 'l1\nl2\nl3\n', 'src/b.js': 'x\n', 'README.md': '# r\n',
    '.env': 'DB_PASSWORD=hunter22\nPORT=80\n' });
  await scan(repo, {});
  return repo;
}
const put = (repo, rel, text) => mkdir(dirname(join(repo, 'docs/doc-forge', rel)), { recursive: true })
  .then(() => writeFile(join(repo, 'docs/doc-forge', rel), text));

test('check: missing docs (doc/data kinds not required)', async () => {
  const repo = await docsRepo();
  await put(repo, '03_files/src/a.js.md', 'ok (`src/a.js:1-3`)');
  const r = await check(repo, {});
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingFileDocs.sort(), ['.env', 'src/b.js']);
  assert.ok(!r.missingFileDocs.includes('README.md'));
  assert.ok(r.missingModuleDocs.length > 0);
});
test('check: broken refs', async () => {
  const repo = await docsRepo();
  await put(repo, '01_아키텍처.md', 'a (`src/a.js:2`) b (`src/a.js:3-9`) c (`src/zzz.js:1`) d (`localhost:8080`) e (`src/a.js:0`)');
  const r = await check(repo, {});
  const reasons = r.brokenRefs.map(x => `${x.ref}|${x.reason}`).sort();
  assert.deepEqual(reasons, ['src/a.js:0|line-out-of-range', 'src/a.js:3-9|line-out-of-range', 'src/zzz.js:1|no-such-file']);
});
test('check: leaks by secret value and pattern, nothing persisted', async () => {
  const repo = await docsRepo();
  await put(repo, '03_files/.env.md', 'DB_PASSWORD 값은 hunter22 이다');
  await put(repo, '00_개요.md', 'key AKIAABCDEFGHIJKLMNOP\npassword=***\n');
  const r = await check(repo, {});
  assert.ok(r.leaks.some(l => l.doc === '03_files/.env.md' && l.type === 'secret-value'));
  assert.ok(r.leaks.some(l => l.doc === '00_개요.md' && l.type === 'pattern' && l.line === 1));
  assert.ok(!r.leaks.some(l => l.line === 2));
  const persisted = await readFile(join(repo, 'docs/doc-forge/.doc-forge/report.json'), 'utf8')
    + await readFile(join(repo, 'docs/doc-forge/.doc-forge/manifest.json'), 'utf8');
  assert.doesNotMatch(persisted, /hunter22/);
});
test('check: secret values from multi-line env, yaml and json', async () => {
  const repo = await makeRepo({ '.env': 'API_TOKEN="line-one-secret\nsecond-line-secret"\n', 'application.yml': 'a:\n  password: yamlsecret1\n',
    'secrets.json': '{"t":{"secret":"jsonsecret1"}}' });
  await scan(repo, {});
  await put(repo, 'x.md', 'second-line-secret\nyamlsecret1\njsonsecret1\n');
  const r = await check(repo, { only: ['x.md'] });
  assert.deepEqual(r.leaks.map(l => l.line), [1, 2, 3]);
  assert.ok(r.leaks.every(l => l.type === 'secret-value' && l.pattern === undefined));
});
test('check: estimate ratio', async () => {
  const repo = await docsRepo();
  await put(repo, '01_아키텍처.md', 'a (`src/a.js:1`)\nb (`src/a.js:2`)\n추정: c\n');
  const r = await check(repo, {});
  assert.deepEqual(r.estimates, { confirmed: 2, estimated: 1, ratio: 1 / 3 });
});
test('check --only: skips coverage, checks listed docs only', async () => {
  const repo = await docsRepo();
  await put(repo, '03_files/src/a.js.md', 'ok (`src/a.js:1`)');
  await put(repo, '01_아키텍처.md', 'bad (`src/zzz.js:1`)');
  const r = await check(repo, { only: ['03_files/src/a.js.md'] });
  assert.equal(r.ok, true); assert.deepEqual(r.missingFileDocs, []); assert.deepEqual(r.brokenRefs, []);
  await assert.rejects(check(repo, { only: ['nope.md'] }));
});
test('check without manifest throws; CLI exits 2', async () => {
  const repo = await makeRepo({ 'a.js': 'x' });
  await assert.rejects(check(repo, {}), /run scan first/);
  assert.throws(() => run(['check', repo]), e => e.status === 2);
});
test('CLI check exits 1 on problems', async () => {
  const repo = await docsRepo();
  assert.throws(() => run(['check', repo]), e => e.status === 1);
});

test('sample: 20% min 1, only documented kinds, deterministic by seed', () => {
  const files = [...Array(15)].map((_, i) => ({ path: `m/f${i}.js`, module: 'm', kind: 'source' }))
    .concat([{ path: 'm/R.md', module: 'm', kind: 'doc' }, { path: 'n/one.js', module: 'n', kind: 'source' }]);
  const man = { files };
  const s = sample(man, 'm', { seed: 1 });
  assert.equal(s.length, 3); assert.ok(s.every(p => p.startsWith('03_files/m/f')));
  assert.deepEqual(sample(man, 'm', { seed: 1 }), s);
  assert.deepEqual(sample(man, 'n', { seed: 1 }), ['03_files/n/one.js.md']);
  assert.deepEqual(sample(man, 'zzz', { seed: 1 }), []);
});
test('prune removes docs of deleted files and modules, keeps flows and top docs', async () => {
  const repo = await makeRepo({ 'a/x.js': '1', 'b/y.js': '1' });
  await scan(repo, {});
  for (const rel of ['03_files/a/x.js.md', '03_files/b/y.js.md', '02_modules/b.md', '04_flows/로그인.md', '00_개요.md'])
    await put(repo, rel, 'x');
  await rm(join(repo, 'b'), { recursive: true });
  await scan(repo, {});
  const removed = await prune(repo, {});
  assert.deepEqual(removed.sort(), ['02_modules/b.md', '03_files/b/y.js.md']);
  await assert.rejects(readFile(join(repo, 'docs/doc-forge/03_files/b/y.js.md')));
  await assert.rejects(fs.stat(join(repo, 'docs/doc-forge/03_files/b')));
  await readFile(join(repo, 'docs/doc-forge/03_files/a/x.js.md'));
});
test('check and prune use _dot_ doc paths', async () => {
  const repo = await makeRepo({ '.mvn/w.properties': 'a=1\n', 'src/a.js': '1\n' });
  await scan(repo, {});
  for (const rel of ['03_files/_dot_mvn/w.properties.md', '03_files/src/a.js.md', '03_files/.mvn/w.properties.md']) await put(repo, rel, 'x');
  assert.deepEqual((await check(repo, {})).missingFileDocs, []);
  assert.deepEqual(await prune(repo, {}), ['03_files/.mvn/w.properties.md']);
});
test('check: only values of secret-looking keys count as secret values', async () => {
  const repo = await makeRepo({ 'application.properties': 'spring.datasource.username=postgres\nspring.datasource.password=s3cr3tpw\ndatabase=postgres\n',
    'application.yml': 'db:\n  name: petclinic\n  auth:\n    key: yamlsecret9\n  list:\n    - itemvalue1\n',
    '.env': 'PORT=808080\nAPI_KEY=envsecret77\n', 'secrets.json': '{"a":{"name":"jsonplain1","tokens":["jsontoken1"]}}' });
  await scan(repo, {});
  await put(repo, 'x.md', 'uses postgres and petclinic, itemvalue1, 808080\nleaks s3cr3tpw\nleaks yamlsecret9\nleaks envsecret77\nleaks jsontoken1\nsecrets.* plain key leaks jsonplain1\n');
  const r = await check(repo, { only: ['x.md'] });
  assert.deepEqual(r.leaks.map(l => l.line), [2, 3, 4, 5, 6]);
});
test('check: *_KEY / signing keys, URL credentials, every value of secrets.*', async () => {
  const repo = await makeRepo({ '.env': 'APP_KEY=abcdef123\nMONKEY=bananas99\n', 'application.yml': 'jwt:\n  signing-key: zzzzzz99\n',
    'SECRETS.yaml': 'plain: anyvalue77\n' });
  await scan(repo, {});
  await put(repo, 'x.md', 'ok bananas99\nleaks abcdef123\nleaks zzzzzz99\nleaks anyvalue77\nDATABASE_URL=postgres://u:pw123456@h/db\n');
  const r = await check(repo, { only: ['x.md'] });
  assert.deepEqual(r.leaks.map(l => `${l.line}:${l.type}`), ['2:secret-value', '3:secret-value', '4:secret-value', '5:pattern']);
  assert.equal(r.leaks[3].pattern, 'url-credential');
});
test('check: brokenLinks for relative .md links that do not resolve under OUT', async () => {
  const repo = await makeRepo({ 'src/a/b.js': '1\n', 'lib/c d.js': '1\n' });
  await scan(repo, {});
  await put(repo, '02_modules/a.md', 'x');
  await put(repo, '03_files/lib/c d.js.md', 'x');
  await put(repo, '03_files/src/a/b.js.md', [
    '[ok](../../../02_modules/a.md)',
    '[short](../../02_modules/a.md)',
    '[anchor](../../../02_modules/a.md#top) [bad anchor](../../../02_modules/zz.md#top)',
    '[angle](<../../../03_files/lib/c d.js.md>) [enc](../../../03_files/lib/c%20d.js.md)',
    '[web](https://x.y/a.md) [code](../../../../src/a/b.js) [escape](../../../../../out.md)',
  ].join('\n'));
  const r = await check(repo, {});
  assert.deepEqual(r.brokenLinks, [
    { doc: '03_files/src/a/b.js.md', line: 2, link: '../../02_modules/a.md' },
    { doc: '03_files/src/a/b.js.md', line: 3, link: '../../../02_modules/zz.md#top' },
    { doc: '03_files/src/a/b.js.md', line: 5, link: '../../../../../out.md' },
  ]);
  assert.equal(r.ok, false);
  const only = await check(repo, { only: ['02_modules/a.md'] });
  assert.deepEqual(only.brokenLinks, []);
});
test('CLI sample/prune; bad usage exits 2', async () => {
  const repo = await makeRepo({ 'a/x.js': '1' });
  assert.throws(() => run(['prune', repo]), e => e.status === 2);
  run(['scan', repo]);
  assert.deepEqual(JSON.parse(run(['sample', repo, '--module', 'a', '--seed', '3'])), ['03_files/a/x.js.md']);
  assert.deepEqual(JSON.parse(run(['sample', repo, '--module', 'nope'])), []);
  assert.throws(() => run(['sample', repo]), e => e.status === 2);
  assert.throws(() => run(['sample', repo, '--module', 'a', '--seed', 'x']), e => e.status === 2);
  assert.deepEqual(JSON.parse(run(['prune', repo])), { removed: [] });
});
test('check: leaks from appsettings, credentials.json, config/database.yml; quoted-key assignment', async () => {
  const repo = await makeRepo({
    'appsettings.json': '{"ConnectionStrings":{"Default":"Server=db;Password=connpw99"},"ApiKey":"apikey12345"}',
    'credentials.json': '{"installed":{"client_id":"cid-plain","client_secret":"clsecret77"}}',
    'config/database.yml': 'production:\n  adapter: postgresql\n  password: dbpass555\n',
    'src/a.js': '1\n' });
  await scan(repo, {});
  await put(repo, 'x.md', [
    'leaks apikey12345', 'leaks clsecret77', 'leaks dbpass555',
    '"password": "hunter22"', "'api_key': 'zzzzzz99'", 'safe "password": "***"', 'adapter postgresql cid-plain',
  ].join('\n'));
  const r = await check(repo, { only: ['x.md'] });
  assert.deepEqual(r.leaks.map(l => `${l.line}:${l.type}`), ['1:secret-value', '2:secret-value', '3:secret-value', '4:pattern', '5:pattern']);
  assert.ok(r.leaks.slice(3).every(l => l.pattern === 'assignment'));
});
test('check: example/sample/template secret files hold placeholders, not leak values', async () => {
  const repo = await makeRepo({
    '.env.example': 'JIRA_PROJECT_KEY=DEMO-PROJ-1\nDB_PASSWORD=shopname1\n',
    'k8s/secrets.example.yaml': 'kind: Secret\nmetadata:\n  name: app-secrets\n',
    'secrets.env.sample': 'API_TOKEN=tokentemplate1\n',
    '.env': 'DB_PASSWORD=realpass99\n',
    'src/a.js': '1\n' });
  await scan(repo, {});
  await put(repo, 'x.md', ['DEMO-PROJ-1 shopname1', 'kind Secret app-secrets tokentemplate1', 'leaks realpass99'].join('\n'));
  const r = await check(repo, { only: ['x.md'] });
  assert.deepEqual(r.leaks.map(l => `${l.line}:${l.type}`), ['3:secret-value']);
});
test('check: auth only as its own key segment or auth token', async () => {
  const repo = await makeRepo({ 'application.yml': 'spring:\n  security:\n    oauth2:\n      client-id: oauthclient1\nauthor: someauthor1\nmy:\n  auth:\n    user: authuser11\nauthToken: authtoken99\n' });
  await scan(repo, {});
  await put(repo, 'x.md', 'ok oauthclient1\nok someauthor1\nleaks authuser11\nleaks authtoken99\n');
  const r = await check(repo, { only: ['x.md'] });
  assert.deepEqual(r.leaks.map(l => l.line), [3, 4]);
});
test('check: batch and module summaries are leak-checked (full check only)', async () => {
  const repo = await docsRepo();
  await put(repo, '.doc-forge/summaries/batch-1.md', '- src/a.js — ok — 연결: 없음\n- .env — DB 비밀번호 hunter22 — 연결: 없음\n');
  await put(repo, '.doc-forge/summaries/module-src.md', 'password=supersecret1 이다.\n');
  const r = await check(repo, {});
  assert.deepEqual(r.leaks.filter(l => l.doc.startsWith('.doc-forge/')).map(l => `${l.doc}:${l.line}:${l.type}`),
    ['.doc-forge/summaries/batch-1.md:2:secret-value', '.doc-forge/summaries/module-src.md:1:pattern']);
  assert.deepEqual(r.brokenRefs, []);
  await put(repo, '03_files/src/a.js.md', 'ok');
  assert.deepEqual((await check(repo, { only: ['03_files/src/a.js.md'] })).leaks, []);
});
test('CLI batch gives each file its doc, up prefix and the module doc', async () => {
  const repo = await makeRepo({ 'src/routes/a.js': '1\n', '.mvn/w/x.properties': 'a=1\n', 'lib/한글 폴더/b c.js': '1\n', 'package.json': '{}' });
  run(['scan', repo]);
  const m = JSON.parse(await readFile(join(repo, 'docs/doc-forge/.doc-forge/manifest.json'), 'utf8'));
  const files = m.batches.flatMap(b => JSON.parse(run(['batch', repo, '--id', String(b.id)])).files);
  const by = Object.fromEntries(files.map(f => [f.path, f]));
  assert.equal(by['src/routes/a.js'].up, '../../..'); assert.equal(by['src/routes/a.js'].doc, '03_files/src/routes/a.js.md');
  assert.equal(by['.mvn/w/x.properties'].up, '../../..'); assert.equal(by['.mvn/w/x.properties'].doc, '03_files/_dot_mvn/w/x.properties.md');
  assert.equal(by['package.json'].up, '..');
  assert.equal(by['lib/한글 폴더/b c.js'].up, '../../..');
  const b = JSON.parse(run(['batch', repo, '--id', String(m.batches.find(x => x.module === 'routes').id)]));
  assert.equal(b.moduleDoc, '02_modules/routes.md');
});
test('CLI link prints the relative link between two OUT-relative docs', async () => {
  const repo = await makeRepo({ 'a.js': '1\n' });
  const link = (from, to) => JSON.parse(run(['link', repo, '--from', from, '--to', to])).link;
  assert.equal(link('03_files/src/main/java/a/Owner.java.md', '02_modules/owner.md'), '../../../../../02_modules/owner.md');
  assert.equal(link('03_files/_dot_mvn/wrapper/w.properties.md', '02_modules/_dot_mvn.md'), '../../../02_modules/_dot_mvn.md');
  assert.equal(link('02_modules/a.md', '03_files/src/a.js.md'), '../03_files/src/a.js.md');
  assert.equal(link('00_개요.md', '02_modules/a.md'), '02_modules/a.md');
  assert.equal(link('04_flows/주문 생성.md', '01_아키텍처.md'), '../01_아키텍처.md');
  assert.equal(link('03_files/src/a.js.md', '03_files/src/b.js.md'), 'b.js.md');
  assert.equal(link('02_modules/a.md', '03_files/lib/한글 폴더/b c.js.md'), '<../03_files/lib/한글 폴더/b c.js.md>');
  const code = args => { try { run(args); return 0; } catch (e) { return e.status; } };
  assert.equal(code(['link', repo, '--from', '02_modules/a.md']), 2);
  assert.equal(code(['link', repo, '--from', '../x.md', '--to', '02_modules/a.md']), 2);
  // what link prints must resolve under check's link rule
  await put(repo, '03_files/lib/한글 폴더/b c.js.md', 'x');
  await put(repo, '02_modules/a.md', `[b](${link('02_modules/a.md', '03_files/lib/한글 폴더/b c.js.md')})\n`);
  run(['scan', repo]);
  assert.deepEqual((await check(repo, { only: ['02_modules/a.md'] })).brokenLinks, []);
});
