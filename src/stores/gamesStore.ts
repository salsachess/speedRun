import axios from 'axios'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { parse as pgnParse, type ParseTree } from '@mliebelt/pgn-parser'
import { buildLichessUrl, parseLichessNdjson } from '@/utils/lichess'
export const DEFAULT_PLATFORM = 'auto'
export const DEFAULT_TIME_CLASS = 'auto'
export const DEFAULT_RULES = 'auto'
export const DEFAULT_INCLUDE_UNRATED = true

export const PLATFORM_CHESSCOM = 'chesscom'
export const PLATFORM_LICHESS = 'lichess'

// Rate‑limit handling for Lichess API (max 1 request per minute)
let lastLichessRequestTime = 0;
async function ensureLichessRateLimit() {
  const now = Date.now();
  const elapsed = now - lastLichessRequestTime;
  if (elapsed < 60000) {
    await new Promise((resolve) => setTimeout(resolve, 60000 - elapsed));
  }
  lastLichessRequestTime = Date.now();
}

export const RULE_BUGHOUSE = 'bughouse'

const GAME_RESULT_WIN = 'win'

interface PgnTagsType {
  UTCDate: { value: string }
  StartTime: string
  EndDate: string
  EndTime: string
}

const getDurationFromPgn = (pgnString: string) => {
  try {
    const pgnStringOnlyTags = pgnString
      .split('\n')
      .filter((line) => line.startsWith('['))
      .join('\n')

    const pgn = pgnParse(pgnStringOnlyTags, { startRule: 'tags' }) as ParseTree

    const tags = pgn.tags as unknown as PgnTagsType

    const tUTCDate = tags.UTCDate.value
    const tUTCTime = tags.StartTime
    const tEndDate = tags.EndDate
    const tEndTime = tags.EndTime

    const startDateString = tUTCDate + ' ' + tUTCTime
    const tStart = new Date(startDateString.replace(/\./g, '-'))

    const endDateString = tEndDate + ' ' + tEndTime
    const tEnd = new Date(endDateString.replace(/\./g, '-'))

    if (
      !(tStart instanceof Date) ||
      !(tEnd instanceof Date) ||
      isNaN(tStart.getTime()) ||
      isNaN(tEnd.getTime())
    ) {
      return 0
    }

    const duration = Math.round(tEnd.getTime() / 1000) - Math.round(tStart.getTime() / 1000)

    if (isNaN(duration) || duration < 0) {
      return 0
    }

    return duration
  } catch (_e) {
    return 0
  }
}

export function normalizeRules(rule: string): string {
  if (!rule) return 'chess'
  const lower = rule.toLowerCase()
  if (lower === 'standard') return 'chess'
  if (lower === 'kingofthehill') return 'kingofthehill'
  if (lower === 'threecheck') return 'threecheck'
  if (lower === 'racingkings') return 'racingkings'
  return lower
}

export function normalizeTimeClass(tc: string): string {
  if (!tc) return 'blitz'
  const lower = tc.toLowerCase()
  if (lower === 'ultrabullet') return 'ultraBullet'
  return lower
}

interface PlayerType {
  rating: number
  result: string
  '@id': string
  username: string
  uuid: string
}

export interface GameType {
  url: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  tcn?: string
  uuid?: string
  initial_setup?: string
  fen?: string
  time_class: string
  rules: string
  platform: string
  white: PlayerType
  black: PlayerType
  computedDuration?: number
}

export interface GamesDataType {
  win: number
  count: number
  draw: number
  duration: number
  graphData: { x: number; y: number }[]
  effectiveTimeClass: string
  effectiveRules: string
  effectivePlatform: string
}

export const useGamesStore = defineStore('games', () => {
  const games = ref<GameType[]>([])
  const activePlatform = ref<string>(DEFAULT_PLATFORM)

  interface PerGameAnalysisType {
    rating: number
    win: number
    draw: number
    duration: number
  }

  const analysisCache = ref<Record<string, PerGameAnalysisType>>({})
  const updateCache = ref<Record<string, string>>({})

  async function fetchChessComGames(nick: string, year: number, month: number): Promise<GameType[]> {
    try {
      const response = await axios.get(
        `https://api.chess.com/pub/player/${nick}/games/${year}/${month < 10 ? '0' + month : month}`,
        {
          timeout: 10000
        }
      )

      const rawGames = response?.data?.games ?? []

      if (!Array.isArray(rawGames)) {
        return []
      }

      return rawGames
        .filter((game) => game && typeof game === 'object' && game.url)
        .map((game) => ({
          ...game,
          platform: PLATFORM_CHESSCOM,
          rules: normalizeRules(game.rules || 'chess'),
          time_class: normalizeTimeClass(game.time_class || 'blitz')
        }))
    } catch (error) {
      console.error(`Failed to fetch Chess.com games for ${nick} (${year}-${month}):`, error)
      return []
    }
  }

  async function fetchLichessGames(nick: string, startDate: Date, includeUnrated: boolean, max: number = 500): Promise<GameType[]> {
    try {
      const url = buildLichessUrl(nick, {
        since: startDate.getTime(),
        max,
        pgnInJson: true,
        ...(includeUnrated ? {} : { rated: 'true' })
      })
      await ensureLichessRateLimit();
      // Lichess public export API does not require authentication.
      const response = await axios.get(url, {
        headers: {
          Accept: 'application/x-ndjson'
        },
        responseType: 'text',
        timeout: 15000
      })
      if (!response.data || typeof response.data !== 'string') {
        return []
      }
      const games = parseLichessNdjson(response.data)
      return games
    } catch (error: any) {
      // If rate limited, wait and retry once
      if (error && error.response && error.response.status === 429) {
        console.warn('Lichess API rate limit reached, waiting 60 seconds before retry');
        await new Promise((resolve) => setTimeout(resolve, 60000));
        try {
          const url = buildLichessUrl(nick, {
            since: startDate.getTime(),
            max,
            pgnInJson: true,
            ...(includeUnrated ? {} : { rated: 'true' })
          })
          const retryResp = await axios.get(url, {
            headers: {
              Accept: 'application/x-ndjson'
            },
            responseType: 'text',
            timeout: 15000
          });
          if (retryResp.data && typeof retryResp.data === 'string') {
            return parseLichessNdjson(retryResp.data);
          }
        } catch (retryErr) {
          console.error('Retry after rate limit also failed:', retryErr);
        }
      }
      console.error(`Failed to fetch Lichess games for ${nick}:`, error);
      // Fallback to older endpoint without since filter
      try {
        const fallbackUrl = buildLichessUrl(nick, {
          max,
          pgnInJson: true,
          ...(includeUnrated ? {} : { rated: 'true' })
        });
        const fallbackResp = await axios.get(fallbackUrl, {
          headers: { Accept: 'application/x-ndjson' },
          responseType: 'text',
          timeout: 15000
        });
        if (fallbackResp.data && typeof fallbackResp.data === 'string') {
          return parseLichessNdjson(fallbackResp.data);
        }
      } catch (fallbackErr) {
        console.error('Fallback Lichess fetch also failed:', fallbackErr);
      }
      return [];
    }
  }

  async function detectLatestPlatform(nick: string): Promise<string> {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    let chessComLatestTime = 0
    let lichessLatestTime = 0

    // Fetch latest Chess.com game from current month (or previous month if none)
    try {
      let chessComGames = await fetchChessComGames(nick, currentYear, currentMonth)
      if (chessComGames.length === 0 && currentMonth > 1) {
        chessComGames = await fetchChessComGames(nick, currentYear, currentMonth - 1)
      } else if (chessComGames.length === 0 && currentMonth === 1) {
        chessComGames = await fetchChessComGames(nick, currentYear - 1, 12)
      }
      if (chessComGames.length > 0) {
        chessComLatestTime = Math.max(...chessComGames.map((g) => g.end_time))
      }
    } catch (e) {
      console.error('Failed to fetch recent Chess.com game for detection:', e)
    }

    // Fetch latest Lichess game
    try {
      try {
        const recentGames = await fetchLichessGames(nick, new Date(0), true, 1)
        if (recentGames.length > 0) {
          const first = recentGames[0]
          lichessLatestTime = first.end_time || 0
        }
      } catch (e) {
        console.error('Failed to fetch recent Lichess game for detection:', e)
      }
    } catch (e) {
      console.error('Failed to fetch recent Lichess game for detection:', e)
    }

    console.debug(`Platform detection for ${nick}: Chess.com latest timestamp=${chessComLatestTime}, Lichess latest timestamp=${lichessLatestTime}`)

    if (lichessLatestTime > chessComLatestTime) {
      return PLATFORM_LICHESS
    }
    return PLATFORM_CHESSCOM
  }

  function filterRatedGamesAndByStartDate(
    games: GameType[],
    startDate: Date,
    includeUnrated: boolean
  ) {
    return games
      .filter((game) => game && typeof game === 'object')
      .filter((game) => (includeUnrated ? true : game.rated))
      .filter((game) => game.end_time >= startDate.getTime() / 1000)
  }

  async function getAllGames(
    nick: string,
    startDate: Date,
    includeUnrated: boolean,
    platform: string = DEFAULT_PLATFORM
  ) {
    console.debug(`Starting getAllGames for ${nick} from ${startDate.toDateString()}, platform=${platform}`)
    clearGames()

    let resolvedPlatform = platform
    if (!resolvedPlatform || resolvedPlatform === DEFAULT_PLATFORM) {
      resolvedPlatform = await detectLatestPlatform(nick)
    }
    activePlatform.value = resolvedPlatform

    let allGames: GameType[] = []

    if (resolvedPlatform === PLATFORM_LICHESS) {
      allGames = await fetchLichessGames(nick, startDate, includeUnrated)
    } else {
      const startYear = startDate.getFullYear()
      const startMonth = startDate.getMonth() + 1

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      for (let year = startYear; year <= currentYear; year += 1) {
        for (
          let month = startYear === year ? startMonth : 1;
          month <= (year === currentYear ? currentMonth : 12);
          month += 1
        ) {
          const gamesForAMonth = await fetchChessComGames(nick, year, month)
          allGames.push(...gamesForAMonth)
        }
      }
    }

    allGames.forEach((game) => {
      updateCache.value[game.url] = JSON.stringify(game)
    })

    games.value = filterRatedGamesAndByStartDate(allGames, startDate, includeUnrated)

    console.debug(
      `getAllGames completed for platform ${resolvedPlatform}: loaded ${allGames.length} total games, filtered to ${games.value.length} games`
    )
  }

  async function updateGames(
    nick: string,
    startDate: Date,
    includeUnrated: boolean,
    platform: string = DEFAULT_PLATFORM
  ) {
    let resolvedPlatform = platform
    if (!resolvedPlatform || resolvedPlatform === DEFAULT_PLATFORM) {
      resolvedPlatform = activePlatform.value !== DEFAULT_PLATFORM ? activePlatform.value : PLATFORM_CHESSCOM
    }

    let newGames: GameType[] = []
    if (resolvedPlatform === PLATFORM_LICHESS) {
      newGames = await fetchLichessGames(nick, startDate, includeUnrated)
    } else {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      newGames = await fetchChessComGames(nick, currentYear, currentMonth)
    }

    if (!newGames.length) {
      return false
    }

    newGames = filterRatedGamesAndByStartDate(newGames, startDate, includeUnrated)
    let areThereNewGames = false

    newGames.forEach((game: GameType) => {
      const gameJsonString = JSON.stringify(game)
      const cachedGameString = updateCache.value[game.url]

      const existingGameIndex = games.value.findIndex(
        (existingGame) => existingGame.url === game.url
      )

      if (existingGameIndex !== -1) {
        if (cachedGameString && cachedGameString !== gameJsonString) {
          games.value[existingGameIndex] = game
          updateCache.value[game.url] = gameJsonString
          areThereNewGames = true
        }
      } else {
        games.value.push(game)
        updateCache.value[game.url] = gameJsonString
        areThereNewGames = true
      }
    })

    return areThereNewGames
  }

  function analyzeGames(nick: string, timeClass: string, rules: string) {
    let allGames = games.value

    const effectivePlatform = activePlatform.value || PLATFORM_CHESSCOM

    if (allGames.length === 0) {
      console.debug(`No games found for analysis: ${nick}, ${timeClass}, ${rules}`)
      return {
        win: 0,
        count: 0,
        draw: 0,
        duration: 0,
        graphData: [],
        effectiveTimeClass: timeClass,
        effectiveRules: rules,
        effectivePlatform
      }
    }

    const reqRulesNormalized = rules !== DEFAULT_RULES ? normalizeRules(rules) : DEFAULT_RULES
    const reqTimeClassNormalized = timeClass !== DEFAULT_TIME_CLASS ? normalizeTimeClass(timeClass) : DEFAULT_TIME_CLASS

    if (reqRulesNormalized !== DEFAULT_RULES) {
      allGames = allGames.filter((game: GameType) => normalizeRules(game.rules) === reqRulesNormalized)
    }

    if (reqTimeClassNormalized !== DEFAULT_TIME_CLASS) {
      allGames = allGames.filter(
        (game: GameType) => normalizeTimeClass(game.time_class) === reqTimeClassNormalized
      )
    }

    if (allGames.length === 0) {
      return {
        win: 0,
        count: 0,
        draw: 0,
        duration: 0,
        graphData: [],
        effectiveTimeClass: timeClass,
        effectiveRules: rules,
        effectivePlatform
      }
    }

    const allGamesSorted = [...allGames].sort((a, b) => a.end_time - b.end_time)

    let effectiveTimeClass = timeClass
    if (effectiveTimeClass === DEFAULT_TIME_CLASS) {
      const lastGame = allGamesSorted[allGamesSorted.length - 1]
      effectiveTimeClass = lastGame?.time_class || DEFAULT_TIME_CLASS
    }

    let effectiveRules = rules
    if (effectiveRules === DEFAULT_RULES) {
      const lastGame = allGamesSorted[allGamesSorted.length - 1]
      effectiveRules = lastGame?.rules || DEFAULT_RULES
    }

    const effRulesNormalized = normalizeRules(effectiveRules)
    const effTimeClassNormalized = normalizeTimeClass(effectiveTimeClass)

    const filteredGames: GameType[] = allGamesSorted
      .filter((game: GameType) => normalizeTimeClass(game.time_class) === effTimeClassNormalized)
      .filter((game: GameType) => normalizeRules(game.rules) === effRulesNormalized)

    const initialAcc: GamesDataType = {
      win: 0,
      count: 0,
      draw: 0,
      duration: 0,
      graphData: [],
      effectiveTimeClass,
      effectiveRules,
      effectivePlatform
    }

    const gamesData = filteredGames.reduce((acc, game) => {
      const cacheKey = `${game.url}:${nick}`
      let per = analysisCache.value[cacheKey]

      if (!per) {
        const nickLowerCased = nick.toLowerCase()
        let rating: number | undefined
        let win = 0
        let draw = 0

        if (game.white.username.toLowerCase() === nickLowerCased) {
          rating = game.white.rating
          win = game.white.result === GAME_RESULT_WIN ? 1 : 0
        } else if (game.black.username.toLowerCase() === nickLowerCased) {
          rating = game.black.rating
          win = game.black.result === GAME_RESULT_WIN ? 1 : 0
        } else {
          return acc
        }

        if (game.white.result === game.black.result) {
          draw = 1
        }

        let duration = 0
        if (game.computedDuration !== undefined) {
          duration = game.computedDuration
        } else {
          duration = game.rules === RULE_BUGHOUSE ? +game.time_control : getDurationFromPgn(game.pgn)
        }

        per = { rating, win, draw, duration }
        analysisCache.value[cacheKey] = per
      }

      acc.graphData.push({ x: acc.duration, y: per.rating })
      acc.win += per.win
      acc.count += 1
      acc.draw += per.draw
      acc.duration += per.duration

      return acc
    }, initialAcc)

    return gamesData
  }

  function clearCache() {
    analysisCache.value = {}
    updateCache.value = {}
  }

  function clearAnalysisCacheForParams(nick: string) {
    Object.keys(analysisCache.value).forEach((key) => {
      const [, cachedNick] = key.split(':')
      if (cachedNick === nick) {
        delete analysisCache.value[key]
      }
    })
  }

  function clearGames() {
    games.value = []
    activePlatform.value = DEFAULT_PLATFORM
    clearCache()
  }

  return {
    games,
    activePlatform,
    getAllGames,
    updateGames,
    analyzeGames,
    clearCache,
    clearAnalysisCacheForParams,
    clearGames
  }
})
