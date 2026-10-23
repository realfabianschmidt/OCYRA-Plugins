// Synthetic test policy only; no legal or standards claim.
const invalid = () => ({ status: 'error', error: { code: 'invalid_input' } });

export default async function run(request, host) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return invalid();
  const resolving = request.requestKind === 'resolve-policy';
  if (!resolving && request.requestKind !== 'evaluate-audit') return invalid();
  const fields = resolving ? ['requestKind', 'profileId'] : ['requestKind', 'profileId', 'facts'];
  if (Object.keys(request).length !== fields.length ||
      Object.keys(request).some((key) => !fields.includes(key))) return invalid();
  const { content } = await host.data.read({ path: 'policy.json' });
  const policy = JSON.parse(content);
  if (request.profileId !== policy.profileId) return invalid();
  if (resolving) {
    return { status: 'ok', artifact: { artifactType: 'PolicyConstraintsArtifact', policy } };
  }
  const { facts } = request;
  if (!facts || typeof facts !== 'object') return invalid();
  const subtitle = facts.scope === 'subtitle-segments';
  if (!subtitle && facts.scope !== 'localization-units') return invalid();
  const items = subtitle ? facts.segments : facts.units;
  if (!Array.isArray(items) || items.length > 3600) return invalid();
  const issues = [];
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id) return invalid();
    if (subtitle ? ![item.maxLineLength, item.lineCount].every((n) =>
      Number.isInteger(n) && n >= 0 && n <= 4294967295) : typeof item.hasTarget !== 'boolean') return invalid();
    const failed = subtitle
      ? item.maxLineLength > policy.maxLineLength || item.lineCount > policy.maxLines
      : !item.hasTarget;
    if (failed) issues.push({ itemId: item.id, ruleId: 'text-length', status: 'fail' });
  }
  return {
    status: 'ok',
    artifact: {
      artifactType: 'AuditReportArtifact',
      report: {
        profileId: policy.profileId, scope: facts.scope, totalItems: items.length,
        failCount: issues.length,
        checklist: [
          { id: 'text-length', status: issues.length ? 'fail' : 'pass' },
          { id: 'video-context', status: subtitle && facts.hasVideo ? 'manual' : 'na' },
        ],
        issues,
      },
    },
  };
}
