// The policy is synthetic test data. It makes no legal or standards claim.
globalThis.ocyraPlugin = async (request, host) => {
  const policy = JSON.parse(await host.data.read('policy.json'));
  if (request.profileId !== policy.profileId) throw new Error('invalid_input');
  if (request.requestKind === 'resolve-policy') {
    return { artifactType: 'PolicyConstraintsArtifact', policy };
  }
  if (request.requestKind !== 'evaluate-audit' || !request.facts) throw new Error('invalid_input');
  const { facts } = request;
  const subtitle = facts.scope === 'subtitle-segments';
  if (!subtitle && facts.scope !== 'localization-units') throw new Error('invalid_input');
  const items = subtitle ? facts.segments : facts.units;
  if (!Array.isArray(items)) throw new Error('invalid_input');
  const issues = [];
  for (const item of items) {
    const failed = subtitle
      ? item.maxLineLength > policy.maxLineLength || item.lineCount > policy.maxLines
      : !item.hasTarget;
    if (failed) issues.push({ itemId: item.id, ruleId: 'text-length', status: 'fail' });
  }
  return {
    artifactType: 'AuditReportArtifact',
    report: {
      profileId: policy.profileId,
      scope: facts.scope,
      totalItems: items.length,
      failCount: issues.length,
      checklist: [
        { id: 'text-length', status: issues.length ? 'fail' : 'pass' },
        { id: 'video-context', status: subtitle && facts.hasVideo ? 'manual' : 'na' },
      ],
      issues,
    },
  };
};
