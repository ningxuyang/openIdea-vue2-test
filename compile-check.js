// 用项目自带的 vue-template-compiler 检查 SFC 模板/脚本是否能正常解析
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const proj = process.argv[3];
const compiler = require(path.join(proj, 'node_modules', 'vue-template-compiler'));

const text = fs.readFileSync(file, 'utf8');
const sfc = compiler.parseComponent(text);
console.log('has script:', !!sfc.script, '| has template:', !!sfc.template, '| styles:', (sfc.styles || []).length);

if (sfc.template) {
  const res = compiler.compile(sfc.template.content, { outputSourceRange: true });
  console.log('template errors:', JSON.stringify(res.errors));
  console.log('template tips:', JSON.stringify((res.tips || []).slice(0, 5)));
  console.log('render fn:', res.render ? 'ok' : 'missing');
}
