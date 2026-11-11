import ChildButton from './components/ChildButton.vue'

// 模拟 main.js 里 Vue.component('global-button', ChildButton) 的全局注册，
// 供 Volar 识别为全局组件（vueCompilerOptions.globalTypes）。
declare module 'vue' {
  export interface GlobalComponents {
    GlobalButton: typeof ChildButton
  }
}
