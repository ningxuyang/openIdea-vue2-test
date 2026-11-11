<template>
  <div>
    <!-- A. 原生元素事件 -->
    <button @click="handler">native click</button>

    <!-- B. 相对路径 import 的组件事件 -->
    <rel-button @my-event="handler" />

    <!-- C. @ 别名 import 的组件事件（模拟真实项目） -->
    <alias-button @my-event="handler" />

    <!-- D. 模板表达式 -->
    <span>{{ count }}</span>
  </div>
</template>

<script>
import Vue from 'vue'
import RelButton from './components/ChildButton.vue'
import AliasButton from '@/components/ChildButton.vue'

export default {
  name: 'App',
  components: { RelButton, AliasButton },
  data() {
    return { count: 0 }
  },
  methods: {
    myConsole() { console.log('inner') },
    handler() {
      this.myConsole()
      console.log('clicked', Vue.version)
    }
  }
}
</script>
