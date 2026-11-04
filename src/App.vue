<template>
  <div>
    <button @click="handler">click</button>
  </div>
</template>

<script>
import Vue from 'vue'

export default {
  name: 'App',
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
