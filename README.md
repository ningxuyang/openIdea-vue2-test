# OpenIDEA Vue 2 template navigation repro

Minimal Vue 2.7 project for [l0ng-ai/openidea#1164](https://github.com/l0ng-ai/openidea/issues/1164)
and [#1163](https://github.com/l0ng-ai/openidea/issues/1163): Go to Declaration on a template
handler (or on `this.xxx` inside `<script>`) does not work for Options API components.

Related report: [#1164](https://github.com/l0ng-ai/openidea/issues/1164)

---

## 现象 / Symptom

- `import Vue from 'vue'` 里的 `vue`：**能**跳转到 `node_modules/vue/types/vue.d.ts`
- 模板 `@click="handler"` 里的 `handler`：**不能**跳转，`definition` 返回 `[]`
- `<script>` 里 `this.myConsole()` 的 `myConsole`：**也不能**跳转，hover 显示 `any`

`import Vue from 'vue'` navigates to `node_modules/vue/types/vue.d.ts`; the template
`handler` and `this.myConsole()` both resolve to `any`, and `definition` returns `[]`.

## 环境 / Environment

- OpenIDEA 0.1.35, Windows 11 x64
- Vue 2.7.16, plain JavaScript, Options API, `jsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES6",
    "module": "commonjs",
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": true,
    "allowSyntheticDefaultImports": true,
    "jsx": "preserve"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "vueCompilerOptions": { "target": 2.7 }
}
```

`module` 是 `commonjs`（不是 `esnext`）；补上 `moduleResolution: "node"` 和
`vueCompilerOptions.target: 2.7` 之后现象不变。

## 文件 / Files

- `src/App.vue` — the minimal Options API component
- `tsserver-probe.js` — starts `tsserver` with `@vue/typescript-plugin` and asks for
  `definition` / `quickinfo` at a position
- `plugin-check.js` — asks the plugin `_vue:projectInfo` which files it put into the
  TS program (this is how we spotted the Vue 3.4 shim)

## 运行 / Run

```bash
npm install

# TS_LIB = a TypeScript lib directory that contains tsserver.js
set TS_LIB=C:\path\to\node_modules\typescript\lib       # cmd
$env:TS_LIB = "C:\path\to\node_modules\typescript\lib"   # PowerShell

node plugin-check.js . node_modules
node tsserver-probe.js . node_modules "this.myConsole" myConsole
node tsserver-probe.js . node_modules "@click=\"handler\"" handler
```

## 发现 / Findings

1. `plugin-check.js` 用内置 plugin **3.3.14** 时，program 里出现
   `@vue/language-core/types/vue-3.4-shims.d.ts` —— 也就是说这个 plugin 把项目当成
   **Vue 3.4** 处理，Vue 2 的组件实例类型因此没有生成，`this` 退化为 `any`。
2. 换成干净的 **3.0.11** 三件套（`@vue/language-server` / `@vue/typescript-plugin` /
   `@vue/language-core` 全 3.0.11）后，不再加载 3.4 shim；但通过 tsserver 直接查询时
   `this` 仍为 `any`（直接查询没有经过 Vue Language Server 的虚拟文件，存在局限）。
3. `@vue/language-server` 内置版本是 3.3.14，而 Vue Language Tools 从 **3.1** 起
   移除了 Vue 2 支持（[vuejs/language-tools#5455](https://github.com/vuejs/language-tools/discussions/5455)）。

## 期望 / Expected

Upstream should confirm which `@vue/typescript-plugin` version the #1163 test used.
If the bundled 3.3.14 really resolves Vue 2 templates, the project here should reproduce it.

---

I really like OpenIDEA — it is fast, and the IntelliJ-style keymap feels right at home.
This Vue 2 issue is the single biggest blocker keeping me from using it for our main
projects, which are all Vue 2 + Options API.
