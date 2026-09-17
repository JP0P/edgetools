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
  assert.throws(() => splitCombinedDates('2025-01-01'))
  assert.throws(() => splitCombinedDates('2025-01-01 2025-01-10 2025-02-01'))
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
