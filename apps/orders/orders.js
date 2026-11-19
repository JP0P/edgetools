import { lookupOrder, providers } from './order-logic.js'

const form = document.querySelector('#order-form')
const input = document.querySelector('#order-id')
const providerSelect = document.querySelector('#order-provider')
const status = document.querySelector('#order-status')
const results = document.querySelector('#order-results')
const resultsHeading = document.querySelector('#order-results-heading')
const checkedId = document.querySelector('#order-checked-id')
const content = document.querySelector('#order-content')

for (const group of [...new Set(providers.map(provider => provider.group))]) {
  const optgroup = document.createElement('optgroup')
  optgroup.label = group
  for (const provider of providers.filter(provider => provider.group === group).sort((a, b) => a.name.localeCompare(b.name))) {
    const option = document.createElement('option')
    option.value = provider.id
    option.textContent = provider.name
    optgroup.append(option)
  }
  providerSelect.append(optgroup)
}
function setStatus(text, state = '') { status.textContent = text; status.dataset.state = state }
function paragraph(text, className = '') {
  const p = document.createElement('p')
  p.textContent = text
  p.className = className
  return p
}
function link({ label, url }) {
  const a = document.createElement('a')
  a.className = 'tool-link-button'
  a.textContent = label + ' ↗'
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.referrerPolicy = 'no-referrer'
  return a
}
function resetResults() { results.hidden = true; content.replaceChildren(); checkedId.textContent = ''; setStatus('') }
function render(lookup) {
  results.hidden = false
  checkedId.textContent = lookup.orderId
  if (lookup.requiresProviderConfirmation && lookup.matches.length) content.append(paragraph('Possible matches — open the provider you used.', 'tool-result-context'))
  if (lookup.transaction) {
    const heading = document.createElement('h3')
    heading.textContent = lookup.transaction.label
    content.append(heading, paragraph(lookup.transaction.note))
    const actions = document.createElement('div')
    actions.className = 'tool-actions'
    for (const destination of lookup.transaction.links) actions.append(link(destination))
    content.append(actions)
  }
  if (!lookup.matches.length) content.append(paragraph('An ID alone cannot identify most providers. Choose the provider above to prepare its tracking link or see how to find the original receipt.'))
  const list = document.createElement('ul')
  list.className = 'tool-list order-matches'
  for (const match of lookup.matches) {
    const li = document.createElement('li')
    const details = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = match.name
    details.append(name)
    if (match.note) details.append(paragraph(match.note, 'field-hint'))
    li.append(details)
    const actions = document.createElement('div')
    actions.className = 'tool-actions'
    // The destination link itself is the explicit choice; no intermediate gate.
    for (const destination of match.links) actions.append(link(destination))
    if (!match.links.length) actions.append(paragraph('Original receipt needed', 'field-hint'))
    li.append(actions)
    list.append(li)
  }
  if (lookup.matches.length) content.append(list)
}
form.addEventListener('submit', event => {
  event.preventDefault()
  resetResults()
  const lookup = lookupOrder(input.value, providerSelect.value)
  if (lookup.kind === 'empty' || lookup.kind === 'invalid') { setStatus(lookup.message, 'error'); input.focus(); return }
  render(lookup)
  setStatus('')
  resultsHeading.focus()
})
input.addEventListener('input', resetResults)
providerSelect.addEventListener('change', resetResults)
document.querySelector('#order-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(checkedId.textContent); setStatus('ID copied to clipboard.', 'success') }
  catch { setStatus('Copy failed — select the ID manually.', 'error') }
})
document.querySelector('#order-clear').addEventListener('click', () => { form.reset(); resetResults(); input.focus() })
