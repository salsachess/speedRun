import { describe, expect, it } from 'vitest'
import { formatReadableStartDate, parseStartDate } from '../startDate'

describe('start date URL format', () => {
  it('formats and parses UTC dates without losing the instant', () => {
    const date = new Date('2026-08-06T15:30:00Z')
    const value = formatReadableStartDate(date, 'utc')
    expect(value).toBe('2026-08-06_15-30Z')
    expect(parseStartDate(value)?.getTime()).toBe(date.getTime())
  })

  it('accepts legacy timestamps', () => {
    expect(parseStartDate('1786020600000')?.getTime()).toBe(1786020600000)
  })

  it('rejects impossible editable dates', () => {
    expect(parseStartDate('2026-02-30_12-00')).toBeNull()
    expect(parseStartDate('2026-08-06_25-00')).toBeNull()
  })
})
