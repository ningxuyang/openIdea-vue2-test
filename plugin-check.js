// Probe: which Vue shim does @vue/typescript-plugin put into the program? (Vue 3.4 vs Vue 2.7)
// Usage:
//   node plugin-check.js <project-dir> <plugin-probe-dir>
// Env:
//   TS_LIB  TypeScript `lib` dir that contains tsserver.js
const { spawn } = require('child_process');
const path = require('path');

const proj = process.argv[2] || process.cwd();
const probe = process.argv[3] || path.join(proj, 'node_modules');
const tsLib = process.env.TS_LIB;
if (!tsLib) {
  console.error('set TS_LIB to a TypeScript lib directory (the one with tsserver.js)');
  process.exit(2);
}
const file = path.join(proj, 'src', 'App.vue');

const proc = spawn(process.execPath, [path.join(tsLib, 'tsserver.js'), '--globalPlugins', '@vue/typescript-plugin', '--pluginProbeLocations', probe], {
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
function waitFor(seq, ms = 30000) {
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
    }, 150);
  });
}

(async () => {
  send({ seq: 1, type: 'request', command: 'open', arguments: { file } });
  await waitFor(1);
  await new Promise((r) => setTimeout(r, 4000));
  send({ seq: 2, type: 'request', command: '_vue:projectInfo', arguments: { file, needFileNameList: true } });
  const res = await waitFor(2);
  const body = res.body || {};
  const interesting = (body.fileNames || []).filter((f) =>
    /vue-\d+\.\d+-shims|App\.vue$|vue[\\/]types[\\/]index\.d\.ts/.test(f),
  );
  console.log(JSON.stringify({
    configFileName: body.configFileName,
    languageServiceDisabled: body.languageServiceDisabled,
    interesting,
  }, null, 2));
  proc.kill();
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e.message);
  proc.kill();
  process.exit(1);
});
