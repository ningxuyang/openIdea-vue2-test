# OpenIDEA: `this.$refs.x` cannot be navigated (Vue 2.7 Options API)

Vue 2.7 Options API 项目里，`this.$refs.child` 只能跳到 `vue.d.ts` 的索引签名，
`this.$refs.child.focusIt()` 完全没有跳转。WebStorm 可以精确跳转。

In a Vue 2.7 Options API project, `this.$refs.child` only jumps to the index
signature in `vue.d.ts`, and `this.$refs.child.focusIt()` has no navigation at
all. WebStorm navigates both precisely.

Target issue: `l0ng-ai/openidea` — Vue 2.7 Options API `$refs` navigation.

---

## 1. 复现 / Reproduce

`src/App.vue`:

```vue
<template>
  <div>
    <child-button ref="child" @my-event="handler" />
    <span>{{ $refs.child }}</span>
  </div>
</template>

<script>
import ChildButton from './components/ChildButton.vue'

export default {
  name: 'App',
  components: { ChildButton },
  methods: {
    handler() {
      this.$refs.child            // ① 期望跳到 ref="child"
      this.$refs.child.focusIt()  // ② 期望跳到 ChildButton.vue 的 focusIt
    }
  }
}
</script>
```

`src/components/ChildButton.vue` 里定义了 `methods: { focusIt() {} }`。

### 期望 / Expected

| 光标位置 | 期望跳到 |
| --- | --- |
| `this.$refs.child` | 本文件 `<child-button ref="child">`（`ref="child"` 属性） |
| `this.$refs.child.focusIt` | `src/components/ChildButton.vue` 的 `focusIt` |

### 实际 / Actual

```
① this.$refs.child        → node_modules/vue/types/vue.d.ts:67  ($refs 索引签名)
② this.$refs.child.focusIt → definition: []   (nothing to jump to)，类型是 any
```

## 2. 实测输出 / Measured output

用 `tsserver-probe.js` 直接问 vtsls（绕开 UI，排除 IDE 渲染问题）：

```powershell
$env:TS_LIB = "<typescript>/lib"
node tsserver-probe.js . node_modules "this.$refs.child" "\`$refs"
node tsserver-probe.js . node_modules "this.$refs.child.focusIt" focusIt
```

```
① definition: vue.d.ts:67 (offset 12-17)
   quickinfo : (property) Vue<...>.$refs: {
                 [key: string]: ComponentPublicInstance<...> | Element | Vue<...> | (...)[]
               }

② definition: []
   quickinfo : any
```

## 3. 根因 / Root cause

三层，缺一不可。

### 3.1 Vue 2.7 的 `$refs` 本身就是索引签名

`node_modules/vue/types/vue.d.ts:67`:

```ts
export interface Vue<Data, Props, Instance, Options, Emit> {
  readonly $refs: {
    [key: string]:
      | NeverFallback<Instance, Vue>
      | Vue
      | Element
      | (NeverFallback<Instance, Vue> | Vue | Element)[]
      | undefined
  }
}
```

`child` 不是声明的成员，所以 `this.$refs.child` 是索引访问，只能指向索引签名本身；
再往下的 `.focusIt` 在联合类型上不存在，所以 `any` + 空结果。

Vue 官方对这件事的态度见 [vuejs/core#6197](https://github.com/vuejs/core/issues/6197)
（closed）：`$refs` 就是宽类型，官方不打算让它更窄。

### 3.2 TypeScript 的接口合并无法覆盖已有属性

尝试用声明合并把精确类型补上（`src/refs-experiment.d.ts`，5 种写法都试过）：

```ts
import ChildButton from './components/ChildButton.vue'

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
```

实测（`node experiments/refs-dts-merge.js`）：

```
=== 0 baseline (no merge)
  this.$refs.child        → definition: 1 target(s) → vue.d.ts:67
  $refs type contains member "child"? NO (still the index signature)
  this.$refs.child.focusIt → definition: [] (nothing to jump to)

=== 1 vue/types/vue + full generics
  this.$refs.child        → definition: 2 target(s) → refs-experiment.d.ts:11, vue.d.ts:67
  $refs type contains member "child"? NO (still the index signature)
  this.$refs.child.focusIt → definition: [] (nothing to jump to)

=== 2 vue/types/vue + no generics        → 同上
=== 3 module "vue" (re-export, wrong place) → 合并完全无效
=== 4 index signature + member           → 同上
```

也就是说：**合并被接受了**（多了声明位置），但 `$refs` 的类型没变，
`.focusIt` 依然是 `any`。`semanticDiagnostics` 也没有报错。

纯 TypeScript 对照实验（与 Vue 完全无关，`experiments/tsexp/`）：

```ts
// types.d.ts
interface Foo { bar: { [key: string]: number } }
// merge.d.ts
interface Foo { bar: { child: string } }
// use.ts
declare const f: Foo
f.bar.child   // → any, definition: []
```

**结论：这是 TypeScript 接口合并的通用限制 —— 同名属性以先声明者的类型为准，
后声明的类型既覆盖不了它，也不会合并成员。**

### 3.3 `inferTemplateDollarRefs` 只覆盖模板

`jsconfig.json` 里开启：

```json
"vueCompilerOptions": { "target": 2.7, "inferTemplateDollarRefs": true }
```

实测：

| 位置 | 开启后 |
| --- | --- |
| 模板里 `{{ $refs.child }}` | ✅ 精确：`$refs: { child: NonNullable<Vue3Instance<...>> \| null }` |
| script 里 `this.$refs.child` | ❌ 仍是索引签名 |

源码依据：`@vue/language-core/lib/codegen/template/index.js:41` 只在模板代码生成时
注入 `$refs`；Options API 的 `this` 来自 Vue 类型定义，不经过这里。

## 4. 为什么 WebStorm 能跳 / How WebStorm does it

WebStorm 不是"跳转时特判"，而是**把 `$refs` 的类型对象整个替换掉**。它有自己的
JS 类型引擎（`JSTypeBaseImpl` + `replaceStandardProperty`），所以能覆盖声明。

挂载点：
`vuejs/vuejs-backend/src/org/jetbrains/vuejs/model/VueInstanceOwner.kt:147`

```kotlin
replaceStandardProperty(INSTANCE_REFS_PROP, instanceOwner, ::buildRefsType, result)
```

实现：`vuejs/vuejs-backend/src/org/jetbrains/vuejs/types/VueRefsType.kt`（全文 88 行，
核心 30 行，Apache 2.0）：

```kotlin
override fun substituteImpl(context: JSTypeSubstitutionContext): JSType {
    val members: MutableMap<String, JSRecordType.TypeMember> = mutableMapOf()
    (instanceOwner as? VueComponent)?.template?.safeVisitTags { tag ->
        (findAttribute(tag, REF_ATTRIBUTE_NAME) as? VueRefAttribute)
            ?.implicitElement
            ?.let {
                // For multiple elements with the same ref name, the last one is taken by Vue engine
                members[it.name] = PropertySignatureImpl(it.name, it.jsType, false, true, it)
            }
    }
    getDefaultVueComponentInstanceType(instanceOwner.source)
        ?.asRecordType()
        ?.findPropertySignature(INSTANCE_REFS_PROP)
        ?.jsType
        ?.asRecordType()
        ?.findIndexer(JSRecordType.IndexSignatureKind.STRING)
        ?.let { members[""] = it }   // 保留索引签名兜底
    return JSSimpleRecordTypeImpl(source, members.values.toList())
}
```

- 仓库：<https://github.com/JetBrains/intellij-plugins>
- 路径：`vuejs/vuejs-backend/src/org/jetbrains/vuejs/types/VueRefsType.kt`
- 挂载点：`vuejs/vuejs-backend/src/org/jetbrains/vuejs/model/VueInstanceOwner.kt` 第 147 行
- 许可：Apache 2.0

因为替换的是**类型**，所以 `.focusIt`、补全、Find Usages、重命名全都自动生效 ——
不是只修了跳转。

## 5. 其他编辑器 / Other editors

| 编辑器 | Vue 支持方式 | `$refs` 跳转 |
| --- | --- | --- |
| WebStorm | 自研 JS 类型引擎 | ✅ |
| OpenIDEA | 转发 VLS + vtsls（`crates/ide-sdk/src/vue.rs`，10.6 KB） | ❌ |
| Zed | 转发 `@vue/language-server` + `@vue/typescript-plugin`（`zed-extensions/vue/src/vue.rs`，9.8 KB，只做安装和 completion 映射） | ❌ |
| VS Code | Volar 扩展 | ❌ |

Zed 方面没有相关 issue（搜 `$refs` 无结果），但连模板变量跳转
（`zed-extensions/vue#16`，`{{ test }}` 按 F12 无反应）至今仍 open。

**这不是 OpenIDEA 独有，但也不是无解** —— WebStorm 证明了 IDE 层可以做。

## 6. 已排除的方案 / Ruled out

| 方案 | 结果 |
| --- | --- |
| `jsconfig` 加 `inferTemplateDollarRefs` | 只对模板内 `$refs` 有效，`this.$refs` 无效 |
| `declare module 'vue/types/vue'` 声明合并 | 合并被接受，类型不变（见第 3.2 节） |
| 改 `@vue/language-core` | 类型来自 `vue.d.ts`，Volar 只在模板注入，改这里也没用 |
| 给 Volar 提 issue | `$refs` 宽类型是 Vue 官方既定设计（core#6197） |
| 写 OpenIDEA 插件 | 插件 `providers.definition` 只能返回 location，拿不到类型，做不到与类型系统一致 |

## 7. 文件 / Files

```
src/
├─ App.vue                       # 复现：this.$refs.child / .focusIt()
├─ components/ChildButton.vue    # methods.focusIt()
└─ global-components.d.ts        # 全局组件用例（Vue.component 注册）

experiments/
├─ refs-dts-merge.js             # 5 种声明合并写法的实测
└─ tsexp/                        # 纯 TypeScript 反证（与 Vue 无关）

jsconfig.json                    # strictFunctionTypes + inferTemplateDollarRefs
tsserver-probe.js                # 直接问 tsserver：definition / quickinfo
diagnostics-check.js             # syntactic / semantic diagnostics
compile-check.js                 # vue-template-compiler 校验 SFC
```

## 8. 运行 / Run

```bash
npm install

# PowerShell
$env:TS_LIB = "<path>/node_modules/typescript/lib"

node tsserver-probe.js . node_modules 'this.$refs.child' '$refs'
node tsserver-probe.js . node_modules 'this.$refs.child.focusIt' focusIt
node experiments/refs-dts-merge.js

# 纯 TypeScript 反证
node tsserver-probe.js experiments/tsexp node_modules "f.bar.child" child experiments/tsexp/use.ts
```

## 9. 历史 / History

本仓库最初用于复现另一个问题（已修复，见 commit `fba804f`）：
**组件 import 省略 `.vue` 后缀**会导致组件变 `any`，进而整个 `this` 降级为 `any`，
模板里所有 `@event` 都失去跳转。修法是补上 `.vue` 后缀。

This repository was originally a repro for another (now fixed) issue: importing a
component **without the `.vue` extension** makes the component `any`, which
degrades the whole `this` type, and every `@event` handler in the template stops
navigating. Fix: add the `.vue` extension.

---

I really like OpenIDEA — it is fast and the IntelliJ keymap feels like home.
