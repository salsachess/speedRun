import axios from 'axios'

// Build Lichess API URL with given parameters
export function buildLichessUrl(nick: string, params: Record<string, any>): string {
  const base = `https://lichess.org/api/games/user/${encodeURIComponent(nick)}`
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return query ? `${base}?${query}` : base
}

// Parse NDJSON response from Lichess into an array of GameType objects
export function parseLichessNdjson(data: string) {
  const lines = data.split('\n').filter((l) => l.trim().length > 0)
  const games: any[] = []
  for (const line of lines) {
    try {
      const raw = JSON.parse(line)
      if (!raw || !raw.id) continue

      const createdAt = raw.createdAt ? Math.floor(raw.createdAt / 1000) : 0
      const lastMoveAt = raw.lastMoveAt ? Math.floor(raw.lastMoveAt / 1000) : createdAt
      const endTime = lastMoveAt || createdAt

      let duration = lastMoveAt && createdAt ? lastMoveAt - createdAt : 0
      if (duration <= 0 && raw.pgn) {
        // fallback: duration will be calculated later by store if needed
        duration = 0
      }

      const whiteUsername = raw.players?.white?.user?.name || raw.players?.white?.user?.id || 'White'
      const blackUsername = raw.players?.black?.user?.name || raw.players?.black?.user?.id || 'Black'

      const whiteResult = raw.winner === 'white' ? 'win' : raw.winner === 'black' ? 'loss' : 'draw'
      const blackResult = raw.winner === 'black' ? 'win' : raw.winner === 'white' ? 'loss' : 'draw'

      games.push({
        url: `https://lichess.org/${raw.id}`,
        pgn: raw.pgn || '',
        time_control: raw.clock ? `${raw.clock.initial}+${raw.clock.increment}` : raw.speed || '',
        end_time: endTime,
        rated: !!raw.rated,
        tcn: '',
        uuid: raw.id,
        initial_setup: '',
        fen: raw.initialFen || '',
        time_class: raw.speed || raw.perf || 'blitz',
        rules: raw.variant || 'standard',
        platform: 'lichess',
        white: {
          rating: raw.players?.white?.rating || 0,
          result: whiteResult,
          '@id': '',
          username: whiteUsername,
          uuid: ''
        },
        black: {
          rating: raw.players?.black?.rating || 0,
          result: blackResult,
          '@id': '',
          username: blackUsername,
          uuid: ''
        },
        computedDuration: duration
      })
    } catch (e) {
      console.error('Error parsing Lichess NDJSON line:', e)
    }
  }
  return games
}
