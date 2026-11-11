// Probe: does @vue/typescript-plugin give the component instance type (this) / template members?
// Usage:
//   node tsserver-probe.js <project-dir> <plugin-probe-dir> <line-needle> <word>
// Env:
//   TS_LIB  TypeScript `lib` dir that contains tsserver.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const proj = process.argv[2] || process.cwd();
const probe = process.argv[3] || path.join(proj, 'node_modules');
const needleLine = process.argv[4] || '@click="handler"';
const needle = process.argv[5] || 'handler';

const tsLib = process.env.TS_LIB;
if (!tsLib) {
  console.error('set TS_LIB to a TypeScript lib directory (the one with tsserver.js)');
  process.exit(2);
}
const tsserver = path.join(tsLib, 'tsserver.js');
const file = process.argv[6] || path.join(proj, 'src', 'App.vue');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const lineIdx = lines.findIndex((l) => l.includes(needleLine));
if (lineIdx < 0) {
  console.error('line not found:', needleLine);
  process.exit(2);
}
const col = lines[lineIdx].indexOf(needle);
const offset = col + 1 + Math.floor(needle.length / 2);
const ln = lineIdx + 1;

const proc = spawn(process.execPath, [tsserver, '--globalPlugins', '@vue/typescript-plugin', '--pluginProbeLocations', probe], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buf = '';
const responses = [];
proc.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const m = JSON.parse(line);
      if (m.type === 'response') responses.push(m);
    } catch {}
  }
});
proc.stderr.on('data', (d) => {
  const s = d.toString().trim();
  if (s) console.error('[tsserver]', s.slice(0, 300));
});
const send = (p) => proc.stdin.write(JSON.stringify(p) + '\n');
function waitFor(seq, ms = 90000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const hit = responses.find((r) => r.request_seq === seq);
      if (hit) {
        clearInterval(timer);
        resolve(hit);
      } else if (Date.now() - t0 > ms) {
        clearInterval(timer);
        reject(new Error('timeout ' + seq));
      }
    }, 200);
  });
}

(async () => {
  send({ seq: 1, type: 'request', command: 'open', arguments: { file } });
  await waitFor(1);
  await new Promise((r) => setTimeout(r, 5000));
  console.log('target:', JSON.stringify({ line: ln, offset, text: lines[lineIdx].trim() }));

  send({ seq: 2, type: 'request', command: 'definition', arguments: { file, line: ln, offset } });
  console.log('definition:', JSON.stringify((await waitFor(2)).body));

  send({ seq: 3, type: 'request', command: 'quickinfo', arguments: { file, line: ln, offset } });
  console.log('quickinfo:', JSON.stringify((await waitFor(3)).body));

  proc.kill();
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e.message);
  proc.kill();
  process.exit(1);
});
