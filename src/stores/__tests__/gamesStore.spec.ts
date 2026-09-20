import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { setActivePinia, createPinia } from 'pinia'
import {
  useGamesStore,
  normalizeRules,
  normalizeTimeClass,
  DEFAULT_PLATFORM,
  PLATFORM_CHESSCOM,
  PLATFORM_LICHESS
} from '../gamesStore'

describe('gamesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('normalizes variant rules correctly', () => {
    expect(normalizeRules('standard')).toBe('chess')
    expect(normalizeRules('chess')).toBe('chess')
    expect(normalizeRules('kingOfTheHill')).toBe('kingofthehill')
    expect(normalizeRules('threeCheck')).toBe('threecheck')
    expect(normalizeRules('racingKings')).toBe('racingkings')
    expect(normalizeRules('antichess')).toBe('antichess')
    expect(normalizeRules('atomic')).toBe('atomic')
  })

  it('normalizes time classes correctly', () => {
    expect(normalizeTimeClass('bullet')).toBe('bullet')
    expect(normalizeTimeClass('blitz')).toBe('blitz')
    expect(normalizeTimeClass('ultraBullet')).toBe('ultraBullet')
    expect(normalizeTimeClass('ultrabullet')).toBe('ultraBullet')
  })

  it('initializes store with default active platform', () => {
    const store = useGamesStore()
    expect(store.activePlatform).toBe(DEFAULT_PLATFORM)
    expect(store.games).toEqual([])
  })

  it('analyzes Lichess games and calculates duration and results properly', () => {
    const store = useGamesStore()
    store.activePlatform = PLATFORM_LICHESS
    store.games = [
      {
        url: 'https://lichess.org/test1',
        pgn: '',
        time_control: '180+0',
        end_time: 1000,
        rated: true,
        time_class: 'blitz',
        rules: 'chess',
        platform: PLATFORM_LICHESS,
        white: {
          rating: 1500,
          result: 'win',
          '@id': '',
          username: 'testplayer',
          uuid: ''
        },
        black: {
          rating: 1450,
          result: 'loss',
          '@id': '',
          username: 'opponent',
          uuid: ''
        },
        computedDuration: 120
      },
      {
        url: 'https://lichess.org/test2',
        pgn: '',
        time_control: '180+0',
        end_time: 1200,
        rated: true,
        time_class: 'blitz',
        rules: 'chess',
        platform: PLATFORM_LICHESS,
        white: {
          rating: 1450,
          result: 'loss',
          '@id': '',
          username: 'opponent2',
          uuid: ''
        },
        black: {
          rating: 1510,
          result: 'win',
          '@id': '',
          username: 'testplayer',
          uuid: ''
        },
        computedDuration: 180
      }
    ]

    const stats = store.analyzeGames('testplayer', 'blitz', 'chess')
    expect(stats.count).toBe(2)
    expect(stats.win).toBe(2)
    expect(stats.draw).toBe(0)
    expect(stats.duration).toBe(300)
    expect(stats.effectivePlatform).toBe(PLATFORM_LICHESS)
    expect(stats.graphData).toEqual([
      { x: 0, y: 1500 },
      { x: 120, y: 1510 }
    ])
  })
  it("updates only the selected platform during polling", async () => {
    const store = useGamesStore()
    store.activePlatform = PLATFORM_LICHESS

    const getSpy = vi.spyOn(axios, "get").mockResolvedValue({
      data: JSON.stringify({
        id: "new-game",
        createdAt: 1000000,
        lastMoveAt: 1000120,
        rated: true,
        speed: "blitz",
        variant: "standard",
        players: {
          white: { user: { name: "testplayer" }, rating: 1500 },
          black: { user: { name: "opponent" }, rating: 1400 }
        },
        winner: "white"
      })
    } as any)

    await store.updateGames("testplayer", new Date(0), true, PLATFORM_LICHESS)

    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(getSpy.mock.calls[0]?.[0]).toContain("lichess.org")
    expect(store.games).toHaveLength(1)
    expect(store.games[0]?.platform).toBe(PLATFORM_LICHESS)
    getSpy.mockRestore()
  })
})
