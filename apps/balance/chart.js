// Balance-over-time chart: inline SVG, single series, crosshair + tooltip.
// Colors come from CSS variables (--series, --grid, --surface, text tokens).

import { nearestAnchor, niceTicks, timeTicks } from './chart-data.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const HEIGHT = 260
const MARGIN = { top: 16, right: 16, bottom: 28 }

function el (name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  parent?.append(node)
  return node
}

/**
 * createChart(container, { formatAxis, formatTooltip, onSelect })
 * - formatAxis(value, step) -> y tick label
 * - formatTooltip(anchor) -> { value, lines: [string] }
 * - onSelect(anchor) when a point is clicked or Enter is pressed
 * Returns { setSeries(series, label) }.
 */
export function createChart (container, { formatAxis, formatTooltip, onSelect }) {
  container.classList.add('chart')
  const tooltip = document.createElement('div')
  tooltip.className = 'chart-tooltip'
  tooltip.hidden = true
  let svg = null
  let series = null
  let label = ''
  let active = -1
  let geometry = null

  function render () {
    svg?.remove()
    if (!series || series.points.length === 0) return
    const width = container.clientWidth
    if (width === 0) return

    const tMin = series.points[0].t
    const tMax = series.points.at(-1).t
    const vMax = Math.max(...series.points.map(p => p.v))
    const { ticks, step } = niceTicks(vMax)
    const yLabels = ticks.map(v => formatAxis(v, step))
    const left = Math.max(...yLabels.map(s => s.length)) * 7 + 14
    const plotW = width - left - MARGIN.right
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
    const x = t => left + (tMax === tMin ? plotW / 2 : (t - tMin) / (tMax - tMin) * plotW)
    const y = v => MARGIN.top + plotH - v / ticks.at(-1) * plotH
    geometry = { x, y, left, plotW, tMin, tMax }

    svg = el('svg', {
      width,
      height: HEIGHT,
      viewBox: `0 0 ${width} ${HEIGHT}`,
      tabindex: 0,
      role: 'img',
      'aria-label': `${label}. Use left and right arrow keys to step through points; Enter finds the transaction in the table.`
    })

    // Gridlines and y labels.
    ticks.forEach((v, i) => {
      el('line', { x1: left, x2: left + plotW, y1: y(v), y2: y(v), class: i === 0 ? 'chart-baseline' : 'chart-grid' }, svg)
      el('text', { x: left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-axis' }, svg).textContent = yLabels[i]
    })

    // X labels, spaced so they don't collide.
    for (const tick of timeTicks(tMin, tMax, Math.max(2, Math.floor(plotW / 80)))) {
      el('text', { x: x(tick.t), y: HEIGHT - 8, 'text-anchor': 'middle', class: 'chart-axis' }, svg).textContent = tick.label
    }

    const line = series.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
    const base = y(0).toFixed(1)
    el('path', { d: `${line}L${x(tMax).toFixed(1)},${base}L${x(tMin).toFixed(1)},${base}Z`, class: 'chart-area' }, svg)
    el('path', { d: line, class: 'chart-line' }, svg)

    // End dot and value label.
    const last = series.points.at(-1)
    el('circle', { cx: x(last.t), cy: y(last.v), r: 4, class: 'chart-dot' }, svg)
    const endAnchor = series.anchors.at(-1)
    if (endAnchor) {
      el('text', { x: x(last.t) - 8, y: Math.max(12, y(last.v) - 10), 'text-anchor': 'end', class: 'chart-end-label' }, svg)
        .textContent = formatTooltip(endAnchor).value
    }

    // Crosshair layer.
    const cross = el('g', { class: 'chart-cross', visibility: 'hidden' }, svg)
    el('line', { y1: MARGIN.top, y2: MARGIN.top + plotH, class: 'chart-crosshair' }, cross)
    el('circle', { r: 4, class: 'chart-dot' }, cross)
    // Transparent hit area covering the plot.
    el('rect', { x: left, y: 0, width: plotW, height: HEIGHT, fill: 'transparent', class: 'chart-hit' }, svg)

    svg.addEventListener('pointermove', onPointer)
    // On touch, the first tap on a point shows its tooltip; tapping the same
    // point again finds it in the list. A mouse click selects right away.
    let tapSelects = true
    svg.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return
      const before = active
      onPointer(event)
      tapSelects = active === before
    })
    svg.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') hide() })
    svg.addEventListener('click', event => {
      const isMouse = (event.pointerType ?? 'mouse') === 'mouse'
      if (active >= 0 && (isMouse || tapSelects)) onSelect(series.anchors[active])
    })
    svg.addEventListener('keydown', onKey)
    svg.addEventListener('blur', hide)
    container.prepend(svg)
    if (active >= 0) show(active)
  }

  function show (index) {
    if (!svg || !series.anchors[index]) return
    active = index
    const a = series.anchors[index]
    const cx = geometry.x(a.t)
    const cy = geometry.y(a.v)
    const cross = svg.querySelector('.chart-cross')
    cross.setAttribute('visibility', 'visible')
    const [hair, dot] = cross.children
    hair.setAttribute('x1', cx)
    hair.setAttribute('x2', cx)
    dot.setAttribute('cx', cx)
    dot.setAttribute('cy', cy)
    svg.style.cursor = a.row ? 'pointer' : 'default'

    const { value, lines } = formatTooltip(a)
    const strong = document.createElement('strong')
    strong.textContent = value
    tooltip.replaceChildren(strong, ...lines.map(text => {
      const div = document.createElement('div')
      div.textContent = text
      return div
    }))
    tooltip.hidden = false
    const tw = tooltip.offsetWidth
    const left = cx + 12 + tw > container.clientWidth ? cx - 12 - tw : cx + 12
    tooltip.style.left = `${Math.max(0, left)}px`
    tooltip.style.top = `${Math.max(0, Math.min(cy - 20, HEIGHT - tooltip.offsetHeight))}px`
  }

  function hide () {
    active = -1
    tooltip.hidden = true
    svg?.querySelector('.chart-cross')?.setAttribute('visibility', 'hidden')
  }

  function onPointer (event) {
    const rect = svg.getBoundingClientRect()
    const px = Math.min(Math.max(event.clientX - rect.left, geometry.left), geometry.left + geometry.plotW)
    const t = geometry.tMin + (px - geometry.left) / geometry.plotW * (geometry.tMax - geometry.tMin)
    // Several transactions in one block share an x; pick the one nearest the
    // pointer's height so a deposit swept in the same block can still be read.
    const py = event.clientY - rect.top
    let best = nearestAnchor(series.anchors, t)
    const bestT = series.anchors[best].t
    for (let i = best - 1; i >= 0 && series.anchors[i].t === bestT; i--) {
      if (Math.abs(geometry.y(series.anchors[i].v) - py) < Math.abs(geometry.y(series.anchors[best].v) - py)) best = i
    }
    show(best)
  }

  function onKey (event) {
    const n = series.anchors.length
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }
    if (event.key in moves) {
      event.preventDefault()
      const from = active < 0 ? (moves[event.key] > 0 ? -1 : n) : active
      show(Math.min(n - 1, Math.max(0, from + moves[event.key])))
    } else if (event.key === 'Enter' && active >= 0) {
      onSelect(series.anchors[active])
    } else if (event.key === 'Escape') {
      hide()
    }
  }

  container.append(tooltip)
  new ResizeObserver(() => render()).observe(container)

  return {
    setSeries (next, nextLabel) {
      series = next
      label = nextLabel
      hide()
      render()
    }
  }
}
