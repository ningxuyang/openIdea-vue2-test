<template>
  <div>
    <!-- A. 原生元素事件：能跳到 handler（对照组） -->
    <button @click="handler">native click</button>

    <!-- B. 局部注册组件事件：能跳到 handler（对照组） -->
    <child-button @my-event="handler" @another-event="myConsole" />

    <!-- C. 全局注册组件事件：复现问题（不跳） -->
    <global-button @my-event="handler" @another-event="myConsole" />

    <!-- D. 模板表达式：能跳到 data.count（对照组） -->
    <span>{{ count }}</span>
  </div>
</template>

<script>
import Vue from 'vue'
import ChildButton from './components/ChildButton.vue'

export default {
  name: 'App',
  components: { ChildButton },
  data() {
    return { count: 0 }
  },
  methods: {
    myConsole() {
      console.log('inner')
    },
    handler() {
      this.myConsole()
      console.log('clicked', Vue.version)
    }
  }
}
</script>
