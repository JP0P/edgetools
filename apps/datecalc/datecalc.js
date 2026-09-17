import { calculateDateDifference, splitCombinedDates } from './date-math.js'

const form = document.querySelector('#date-form')
const combinedInput = document.querySelector('#combined-dates')
const startInput = document.querySelector('#start-date')
const endInput = document.querySelector('#end-date')
const combinedError = document.querySelector('#combined-error')
const startError = document.querySelector('#start-error')
const endError = document.querySelector('#end-error')
const resultEmpty = document.querySelector('#result-empty')
const resultContent = document.querySelector('#result-content')
const resultNumber = document.querySelector('#result-number')
const resultDirection = document.querySelector('#result-direction')
const reductionHalf = document.querySelector('#reduction-half')
const reductionQuarter = document.querySelector('#reduction-quarter')
const plusSeven = document.querySelector('#plus-seven')
const copyStatus = document.querySelector('#copy-status')
const toast = document.querySelector('#copy-toast')
const clearButton = document.querySelector('#clear-button')
const exampleButton = document.querySelector('#example-button')

let toastTimer

function setError(input, output, message = '') {
  input.setAttribute('aria-invalid', message ? 'true' : 'false')
  output.textContent = message
}

function clearErrors() {
  setError(combinedInput, combinedError)
  setError(startInput, startError)
  setError(endInput, endError)
}

function hideResults() {
  resultEmpty.hidden = false
  resultContent.hidden = true
  resultNumber.textContent = '—'
  resultDirection.textContent = ''
  reductionHalf.textContent = '—'
  reductionQuarter.textContent = '—'
  plusSeven.textContent = '—'
}

function showResults(results) {
  resultEmpty.hidden = true
  resultContent.hidden = false
  resultNumber.textContent = String(results.wholeDays)
  resultDirection.textContent = results.direction
  reductionHalf.textContent = results.halfway
  reductionQuarter.textContent = results.quarter
  plusSeven.textContent = results.plusSeven

  document.querySelector('#copy-days').dataset.copyValue = String(results.wholeDays)
}

function calculateFromInputs({ announceErrors = false } = {}) {
  clearErrors()

  if (!startInput.value.trim() || !endInput.value.trim()) {
    hideResults()
    if (announceErrors) {
      if (!startInput.value.trim()) setError(startInput, startError, 'Enter a start date.')
      if (!endInput.value.trim()) setError(endInput, endError, 'Enter an end date.')
    }
    return false
  }

  try {
    showResults(calculateDateDifference(startInput.value, endInput.value))
    return true
  } catch (error) {
    hideResults()
    if (announceErrors) {
      const message = 'Use YYYY-MM-DD or a UTC timestamp ending in Z.'
      try {
        calculateDateDifference(startInput.value, startInput.value)
      } catch {
        setError(startInput, startError, message)
      }
      try {
        calculateDateDifference(endInput.value, endInput.value)
      } catch {
        setError(endInput, endError, message)
      }
    }
    return false
  }
}

function parseCombined({ announceErrors = false } = {}) {
  const value = combinedInput.value.trim()
  setError(combinedInput, combinedError)

  if (!value) {
    startInput.value = ''
    endInput.value = ''
    hideResults()
    clearErrors()
    return false
  }

  try {
    const [start, end] = splitCombinedDates(value)
    startInput.value = start
    endInput.value = end
    return calculateFromInputs()
  } catch (error) {
    startInput.value = ''
    endInput.value = ''
    hideResults()
    if (announceErrors) setError(combinedInput, combinedError, error.message)
    return false
  }
}

function showCopyMessage(message, success) {
  copyStatus.textContent = message
  toast.textContent = message
  toast.classList.toggle('is-visible', success)
  clearTimeout(toastTimer)
  if (success) {
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800)
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

async function copyText(text) {
  if (typeof text !== 'string' || !text) return

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else if (!fallbackCopy(text)) {
      throw new Error('Clipboard unavailable')
    }
    showCopyMessage('Copied to clipboard', true)
  } catch {
    try {
      if (!fallbackCopy(text)) throw new Error('Clipboard unavailable')
      showCopyMessage('Copied to clipboard', true)
    } catch {
      showCopyMessage('Copy failed — select the value manually.', false)
    }
  }
}

combinedInput.addEventListener('input', () => parseCombined())
combinedInput.addEventListener('blur', () => parseCombined({ announceErrors: Boolean(combinedInput.value.trim()) }))

for (const input of [startInput, endInput]) {
  input.addEventListener('input', () => {
    combinedInput.value = ''
    setError(combinedInput, combinedError)
    calculateFromInputs()
  })
  input.addEventListener('blur', () => calculateFromInputs({ announceErrors: true }))
}

form.addEventListener('submit', event => {
  event.preventDefault()
  calculateFromInputs({ announceErrors: true })
})

clearButton.addEventListener('click', () => {
  form.reset()
  clearErrors()
  hideResults()
  combinedInput.focus()
})

exampleButton.addEventListener('click', () => {
  combinedInput.value = '2025-01-01 2025-01-10'
  parseCombined({ announceErrors: true })
  combinedInput.focus()
})

for (const button of document.querySelectorAll('[data-copy-source], [data-copy-value]')) {
  button.addEventListener('click', () => {
    const source = button.dataset.copySource
    const text = source ? document.querySelector(`#${source}`)?.textContent : button.dataset.copyValue
    copyText(text?.trim())
  })
}

hideResults()
