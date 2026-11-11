<template>
  <button @click="$emit('my-event')">child button</button>
</template>

<script>
export default {
  name: 'ChildButton'
}
</script>
