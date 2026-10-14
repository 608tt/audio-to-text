export const SAMPLE_RATE = 16000;
export const MAX_BYTES = 200 * 1024 * 1024;
export const MAX_SECONDS = 30 * 60;
export const AUTO_SPEAKER_SECONDS = 60;

export function validateFile(file) {
  if (!file || !/\.(mp3|m4a|wav)$/i.test(file.name)) throw new Error('Choose an MP3, M4A or WAV file.');
  if (!file.size) throw new Error('The audio file is empty.');
  if (file.size > MAX_BYTES) throw new Error('The audio file exceeds 200 MB.');
}

export function mixChannels(channels) {
  if (!channels.length || channels.some(c => c.length !== channels[0].length)) throw new Error('Invalid audio channels.');
  const result = new Float32Array(channels[0].length);
  for (const channel of channels) for (let i = 0; i < result.length; i++) result[i] += channel[i] / channels.length;
  return result;
}

export function validateMode(mode, duration, channels) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw new Error('Use a recording of up to 30 minutes.');
  if (!['none', 'auto', 'channels'].includes(mode)) throw new Error('Invalid speaker mode.');
  if (mode === 'channels' && channels !== 2) throw new Error('Channel separation requires a stereo recording with one speaker per channel.');
  if (mode === 'auto' && duration > AUTO_SPEAKER_SECONDS) throw new Error('Experimental automatic speakers supports clips of up to 60 seconds. Choose no speakers or channel separation for longer files.');
}

export function safeBasename(name) {
  return name.replace(/\.[^.]*$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'transcript';
}

export function speakerAt(start, end, segments, duration) {
  if (!Number.isFinite(start)) return 'UNKNOWN';
  const stop = Number.isFinite(end) ? Math.max(start, end) : duration;
  const weights = new Map();
  for (const s of segments) {
    if (s.id === 0 || !Number.isFinite(s.start) || !Number.isFinite(s.end)) continue;
    const overlap = Math.max(0, Math.min(stop, s.end) - Math.max(start, s.start));
    const key = s.label || `SPEAKER_${s.id}`;
    if (overlap > 0) weights.set(key, (weights.get(key) || 0) + overlap);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';
}

export function labelWords(chunks, segments, duration) {
  const turns = [];
  for (const chunk of chunks || []) {
    if (!chunk.text) continue;
    const [start, end] = chunk.timestamp || [];
    const label = speakerAt(start, end, segments, duration);
    if (turns.at(-1)?.speaker === label) turns.at(-1).text += chunk.text;
    else turns.push({ speaker: label, text: chunk.text });
  }
  return turns;
}

export function readableSpeaker(label, english = false) {
  if (label === 'UNKNOWN') return english ? 'Speaker unclear' : '说话人不确定';
  if (label === 'LEFT') return english ? 'Left channel' : '左声道';
  if (label === 'RIGHT') return english ? 'Right channel' : '右声道';
  const numbers = label.match(/\d+/g);
  return numbers?.length ? `${english ? 'Speaker' : '说话人'} ${numbers.join('+')}` : label;
}

export function formatTurns(turns, english = false) {
  const identities = new Map();
  function canonical(label) {
    if (!/^SPEAKER_\d+(?:\+SPEAKER_\d+)*$/.test(label)) return label;
    return label.split('+').map(member=>{
      if (!identities.has(member)) identities.set(member,`SPEAKER_${identities.size+1}`);
      return identities.get(member);
    }).join('+');
  }
  return turns.map(t => `${readableSpeaker(canonical(t.speaker), english)}: ${t.text.trim()}`).join('\n\n');
}

export function stereoTurns(left, right) {
  return [...(left.chunks || []).map(c => ({...c, speaker: 'LEFT'})), ...(right.chunks || []).map(c => ({...c, speaker: 'RIGHT'}))]
    .sort((a,b) => (a.timestamp?.[0] ?? Infinity) - (b.timestamp?.[0] ?? Infinity))
    .map(c => ({speaker:c.speaker,text:c.text}));
}

export function xmlEscape(value) {
  // XML 1.0 excludes most control characters; retain tabs, CR and LF.
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]/gu, '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
