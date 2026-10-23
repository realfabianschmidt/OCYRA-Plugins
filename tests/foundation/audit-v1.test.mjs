import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as module from '../../plugins/audit/foundation-policy/handler.js';
const run = module.default;

const manifest = JSON.parse(readFileSync('plugins/audit/foundation-policy/manifest.json', 'utf8'));
test('audit manifest omits all format-only fields as required by the Rust SDK', () => {
  for (const field of ['binary', 'format', 'documentKind']) assert.equal(Object.hasOwn(manifest, field), false);
  assert.equal(manifest.family, 'audit');
  assert.equal(manifest.role, 'audit.policy-provider');
});
const content = readFileSync('plugins/audit/foundation-policy/policy.json', 'utf8');
const host = { data: { read: async (request) => {
  assert.deepEqual(request, { path: 'policy.json' });
  return { content };
} } };
const facts = { scope: 'subtitle-segments', language: 'de', hasVideo: true,
  segments: [{ id: 'cue', index: 1, startTime: '0', endTime: '254016000000',
    text: 'exact', charCount: 5, lineCount: 1, maxLineLength: 5, gapToNext: null }] };

test('audit v1 uses the sole default entry, closed envelope and structured package text', async () => {
  assert.deepEqual(Object.keys(module), ['default']);
  assert.equal(globalThis.ocyraPlugin, undefined);
  const resolved = await run({ requestKind: 'resolve-policy', profileId: 'foundation-fixture' }, host);
  assert.deepEqual(Object.keys(resolved).sort(), ['artifact', 'status']);
  assert.equal(resolved.artifact.artifactType, 'PolicyConstraintsArtifact');
  const evaluate = (value) => run({ requestKind: 'evaluate-audit', profileId: 'foundation-fixture', facts: value }, host);
  const pass = await evaluate(facts);
  assert.equal(pass.artifact.report.failCount, 0);
  assert.deepEqual(pass.artifact.report.checklist[1], { id: 'video-context', status: 'manual' });
  const fail = structuredClone(facts);
  fail.segments[0].maxLineLength = 43;
  assert.equal((await evaluate(fail)).artifact.report.failCount, 1);
  const noVideo = { ...facts, hasVideo: false };
  assert.equal((await evaluate(noVideo)).artifact.report.checklist[1].status, 'na');
});

test('malformed requests fail explicitly; host failures are not converted into guest-owned codes', async () => {
  const base = { requestKind: 'evaluate-audit', profileId: 'foundation-fixture', facts };
  for (const request of [null, [], {}, { ...base, profileId: 'unknown' },
    { ...base, unknown: true }, { ...base, requestKind: 'unknown' }, { ...base, facts: null },
    { ...base, facts: { ...facts, scope: 'unknown' } },
    ...[NaN, -1, 4294967296, undefined].map((value) => ({
      ...base, facts: { ...facts, segments: [{ ...facts.segments[0], maxLineLength: value }] },
    }))]) {
    assert.deepEqual(await run(request, host), { status: 'error', error: { code: 'invalid_input' } });
  }
  const denial = new Error('synthetic host denial');
  await assert.rejects(run(base, { data: { read: async () => { throw denial; } } }), (error) => error === denial);
});
