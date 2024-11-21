<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { DEFAULT_RULES, DEFAULT_TIME_CLASS, DEFAULT_INCLUDE_UNRATED } from '@/stores/gamesStore'

const router = useRouter()

const date = ref(new Date().toISOString())
const nick = ref(localStorage.getItem('lastNick') || '')
const timeClass = ref(localStorage.getItem('lastTimeClass') || DEFAULT_TIME_CLASS)
const rules = ref(localStorage.getItem('lastRules') || DEFAULT_RULES)
const includeUnrated = ref(localStorage.getItem('lastIncludeUnrated') || DEFAULT_INCLUDE_UNRATED)

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
      timeClass: timeClass.value,
      rules: rules.value,
      includeUnrated: includeUnrated.value.toString()
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
    <input type="text" v-model="nick" @keyup.enter="goToComputedUrl" />
    <hr />
    <input type="radio" v-model="timeClass" value="auto" /> auto <br />
    <input type="radio" v-model="timeClass" value="rapid" /> rapid <br />
    <input type="radio" v-model="timeClass" value="blitz" /> blitz <br />
    <input type="radio" v-model="timeClass" value="bullet" /> bullet
    <hr />
    <input type="radio" v-model="rules" value="auto" /> auto <br />
    <input type="radio" v-model="rules" value="chess" /> chess <br />
    <input type="radio" v-model="rules" value="chess960" /> chess960 <br />
    <input type="radio" v-model="rules" value="crazyhouse" /> crazyhouse <br />
    <input type="radio" v-model="rules" value="bughouse" /> bughouse <br />
    <input type="radio" v-model="rules" value="kingofthehill" /> kingofthehill <br />
    <input type="radio" v-model="rules" value="oddschess" /> oddschess <br />
    <hr />
    <input type="checkbox" v-model="includeUnrated" /> include unrated <br />
    <hr />
    <VueDatePicker v-model="date" time-picker-inline inline auto-apply utc />
    <hr />

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
