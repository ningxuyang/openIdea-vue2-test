const fs = require('fs');
const path = require('path');

const proj = process.argv[2] || process.cwd();
const count = Number(process.argv[3] || 500);

let s = '<template>\n  <div>\n';
for (let i = 0; i < count; i++) s += `    <div class="row">row ${i}</div>\n`;
s += '    <child-button @my-event="handler" />\n  </div>\n</template>\n\n<script>\n';
s += "import ChildButton from './components/ChildButton.vue'\n\n";
s += 'export default {\n  name: \'AppLarge\',\n  components: { ChildButton },\n';
s += '  methods: {\n    handler() {\n      console.log(\'clicked\')\n    }\n  }\n}\n</script>\n';

const out = path.join(proj, 'src', 'AppLarge.vue');
fs.writeFileSync(out, s, 'utf8');
console.log('wrote', out);
console.log('lines', s.split('\n').length);
