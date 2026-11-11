<template>
  <div>
    <button @click="handler">native click</button>

    <!-- import 没写 .vue 后缀 -->
    <child-button @my-event="handler" />

    <span>{{ count }}</span>
  </div>
</template>

<script>
// 故意不写 .vue 后缀
import ChildButton from './components/ChildButton'

export default {
  name: 'App',
  components: { ChildButton },
  data() {
    return { count: 0 }
  },
  methods: {
    myConsole() { console.log('inner') },
    handler() {
      this.myConsole()
      console.log('clicked')
    }
  }
}
</script>
