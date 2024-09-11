import axios from 'axios'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { parse as pgnParse, type ParseTree } from '@mliebelt/pgn-parser'

const CORRECT_GAME_RULES = 'chess'
const GAME_RESULT_WIN = 'win'

interface PgnTagsType {
  UTCDate: { value: string }
  StartTime: string
  EndDate: string
  EndTime: string
}

const getDurationFromPgn = (pgnString: string) => {
  try {
    const pgn = pgnParse(pgnString, { startRule: 'game' }) as ParseTree

    const tags = pgn.tags as unknown as PgnTagsType

    const tUTCDate = tags.UTCDate.value
    const tUTCTime = tags.StartTime
    const tEndDate = tags.EndDate
    const tEndTime = tags.EndTime

    const startDateString = tUTCDate + ' ' + tUTCTime
    const tStart = new Date(startDateString.replace(/\./g, '-'))

    const endDateString = tEndDate + ' ' + tEndTime
    const tEnd = new Date(endDateString.replace(/\./g, '-'))

    const duration = Math.round(tEnd.getTime() / 1000) - Math.round(tStart.getTime() / 1000)

    if (isNaN(duration)) {
      console.log('Duration is NaN for pgn: ' + pgnString)

      return 0
    }

    return duration
  } catch (e) {
    console.log('Failed to parse pgn: ' + pgnString)

    return 0
  }
}

interface PlayerType {
  rating: number
  result: string
  '@id': string
  username: string
  uuid: string
}

interface GameType {
  url: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  tcn: string
  uuid: string
  initial_setup: string
  fen: string
  time_class: string
  rules: string
  white: PlayerType
  black: PlayerType
}

export interface GamesDataType {
  win: number
  count: number
  draw: number
  duration: number
  graphData: { x: number; y: number }[]
  effectiveTimeClass: string
}

export const useGamesStore = defineStore('games', () => {
  const games = ref<GameType[]>([])
  const analysisCache = ref<Record<string, GamesDataType>>({})
  const updateCache = ref<Record<string, boolean>>({})

  async function fetchGames(nick: string, year: number, month: number) {
    try {
      const response = await axios.get(
        `https://api.chess.com/pub/player/${nick}/games/${year}/${month < 10 ? '0' + month : month}`
      )

      return response?.data?.games ?? []
    } catch (error) {
      console.error(`Failed to fetch games for ${nick} (${year}-${month}):`, error)
      return [] // Return an empty array instead of throwing
    }
  }

  async function getAllGames(nick: string, startDate: Date) {
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const allGames = []
    let year
    let month
    for (year = startYear; year <= currentYear; year += 1) {
      for (
        month = startYear === year ? startMonth : 1;
        month <= (year === currentYear ? currentMonth : 12);
        month += 1
      ) {
        const gamesForAMonth = await fetchGames(nick, year, month)

        allGames.push(...gamesForAMonth)
      }
    }

    allGames.forEach((game) => {
      updateCache.value[game.url] = true
    })

    games.value = allGames.filter((game) => game.end_time >= startDate.getTime() / 1000)
  }

  async function updateGames(nick: string, startDate: Date) {
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1

    let newGames = await fetchGames(nick, currentYear, currentMonth)

    newGames = newGames.filter((game: GameType) => game.end_time >= startDate.getTime() / 1000)
    let areThereNewGames = false
    newGames.forEach((game: GameType) => {
      if (updateCache.value[game.url]) {
        return
      }

      games.value.push(game)
      updateCache.value[game.url] = true
      console.log(game)

      areThereNewGames = true
    })

    console.log(games.value.length)

    return areThereNewGames
  }

  function analyzeGames(timeClass: string, nick: string) {
    const allGames = games.value
    if (allGames.length === 0) {
      return {
        win: 0,
        count: 0,
        draw: 0,
        duration: 0,
        graphData: [],
        effectiveTimeClass: timeClass
      }
    }

    let effectiveTimeClass = timeClass
    if (effectiveTimeClass === 'auto') {
      const lastGame = allGames[allGames.length - 1]

      effectiveTimeClass = lastGame.time_class
    }

    const filteredGames: GameType[] = allGames.filter(
      (game: GameType) => game.time_class === effectiveTimeClass
    )

    const addResultAndReturnAcc = (acc: GamesDataType, gameData: GamesDataType) => {
      acc.win += gameData.win
      acc.count += gameData.count
      acc.draw += gameData.draw
      acc.duration += gameData.duration
      acc.graphData = [...acc.graphData, ...gameData.graphData]

      return acc
    }

    const gamesData = filteredGames.reduce(
      (acc, game) => {
        if (game.rules !== CORRECT_GAME_RULES) {
          return acc
        }

        const cachedResult = analysisCache.value[game.url]
        if (cachedResult) {
          return addResultAndReturnAcc(acc, cachedResult)
        }

        const gameData: GamesDataType = {
          win: 0,
          count: 1,
          draw: 0,
          duration: 0,
          graphData: [],
          effectiveTimeClass
        }

        let rating

        const nickLowerCased = nick.toLowerCase()
        if (game.white.username.toLowerCase() === nickLowerCased) {
          rating = game.white.rating
          gameData.win += game.white.result === GAME_RESULT_WIN ? 1 : 0
        } else if (game.black.username.toLowerCase() === nickLowerCased) {
          rating = game.black.rating
          gameData.win += game.black.result === GAME_RESULT_WIN ? 1 : 0
        } else {
          return acc
        }

        if (game.white.result === game.black.result) {
          gameData.draw += 1
        }

        gameData.duration = getDurationFromPgn(game.pgn)

        gameData.graphData = [{ x: acc.duration, y: rating }]

        if (analysisCache.value) {
          analysisCache.value[game.url] = gameData
        }

        return addResultAndReturnAcc(acc, gameData)
      },
      {
        win: 0,
        count: 0,
        draw: 0,
        duration: 0,
        graphData: [],
        effectiveTimeClass
      } as GamesDataType
    )

    return gamesData
  }

  return { games, getAllGames, updateGames, analyzeGames }
})
