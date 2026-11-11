<template>
  <button @click="$emit('my-event')">child button</button>
</template>

<script>
import Missing from './not-exist-module'

export default {
  name: 'ChildButton',
  components: { Missing },
  emits: ['my-event']
}
</script>
