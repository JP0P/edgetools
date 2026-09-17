const productionHosts = new Set(['edgetools.app', 'staff.edgetools.app', 'support.edgetools.app'])
const hostname = window.location.hostname
const isPrivateIpv4 =
  /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname) ||
  /^100\.(?:6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./.test(hostname)
const isLocalPreview =
  !productionHosts.has(hostname) &&
  (hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.ts.net') ||
    isPrivateIpv4)
const isProductionStaff =
  hostname === 'staff.edgetools.app' ||
  (hostname === 'support.edgetools.app' &&
    (window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/')))

if (isLocalPreview) {
  for (const link of document.querySelectorAll('[data-preview-href]')) {
    link.href = link.dataset.previewHref
  }

}

for (const element of document.querySelectorAll('[data-preview-only]')) {
  element.hidden = !isLocalPreview
}

for (const element of document.querySelectorAll('[data-production-only]')) {
  element.hidden = !isProductionStaff
}

for (const year of document.querySelectorAll('[data-current-year]')) {
  year.textContent = String(new Date().getFullYear())
}
