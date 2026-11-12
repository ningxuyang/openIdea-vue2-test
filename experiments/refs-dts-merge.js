// Evidence 1: can a declaration merge make `this.$refs.child` precise?
//
// Runs the same tsserver probe against several declaration variants and prints
// what Volar/vtsls actually reports. Requires TS_LIB.
//
//   $env:TS_LIB = "...\typescript\lib"
//   node experiments/refs-dts-merge.js
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const proj = path.join(__dirname, '..');
const probe = path.join(proj, 'tsserver-probe.js');
const probeDir = path.join(proj, 'node_modules');
const dts = path.join(proj, 'src', 'refs-experiment.d.ts');

const IMPORT = `import ChildButton from './components/ChildButton.vue'\n`;

const variants = [
  { id: '0 baseline (no merge)', dts: null },
  {
    id: '1 vue/types/vue + full generics',
    dts: `${IMPORT}
declare module 'vue/types/vue' {
  interface Vue<
    Data = Record<string, any>,
    Props = Record<string, any>,
    Instance = never,
    Options = never,
    Emit = (event: string, ...args: any[]) => Vue
  > {
    $refs: { child: ChildButton }
  }
}
`,
  },
  {
    id: '2 vue/types/vue + no generics',
    dts: `${IMPORT}
declare module 'vue/types/vue' {
  interface Vue {
    $refs: { child: ChildButton }
  }
}
`,
  },
  {
    id: '3 module "vue" (re-export, wrong place)',
    dts: `${IMPORT}
declare module 'vue' {
  interface Vue {
    $refs: { child: ChildButton }
  }
}
`,
  },
  {
    id: '4 index signature + member',
    dts: `${IMPORT}
declare module 'vue/types/vue' {
  interface Vue<
    Data = Record<string, any>,
    Props = Record<string, any>,
    Instance = never,
    Options = never,
    Emit = (event: string, ...args: any[]) => Vue
  > {
    $refs: {
      [key: string]: ChildButton | Element | undefined
      child: ChildButton
    }
  }
}
`,
  },
];

function probeOnce(needleLine, needle) {
  try {
    return execFileSync(process.execPath, [probe, proj, probeDir, needleLine, needle], {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000,
    });
  } catch (e) {
    return 'PROBE FAILED: ' + (e.stdout || '') + (e.stderr || e.message);
  }
}

function pick(out, key) {
  const l = out.split('\n').find((x) => x.startsWith(key + ':'));
  return l ? l.slice(key.length + 1).trim() : '(none)';
}

function summarize(def) {
  if (def === '(none)' || def === '[]') return 'definition: [] (nothing to jump to)';
  try {
    const arr = JSON.parse(def);
    const files = arr.map((d) => path.basename(d.file) + ':' + d.start.line);
    return `definition: ${arr.length} target(s) → ${files.join(', ')}`;
  } catch {
    return 'definition: ' + def.slice(0, 200);
  }
}

for (const v of variants) {
  if (v.dts) fs.writeFileSync(dts, v.dts, 'utf8');
  else fs.rmSync(dts, { force: true });

  const a = probeOnce('this.$refs.child', '$refs');
  const b = probeOnce('this.$refs.child.focusIt', 'focusIt');
  const refsType = pick(a, 'quickinfo');
  const hasChild = /child:/.test(refsType);

  console.log('\n=== ' + v.id);
  console.log('  this.$refs.child        → ' + summarize(pick(a, 'definition')));
  console.log('  $refs type contains member "child"? ' + (hasChild ? 'YES' : 'NO (still the index signature)'));
  console.log('  this.$refs.child.focusIt → ' + summarize(pick(b, 'definition')));
  console.log('  focusIt type            → ' + pick(b, 'quickinfo').slice(0, 120));
}

fs.rmSync(dts, { force: true });
console.log('\ncleaned up src/refs-experiment.d.ts');
