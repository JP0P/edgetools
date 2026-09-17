const MILLISECONDS_PER_DAY = 86_400_000
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const UTC_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/

const DATE_TOKEN =
  '(?:\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z|\\d{4}-\\d{2}-\\d{2})'
const COMBINED_PATTERN = new RegExp(`^(${DATE_TOKEN})[\\t\\n ]+(${DATE_TOKEN})$`)

function invalidDate(value) {
  throw new TypeError(`Invalid ISO date: ${value}`)
}

export function parseIsoDate(value) {
  const normalized = String(value ?? '').trim()
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(normalized)

  if (dateOnlyMatch) {
    const [, yearText, monthText, dayText] = dateOnlyMatch
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return invalidDate(normalized)
    }

    return { date, kind: 'date', fractionDigits: 0, source: normalized }
  }

  const dateTimeMatch = UTC_DATETIME_PATTERN.exec(normalized)
  if (!dateTimeMatch) return invalidDate(normalized)

  const fraction = dateTimeMatch[7] ?? ''
  const canonicalMilliseconds = fraction.padEnd(3, '0') || '000'
  const canonical = `${normalized.slice(0, 19)}.${canonicalMilliseconds}Z`
  const date = new Date(canonical)

  if (Number.isNaN(date.getTime()) || date.toISOString() !== canonical) {
    return invalidDate(normalized)
  }

  return {
    date,
    kind: 'datetime',
    fractionDigits: fraction.length,
    source: normalized
  }
}

export function formatLikeSource(date, parsedSource) {
  const iso = date.toISOString()
  if (parsedSource.kind === 'date') return iso.slice(0, 10)
  if (parsedSource.fractionDigits === 0) return `${iso.slice(0, 19)}Z`

  const fractionEnd = 20 + parsedSource.fractionDigits
  return `${iso.slice(0, fractionEnd)}Z`
}

export function splitCombinedDates(value) {
  const normalized = String(value ?? '').trim()
  const match = COMBINED_PATTERN.exec(normalized)
  if (!match) throw new TypeError('Enter exactly two ISO dates separated by a tab, space, or new line.')

  parseIsoDate(match[1])
  parseIsoDate(match[2])
  return [match[1], match[2]]
}

function addWholeDays(date, days) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY)
}

export function calculateDateDifference(startValue, endValue) {
  const start = parseIsoDate(startValue)
  const end = parseIsoDate(endValue)
  const differenceMilliseconds = end.date.getTime() - start.date.getTime()
  const direction = Math.sign(differenceMilliseconds)
  const wholeDays = Math.floor(Math.abs(differenceMilliseconds) / MILLISECONDS_PER_DAY)
  const signedDays = direction * wholeDays
  const halfwayDays = direction * Math.floor(wholeDays * 0.5)
  const quarterDays = direction * Math.floor(wholeDays * 0.25)

  return {
    wholeDays,
    signedDays,
    direction:
      direction < 0 ? 'days earlier' : direction > 0 ? 'days later' : 'same day',
    halfway: formatLikeSource(addWholeDays(start.date, halfwayDays), start),
    quarter: formatLikeSource(addWholeDays(start.date, quarterDays), start),
    plusSeven: formatLikeSource(addWholeDays(start.date, 7), start)
  }
}

export { MILLISECONDS_PER_DAY }
