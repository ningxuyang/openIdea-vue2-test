<template>
  <button @click="$emit('my-event')">child button</button>
</template>

<script>
export default {
  name: 'ChildButton',
  // Vue 2.7 从 Vue 3 回移的 emits 声明：声明后 @click 会被当作组件事件 prop
  emits: ['click', 'my-event']
}
</script>
