import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proj = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'AGENTS.md',
  'README.md',
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'lib/collect.js',
  'lib/apply.js',
  'lib/page-detect.js',
  'lib/toolbar.js',
  'lib/glossary.js',
  'lib/translate-all.js',
  'safari/bilingual-translate.user.js',
];

test('project smoke: critical files exist', () => {
  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(proj, rel)), `missing ${rel}`);
  }
});

test('manifest has content scripts and host permissions', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(proj, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.content_scripts?.[0]?.js?.includes('content.js'));
  assert.ok(manifest.host_permissions?.some((p) => p.includes('edge.microsoft.com')));
  assert.ok(manifest.background?.service_worker);
});

test('package scripts include test and sync-lib', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(proj, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test);
  assert.ok(pkg.scripts['sync-lib']);
});
