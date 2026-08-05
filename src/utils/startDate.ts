export type TimeZoneMode = 'local' | 'utc'

const pad = (value: number) => value.toString().padStart(2, '0')

/**
 * A URL-safe, editable representation of a start date.
 * `2026-08-06_18-30` is local time; appending Z makes it UTC.
 */
export function formatReadableStartDate(date: Date, timeZone: TimeZoneMode): string {
  const year = timeZone === 'utc' ? date.getUTCFullYear() : date.getFullYear()
  const month = timeZone === 'utc' ? date.getUTCMonth() + 1 : date.getMonth() + 1
  const day = timeZone === 'utc' ? date.getUTCDate() : date.getDate()
  const hours = timeZone === 'utc' ? date.getUTCHours() : date.getHours()
  const minutes = timeZone === 'utc' ? date.getUTCMinutes() : date.getMinutes()

  return `${year}-${pad(month)}-${pad(day)}_${pad(hours)}-${pad(minutes)}${timeZone === 'utc' ? 'Z' : ''}`
}

function isSameDate(date: Date, year: number, month: number, day: number, hours: number, minutes: number, utc: boolean) {
  if (utc) {
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCHours() === hours && date.getUTCMinutes() === minutes
  }
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hours && date.getMinutes() === minutes
}

/** Converts a legacy millisecond timestamp or an editable date path to a Date. */
export function parseStartDate(value: string | null | undefined): Date | null {
  if (!value) return null
  if (/^\d{10,16}$/.test(value)) {
    const date = new Date(Number(value))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})(Z)?$/)
  if (!match) return null
  const [, yearString, monthString, dayString, hoursString, minutesString, utcSuffix] = match
  const year = Number(yearString)
  const month = Number(monthString)
  const day = Number(dayString)
  const hours = Number(hoursString)
  const minutes = Number(minutesString)
  const utc = Boolean(utcSuffix)
  const date = utc ? new Date(Date.UTC(year, month - 1, day, hours, minutes)) : new Date(year, month - 1, day, hours, minutes)
  return isSameDate(date, year, month, day, hours, minutes, utc) ? date : null
}

export function getLocalTimeZoneLabel(date = new Date()): string {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'
  const name = browserTimeZone === 'Europe/Kiev' ? 'Europe/Kyiv' : browserTimeZone
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  return `${name} (UTC${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)})`
}
