import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

function handler(path) {
  const context = {};
  runInNewContext(readFileSync(path, 'utf8'), context, { timeout: 1000 });
  return context.ocyraPlugin;
}

const subrip = join('plugins', 'format', 'subrip');
const audit = join('plugins', 'audit', 'foundation-policy');

test('SRT package preserves exact millisecond timestamps', async () => {
  const run = handler(join(subrip, 'handler.js'));
  const result = await run({ operation: 'import', file: {
    filename: 'sample.srt', mediaType: 'application/x-subrip',
    content: '1\n00:59:59,499 --> 01:00:01,000\nHello\n',
  } });
  assert.equal(result.track.subtitles[0].startTime, String(3_599_499n * 254016000n));
  const exported = await run({ operation: 'export', track: result.track });
  assert.equal(exported.file.content, '1\n00:59:59,499 --> 01:00:01,000\nHello\n\n');
});

test('synthetic policy resolves and marks video-only checks na for localization', async () => {
  const run = handler(join(audit, 'handler.js'));
  const policy = readFileSync(join(audit, 'policy.json'), 'utf8');
  const host = { data: { read: async (path) => {
    assert.equal(path, 'policy.json');
    return policy;
  } } };
  const resolved = await run({ requestKind: 'resolve-policy', profileId: 'foundation-fixture' }, host);
  assert.equal(resolved.policy.profileId, 'foundation-fixture');
  const report = await run({ requestKind: 'evaluate-audit', profileId: 'foundation-fixture',
    facts: { scope: 'localization-units', locale: 'de', units: [{
      id: 'u1', key: 'hello', documentId: 'd1', sourceLength: 5, targetLength: 0,
      hasTarget: false, reviewed: false, approved: false,
    }] },
  }, host);
  assert.equal(report.report.failCount, 1);
  assert.equal(report.report.checklist[1].status, 'na');
});
