<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGamesStore, type GamesDataType } from '@/stores/gamesStore'

const DEFAULT_TIME_CLASS = 'auto'
const UPDATE_GAMES_INTERVAL = 1000

const props = defineProps<{
  startTs: number | null
  nick: string | null
  timeClass: string | null
}>()

const router = useRouter()
const gamesStore = useGamesStore()

const currentTimeClass = ref(props.timeClass ?? DEFAULT_TIME_CLASS)
const currentNick = ref(props.nick ?? '')
const currentStartTs = ref(props.startTs ? new Date(props.startTs) : new Date())

onMounted(() => {
  if (!currentNick.value) {
    router.push({ name: 'config' })

    return
  }

  initPage()
  localStorage.setItem('lastNick', currentNick.value)
})

const loading = ref(true)
const initPage = async () => {
  await gamesStore.getAllGames(currentNick.value, currentStartTs.value)
  loading.value = false

  await nextTick()

  updateGames()
}

let firstUpdate = true
const updateGames = async () => {
  const updateAndScheduleNext = async () => {
    const areThereNewGames = await gamesStore.updateGames(currentNick.value, currentStartTs.value)
    if (areThereNewGames || firstUpdate) {
      const allGamesData = gamesStore.analyzeGames(currentTimeClass.value, currentNick.value)

      prepareGamesDataForVisualization(allGamesData)

      firstUpdate = false
    }

    setTimeout(updateAndScheduleNext, UPDATE_GAMES_INTERVAL)
  }

  updateAndScheduleNext()
}

const getTimeString = (secondsTotal: number) => {
  const hours = Math.floor(secondsTotal / 3600)
  const minutes = Math.floor((secondsTotal - hours * 3600) / 60)
  const seconds = Math.floor(secondsTotal - hours * 3600 - minutes * 60)

  return [hours, minutes, seconds].map((val) => val.toString().padStart(2, '0')).join(':')
}

const prepareGamesDataForVisualization = (allGamesData: GamesDataType) => {
  effectiveTimeClass.value = allGamesData.effectiveTimeClass

  const loss = allGamesData.count - allGamesData.win - allGamesData.draw
  resultText.value = '+' + allGamesData.win + ' -' + loss + ' =' + allGamesData.draw

  gamesTimeString.value = getTimeString(allGamesData.duration)

  if (allGamesData.graphData.length === 0) {
    return
  }

  const data = () => {
    return [
      {
        values: allGamesData.graphData,
        key: 'rating',
        color: '#ff0000'
      }
    ]
  }

  if (!chartData.value) {
    nv.addGraph(() => {
      chart.value = nv.models.lineChart().showLegend(false)

      chart.value.xAxis.axisLabel('Time').tickFormat((d: number) => getTimeString(d))

      chart.value.yAxis.axisLabel('rating')

      chartData.value = d3.select('#chart svg').datum(data())
      chartData.value.transition().duration(500).call(chart.value)

      nv.utils.windowResize(chart.value.update)

      return chart.value
    })
  } else if (graphDataLengthOld.value !== allGamesData.graphData.length) {
    chartData.value.datum(data()).transition().duration(500).call(chart.value)
    nv.utils.windowResize(chart.value.update)
    graphDataLengthOld.value = allGamesData.graphData.length
  }
}

const resultText = ref('-')
const gamesTimeString = ref('-')
const effectiveTimeClass = ref('-')
const chart = ref<any>(null)
const chartData = ref<any>(null)
const graphDataLengthOld = ref(0)

const getFontSize = (text: string) => {
  const length = text.length

  if (length >= 16) {
    return 5
  }
  if (length >= 14) {
    return 6
  }
  if (length >= 13) {
    return 7
  }
  if (length >= 11) {
    return 8
  }

  return 9
}
</script>

<template>
  <div class="result">
    <div v-if="loading">loading...</div>
    <table v-else class="full-page-table">
      <tbody>
        <tr>
          <td class="half-width">
            <div class="text center-screen">
              <span :style="{ fontSize: getFontSize(resultText) + 'vw' }">{{ resultText }}</span>
              <span :style="{ fontSize: getFontSize(gamesTimeString) + 'vw' }">{{
                gamesTimeString
              }}</span>
            </div>
          </td>
          <td class="half-width">
            <div id="chart" class="chart-container">
              <div class="time-class-overlay" :style="{ fontSize: '15vw' }">
                {{ effectiveTimeClass }}
              </div>
              <svg></svg>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.result {
  font-family: 'Pacifico', serif;
  height: 98vh;
  width: 98vw;
}

.full-page-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
}

.half-width {
  width: 50%;
  height: 100%;
  vertical-align: top;
}

.result .text {
  font-size: 10vw;
}

.center-screen {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

#chart {
  height: 100%;
  width: 100%;
  position: relative;
}

.chart-container {
  position: relative;
}

.time-class-overlay {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: transparent;
  color: lightgray;
  padding: 5px 10px;
  border-radius: 5px;
  font-family: 'Pacifico', serif;
  pointer-events: none;
  z-index: 1;
}

#chart svg {
  position: relative;
  z-index: 2;
}

.nvd3 g.nv-groups path.nv-line {
  stroke-width: 10px;
}

.tick line {
  opacity: 0;
}
</style>
