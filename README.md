# OpenIDEA Vue 2 template navigation repro

Minimal Vue 2.7 project for [l0ng-ai/openidea#1164](https://github.com/l0ng-ai/openidea/issues/1164).

## 根因 / Root cause

**组件 import 省略了 `.vue` 后缀**时，TypeScript / Volar 解析不到组件类型，组件变成 `any`；它一旦注册进 `components`，整个组件实例类型（`this`）就降级为 `any`，于是：

- 模板里所有 `@event="method"`（原生元素和组件都算）**都不跳转**
- 模板表达式（`{{ count }}`、`v-if` 等）**仍然正常**

When a component is imported **without the `.vue` extension**, TypeScript/Volar cannot
resolve it, the component becomes `any`, and registering it under `components` degrades
the whole component instance type to `any`. Template event handlers then stop navigating,
while template expressions keep working.

## 复现 / Reproduce

`src/App.vue` 里是**故意不写后缀**的 import：

```js
import ChildButton from './components/ChildButton'   // 没有 .vue
```

实测：

| 位置 | 结果 |
| --- | --- |
| `<child-button>` 的 quickinfo | `(property) "child-button": any` |
| `<child-button @my-event="handler">` | `definition: []`，`any` |
| 原生 `<button @click="handler">` | `definition: []`，`any` |
| `<span>{{ count }}</span>` | ✅ 正常跳转 |

改成 `import ChildButton from './components/ChildButton.vue'` 后，以上全部恢复正常。

## 修复 / Fix

给组件 import 补上 `.vue`：

```js
import ChildButton from './components/ChildButton.vue'
```

真实项目验证（`af-linepatrol-web/src/pages/PatrolMapNew/index.vue`）：

```
- import XFormTable from '@vue2-client/.../XFormTable/XFormTable'
+ import XFormTable from '@vue2-client/.../XFormTable/XFormTable.vue'
```

改完后：

| 位置 | 结果 |
| --- | --- |
| `<left-gis @query-results="openTableList">` | ✅ 跳第 822 行 |
| `<ol-map @wms-click="handleWmsClick">` | ✅ 跳第 748 行 |
| `<a-button @click="toggleLeftGis">` | ✅ 跳第 1483 行 |

## 说明 / Notes

- 与 `@vue2-client` 无关：把这两个组件换成空壳组件也能复现/修复，变量只有 import 后缀。
- `strictFunctionTypes: true` 仍然是 Vue 2.7 Options API `this` 推断的前提（见 #1164）。
- 项目里其它同类 import（无 `.vue` 后缀）也会有同样问题，建议统一排查。

## 文件 / Files

```
src/
├─ App.vue                  # 复现用：import 不带 .vue
└─ components/ChildButton.vue
tsserver-probe.js           # 直接向 tsserver 查 definition / quickinfo
diagnostics-check.js        # 查语法/语义错误
compile-check.js            # 用 vue-template-compiler 检查 SFC
```

## 运行 / Run

```bash
npm install

# TS_LIB = 含 tsserver.js 的 TypeScript lib 目录
set TS_LIB=C:\path\to\node_modules\typescript\lib
$env:TS_LIB = "C:\path\to\node_modules\typescript\lib"

node tsserver-probe.js . node_modules "@my-event=\"handler\"" handler
node tsserver-probe.js . node_modules "@click=\"handler\"" handler
node tsserver-probe.js . node_modules "{{ count }}" count
```

---

I really like OpenIDEA — it is fast and the IntelliJ-keymap feels like home.
