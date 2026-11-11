// 用 tsserver 查文件的语法错误（syntacticDiagnostics）
const { spawn } = require('child_process');
const path = require('path');

const proj = process.argv[2];
const file = process.argv[3];
const tsLib = process.env.TS_LIB;
const tsserver = path.join(tsLib, 'tsserver.js');

const proc = spawn(process.execPath, [tsserver], { stdio: ['pipe', 'pipe', 'pipe'] });
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
  if (s) console.error('[tsserver]', s.slice(0, 400));
});
const send = (p) => proc.stdin.write(JSON.stringify(p) + '\n');
function waitFor(seq, ms = 60000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      const hit = responses.find((r) => r.request_seq === seq);
      if (hit) { clearInterval(t); resolve(hit); }
      else if (Date.now() - t0 > ms) { clearInterval(t); reject(new Error('timeout ' + seq)); }
    }, 150);
  });
}

(async () => {
  send({ seq: 1, type: 'request', command: 'open', arguments: { file } });
  await waitFor(1);
  await new Promise((r) => setTimeout(r, 4000));
  send({ seq: 2, type: 'request', command: 'syntacticDiagnostics', arguments: { file } });
  const res = await waitFor(2);
  const body = res.body || [];
  console.log('syntactic errors:', body.length);
  for (const d of body.slice(0, 10)) {
    const msg = typeof d.messageText === 'string' ? d.messageText : JSON.stringify(d.messageText);
    console.log(' - line', d.start && d.start.line, ':', msg.slice(0, 300));
  }
  send({ seq: 3, type: 'request', command: 'semanticDiagnostics', arguments: { file } });
  const sem = await waitFor(3, 120000);
  const sb = sem.body || [];
  console.log('semantic errors:', sb.length);
  for (const d of sb.slice(0, 8)) {
    const msg = typeof d.messageText === 'string' ? d.messageText : JSON.stringify(d.messageText);
    console.log(' - line', d.start && d.start.line, ':', msg.slice(0, 300));
  }
  proc.kill();
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); proc.kill(); process.exit(1); });
