// Q1.5 draft plugin API. The host supplies a typed request and owns its identity.
const TICKS_PER_MILLISECOND = 254016000n;

function reject(code) {
  throw new Error(code);
}

function parseTime(value) {
  const match = /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/.exec(value);
  if (!match) reject('invalid_timestamp');
  const [, hours, minutes, seconds, millis] = match;
  if (Number(minutes) > 59 || Number(seconds) > 59) reject('invalid_timestamp');
  return (((BigInt(hours) * 60n + BigInt(minutes)) * 60n + BigInt(seconds)) * 1000n + BigInt(millis));
}

function formatTime(ticks) {
  if (typeof ticks !== 'string' || !/^(0|[1-9]\d*)$/.test(ticks)) reject('invalid_output');
  const value = BigInt(ticks);
  if (value % TICKS_PER_MILLISECOND !== 0n) reject('invalid_output');
  const millis = value / TICKS_PER_MILLISECOND;
  const hours = millis / 3600000n;
  const minutes = (millis / 60000n) % 60n;
  const seconds = (millis / 1000n) % 60n;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis % 1000n).padStart(3, '0')}`;
}

function importFile(file) {
  if (!file || typeof file.content !== 'string' || typeof file.filename !== 'string' ||
      file.mediaType !== 'application/x-subrip') reject('invalid_input');
  const input = file.content.replace(/\r\n/g, '\n').trim();
  if (!input) reject('empty_input');
  const blocks = input.split(/\n\n+/);
  const subtitles = blocks.map((block, index) => {
    const lines = block.split('\n');
    if (lines.length < 3 || lines[0] !== String(index + 1)) reject('invalid_structure');
    for (let line = 2; line + 1 < lines.length; line++) {
      if (/^\d+$/.test(lines[line]) && lines[line + 1].includes('-->')) reject('invalid_structure');
    }
    const times = /^(\S+) --> (\S+)$/.exec(lines[1]);
    if (!times || lines.slice(2).some((line) => !line)) reject('invalid_structure');
    const start = parseTime(times[1]);
    const end = parseTime(times[2]);
    if (end <= start) reject('invalid_timestamp');
    return {
      id: `srt-${index + 1}-${start}-${end}`,
      startTime: String(start * TICKS_PER_MILLISECOND),
      endTime: String(end * TICKS_PER_MILLISECOND),
      text: lines.slice(2).join('\n'),
    };
  });
  return { artifactType: 'FormatImportArtifact', track: { subtitles } };
}

function exportTrack(track) {
  if (!track || !Array.isArray(track.subtitles)) reject('invalid_input');
  const text = track.subtitles.map((cue, index) => {
    if (typeof cue.text !== 'string' || !cue.text) reject('invalid_input');
    return `${index + 1}\n${formatTime(cue.startTime)} --> ${formatTime(cue.endTime)}\n${cue.text}`;
  }).join('\n\n') + '\n\n';
  return {
    artifactType: 'RawFileArtifact',
    file: { filename: 'subtitles.srt', mediaType: 'application/x-subrip', content: text },
  };
}

globalThis.ocyraPlugin = async (request) => {
  if (request.operation === 'import') return importFile(request.file);
  if (request.operation === 'export') return exportTrack(request.track);
  reject('invalid_input');
};
