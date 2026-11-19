import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateDateDifference,
  formatLikeSource,
  parseIsoDate,
  splitCombinedDates
} from '../apps/datecalc/date-math.js'

test('calculates forward date-only differences and reductions', () => {
  assert.deepEqual(calculateDateDifference('2025-01-01', '2025-01-10'), {
    wholeDays: 9,
    signedDays: 9,
    direction: 'days later',
    halfway: '2025-01-05',
    quarter: '2025-01-03',
    plusSeven: '2025-01-08'
  })
})

test('handles leap days using UTC calendar math', () => {
  assert.deepEqual(calculateDateDifference('2024-02-28', '2024-03-01'), {
    wholeDays: 2,
    signedDays: 2,
    direction: 'days later',
    halfway: '2024-02-29',
    quarter: '2024-02-28',
    plusSeven: '2024-03-06'
  })
})

test('preserves millisecond UTC timestamp precision', () => {
  assert.deepEqual(
    calculateDateDifference('2025-12-25T16:37:35.679Z', '2027-06-28T16:37:35.679Z'),
    {
      wholeDays: 550,
      signedDays: 550,
      direction: 'days later',
      halfway: '2026-09-26T16:37:35.679Z',
      quarter: '2026-05-11T16:37:35.679Z',
      plusSeven: '2026-01-01T16:37:35.679Z'
    }
  )
})

test('rounds reverse intervals symmetrically before applying direction', () => {
  assert.deepEqual(calculateDateDifference('2025-01-08', '2025-01-01'), {
    wholeDays: 7,
    signedDays: -7,
    direction: 'days earlier',
    halfway: '2025-01-05',
    quarter: '2025-01-07',
    plusSeven: '2025-01-15'
  })

  const oneMillisecondEarlier = calculateDateDifference(
    '2025-01-01T00:00:00.001Z',
    '2025-01-01T00:00:00.000Z'
  )
  assert.equal(oneMillisecondEarlier.wholeDays, 0)
  assert.equal(oneMillisecondEarlier.signedDays, -0)
  assert.equal(oneMillisecondEarlier.direction, 'days earlier')
})

test('is stable across a daylight-saving boundary', () => {
  assert.deepEqual(calculateDateDifference('2025-03-09', '2025-03-17'), {
    wholeDays: 8,
    signedDays: 8,
    direction: 'days later',
    halfway: '2025-03-13',
    quarter: '2025-03-11',
    plusSeven: '2025-03-16'
  })
})

test('handles same-day and fractional-day intervals', () => {
  assert.deepEqual(calculateDateDifference('2025-06-15', '2025-06-15'), {
    wholeDays: 0,
    signedDays: 0,
    direction: 'same day',
    halfway: '2025-06-15',
    quarter: '2025-06-15',
    plusSeven: '2025-06-22'
  })

  assert.equal(
    calculateDateDifference(
      '2025-01-01T00:00:00.000Z',
      '2025-01-01T23:59:59.999Z'
    ).wholeDays,
    0
  )
})

test('parses exactly two combined ISO values', () => {
  assert.deepEqual(splitCombinedDates('2025-01-01\t2025-01-10'), [
    '2025-01-01',
    '2025-01-10'
  ])
  assert.deepEqual(splitCombinedDates('2025-01-01\n2025-01-10'), [
    '2025-01-01',
    '2025-01-10'
  ])
  assert.deepEqual(splitCombinedDates(' 2025-01-01 2025-01-10 '), [
    '2025-01-01',
    '2025-01-10'
  ])
  assert.deepEqual(
    splitCombinedDates('2025-01-01T20:03:00.67Z\r\n2025-01-10T20:03:00.67Z'),
    ['2025-01-01T20:03:00.67Z', '2025-01-10T20:03:00.67Z']
  )
  assert.throws(() => splitCombinedDates('2025-01-01'))
  assert.throws(() => splitCombinedDates('2025-01-01 2025-01-10 2025-02-01'))
})

test('pastes two date and UTC-time pairs together', () => {
  const [start, end] = splitCombinedDates('2026-11-13\n20:03\n2028-05-16\n20:03')
  assert.deepEqual([start, end], [
    '2026-11-13T20:03:00Z',
    '2028-05-16T20:03:00Z'
  ])
  assert.deepEqual(calculateDateDifference(start, end), {
    wholeDays: 550,
    signedDays: 550,
    direction: 'days later',
    halfway: '2027-08-15T20:03:00Z',
    quarter: '2027-03-30T20:03:00Z',
    plusSeven: '2026-11-20T20:03:00Z'
  })
})

test('four-part paste tolerates surrounding whitespace, tabs, and CRLF', () => {
  assert.deepEqual(
    splitCombinedDates(' \r\n\t2026-11-13 \r\n 20:03\t\r\n2028-05-16\r\n\t20:03 \r\n'),
    ['2026-11-13T20:03:00Z', '2028-05-16T20:03:00Z']
  )
  assert.deepEqual(
    splitCombinedDates('2026-11-13\t20:03\t2028-05-16\t20:03'),
    ['2026-11-13T20:03:00Z', '2028-05-16T20:03:00Z']
  )
})

test('four-part paste keeps leap and reverse-interval UTC semantics', () => {
  const [start, end] = splitCombinedDates('2028-03-01\n00:00\n2028-02-29\n00:00')
  assert.deepEqual(calculateDateDifference(start, end), {
    wholeDays: 1,
    signedDays: -1,
    direction: 'days earlier',
    halfway: '2028-03-01T00:00:00Z',
    quarter: '2028-03-01T00:00:00Z',
    plusSeven: '2028-03-08T00:00:00Z'
  })

  const [nearDayStart, nearDayEnd] = splitCombinedDates('2028-02-29\n20:03\n2028-03-01\n20:02')
  assert.equal(calculateDateDifference(nearDayStart, nearDayEnd).wholeDays, 0)
})

test('four-part paste rejects invalid, partial, and extra input without normalization', () => {
  for (const value of [
    '2027-02-29\n20:03\n2028-05-16\n20:03',
    '2026-11-13\n20:03\n2028-02-30\n20:03',
    '2026-11-13\n24:00\n2028-05-16\n20:03',
    '2026-11-13\n20:03\n2028-05-16\n20:60',
    '2026-11-13\n20:03\n2028-05-16',
    '2026-11-13\n20:03\n2028-05-16\n20:03\nextra',
    '2026-11-13\n20:03+02:00\n2028-05-16\n20:03'
  ]) {
    assert.throws(() => splitCombinedDates(value), TypeError, value)
  }
})

test('rejects normalized, zone-less, offset, and malformed dates', () => {
  for (const value of [
    '2025-02-29',
    '2025-02-30',
    '2025-04-31',
    '2025-1-01',
    '2025-01-01T00:00:00',
    '2025-01-01T00:00:00+00:00',
    '2025-01-01T00:00:00.1234Z',
    '2025-01-01 trailing'
  ]) {
    assert.throws(() => parseIsoDate(value), value)
  }

  assert.doesNotThrow(() => parseIsoDate('2024-02-29'))
})

test('preserves accepted UTC fraction precision', () => {
  const oneDigit = parseIsoDate('2025-01-01T00:00:00.6Z')
  const twoDigits = parseIsoDate('2025-01-01T00:00:00.67Z')
  const noDigits = parseIsoDate('2025-01-01T00:00:00Z')

  assert.equal(formatLikeSource(oneDigit.date, oneDigit), '2025-01-01T00:00:00.6Z')
  assert.equal(formatLikeSource(twoDigits.date, twoDigits), '2025-01-01T00:00:00.67Z')
  assert.equal(formatLikeSource(noDigits.date, noDigits), '2025-01-01T00:00:00Z')
})
