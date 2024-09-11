<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const router = useRouter()

const date = ref(new Date().toISOString())
const nick = ref(localStorage.getItem('lastNick') || '')
const timeClass = ref('auto')

const computedUrl = computed(() => {
  if (!nick.value) {
    return ''
  }

  const startTS = new Date(date.value).getTime()

  return router.resolve({
    name: 'games',
    params: {
      nick: nick.value,
      startTs: startTS.toString(),
      timeClass: timeClass.value
    }
  }).href
})

const goToComputedUrl = () => {
  if (!nick.value) {
    return
  }

  router.push(computedUrl.value)
}
</script>

<template>
  <div class="config">
    <br />
    <span :class="!nick ? 'red' : ''">nick</span>:
    <input type="text" v-model="nick" @keyup.enter="goToComputedUrl" /> <br /><br />
    <input type="radio" v-model="timeClass" value="auto" /> auto <br />
    <input type="radio" v-model="timeClass" value="rapid" /> rapid <br />
    <input type="radio" v-model="timeClass" value="blitz" /> blitz <br />
    <input type="radio" v-model="timeClass" value="bullet" /> bullet <br /><br />
    <VueDatePicker v-model="date" time-picker-inline inline auto-apply utc />
    <br /><br />

    url: <a v-if="nick" :href="computedUrl">{{ computedUrl }}</a>
    <span class="red" v-else>nick is required</span>
  </div>
</template>

<style scoped>
.config {
  margin: 10px;
}
.red {
  color: red;
}
</style>
