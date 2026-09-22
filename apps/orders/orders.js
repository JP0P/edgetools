import { lookupOrder } from './order-logic.js'

const form = document.querySelector('#order-form')
const input = document.querySelector('#order-id')
const status = document.querySelector('#order-status')
const results = document.querySelector('#order-results')
const content = document.querySelector('#order-content')

function setStatus(text, state = '') { status.textContent = text; status.dataset.state = state }
function button(label, action, note = '') { const wrap = document.createElement('div'); const b = document.createElement('button'); b.type = 'button'; b.className = 'tool-link-button'; b.textContent = label; b.addEventListener('click', action); wrap.append(b); if (note) { const p = document.createElement('p'); p.className = 'field-hint'; p.textContent = note; wrap.append(p) } return wrap }
function render(lookup) {
  results.hidden = false; content.replaceChildren()
  if (lookup.kind === 'crypto') {
    const heading = document.createElement('h3'); heading.textContent = `${lookup.crypto.name} transaction detected`; content.append(heading)
    const p = document.createElement('p'); p.textContent = 'This looks like a blockchain transaction ID, not an exchange order. Open a public explorer if you want to inspect it.'; content.append(p)
    content.append(button('Open blockchain explorer ↗', () => window.open(lookup.crypto.explorer(lookup.orderId), '_blank', 'noopener')))
    return
  }
  if (!lookup.matches.length) { const p = document.createElement('p'); p.textContent = 'No supported partner pattern matched this ID. Check the value and try again.'; content.append(p); return }
  const list = document.createElement('ul'); list.className = 'tool-list'
  for (const match of lookup.matches) {
    const li = document.createElement('li')
    const text = document.createElement('span')
    const name = document.createElement('strong')
    const description = document.createElement('small')
    name.textContent = match.name
    description.textContent = match.description
    text.append(name, document.createElement('br'), description)
    li.append(text)
    li.append(button(`View ${match.name} status ↗`, () => window.open(`${match.url}${encodeURIComponent(lookup.orderId)}`, '_blank', 'noopener'), match.note))
    list.append(li)
  }
  content.append(list)
}
form.addEventListener('submit', event => { event.preventDefault(); const lookup = lookupOrder(input.value); results.hidden = true; if (lookup.kind === 'empty') { setStatus('Enter an order ID to check.', 'error'); input.focus(); return } render(lookup); setStatus('ID checked locally.', 'success') })
document.querySelector('#order-clear').addEventListener('click', () => { form.reset(); results.hidden = true; content.replaceChildren(); setStatus(''); input.focus() })
