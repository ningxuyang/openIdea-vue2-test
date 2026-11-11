# OpenIDEA Vue 2 template navigation repro

Minimal Vue 2.7 project for [l0ng-ai/openidea#1164](https://github.com/l0ng-ai/openidea/issues/1164)
and [#1163](https://github.com/l0ng-ai/openidea/issues/1163).

## 结论 / TL;DR

- `jsconfig.json` 的 `compilerOptions` 加上 **`"strictFunctionTypes": true`** 后：
  - `this.xxx` 有类型（不再是 `any`）
  - 模板表达式（`{{ }}`、`v-if`、`v-show`）能跳转
  - 原生元素事件、局部组件事件、全局组件事件**都能跳转**
- 因此本最小项目**无法复现**真实项目里「组件事件不跳」的现象（见下方“未复现”）。

With `"strictFunctionTypes": true` in `jsconfig.json`, everything below navigates:
`this.xxx`, template expressions, native events, local component events, and global
component events. This repro therefore does **not** reproduce the real-project issue.

## 项目结构 / Layout

```
src/
├─ App.vue                  # 4 个用例
├─ components/ChildButton.vue
└─ global-components.d.ts   # 可选：声明 global-button 为全局组件
jsconfig.json               # strictFunctionTypes: true
tsserver-probe.js           # 直接向 tsserver 查询 definition / quickinfo
plugin-check.js             # 查询 _vue:projectInfo（看 plugin 版本 / vue shim）
```

## 四个用例 / Cases

| 用例 | 模板 | 期望 | 实测（strictFunctionTypes: true） |
| --- | --- | --- | --- |
| A | `<button @click="handler">` | 跳 `methods.handler` | ✅ |
| B | `<child-button @my-event="handler">`（局部注册） | 跳 `methods.handler` | ✅ |
| C | `<global-button @my-event="handler">`（`globalTypes` 声明） | 跳 `methods.handler` | ✅ |
| D | `<span>{{ count }}</span>` | 跳 `data.count` | ✅ |

> C 用例在**去掉** `vueCompilerOptions.globalTypes` 时也能跳，所以“未声明的全局组件”同样不是原因。

## 未复现 / Not reproduced

真实项目（Vue 2.7 + Ant Design Vue）里：

- `<a-button @click="toggleLeftGis">` → `definition: []`，`quickinfo: any`
- `<left-gis @query-results="openTableList">`（运行时全局注册）→ 同样为空

同一文件里模板表达式（`v-if="webConfig.setting?.showGis"`）能跳，`this.$refs` 有类型。
所以不是 `strictFunctionTypes` 的问题，疑似与组件库的 web-types / 全局组件解析有关。

In the real project, events on Ant Design components (`a-button`) and on runtime
globally-registered components (`left-gis`) still return an empty definition, while
template expressions in the same file navigate fine.

## 运行 / Run

```bash
npm install

# TS_LIB = a TypeScript lib directory that contains tsserver.js
set TS_LIB=C:\path\to\node_modules\typescript\lib
$env:TS_LIB = "C:\path\to\node_modules\typescript\lib"

node plugin-check.js . node_modules
node tsserver-probe.js . node_modules "this.myConsole" myConsole
node tsserver-probe.js . node_modules "@click=\"handler\"" handler
node tsserver-probe.js . node_modules "@my-event=\"handler\"" handler
node tsserver-probe.js . node_modules "{{ count }}" count
```

`tsserver-probe.js` 可选第 6 个参数指定文件：`node tsserver-probe.js <proj> <probe> <line-needle> <word> <file.vue>`。

## 如何验证 UI 行为

1. 用 OpenIDEA 打开本目录
2. 打开 `src/App.vue`
3. 分别在 A/B/C/D 四处按 `Ctrl+B`，应都能跳到对应定义

---

I really like OpenIDEA — it is fast and the IntelliJ-style keymap feels right at home.
