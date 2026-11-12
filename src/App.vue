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
      this.$refs.child
      this.$refs.child.focusIt()
    }
  }
}
</script>
