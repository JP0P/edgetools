const routes = {
  tools: 'https://edgetools.app/',
  support: 'https://support.edgetools.app/',
  partners: 'https://bizdev.edgetools.app/',
  staff: 'https://staff.edgetools.app/',
  supportStaff: 'https://support.edgetools.app/staff/',
  qa: 'https://staff.edgetools.app/qa/'
}

function currentAttribute(current, route) {
  return current === route ? ' aria-current="page"' : ''
}

function previewAttribute(path) {
  return ` data-preview-href="${path}"`
}

function publicNavigation({ assetPrefix, current }) {
  return `
        <nav class="site-nav" aria-label="Primary navigation">
          <a${currentAttribute(current, 'tools')} href="${routes.tools}"${previewAttribute('/')}>Tools</a>
          <a${currentAttribute(current, 'support')} href="${routes.support}"${previewAttribute('/support/')}>Support</a>
          <a${currentAttribute(current, 'partners')} href="${routes.partners}">Partners <span class="external-mark" aria-hidden="true">↗</span></a>
          <details class="nav-disclosure">
            <summary>Staff <span aria-hidden="true">⌄</span></summary>
            <div class="nav-menu">
              <p class="nav-menu-kicker">Edge staff · sign-in required</p>
              <a href="${routes.staff}"${previewAttribute('/staff/')}><strong>Staff home</strong><small>Shared company tools</small></a>
              <a href="${routes.supportStaff}"${previewAttribute('/support/staff/')}><strong>Support workspace</strong><small>Customer support workflows</small></a>
              <a href="${routes.qa}"${previewAttribute('/staff/qa/')}><strong>QA workspace</strong><small>Builds, tests, issues, and devices</small></a>
            </div>
          </details>
        </nav>`
}

function staffNavigation({ current }) {
  return `
        <nav class="site-nav" aria-label="Staff navigation">
          <a href="${routes.tools}"${previewAttribute('/')}>Tools</a>
          <a href="${routes.support}"${previewAttribute('/support/')}>Support</a>
          <a${currentAttribute(current, 'staff')} href="${routes.staff}"${previewAttribute('/staff/')}>Staff home</a>
          <a${currentAttribute(current, 'supportStaff')} href="${routes.supportStaff}"${previewAttribute('/support/staff/')}>Support workspace</a>
          <a${currentAttribute(current, 'qa')} href="${routes.qa}"${previewAttribute('/staff/qa/')}>QA</a>
        </nav>`
}

function officialNavigation({ assetPrefix }) {
  return `
      <nav class="official-nav page-width" aria-label="Official Edge links">
        <a href="https://edge.app/">
          <svg aria-hidden="true"><use href="${assetPrefix}/assets/tool-icons.svg#icon-wallet"></use></svg>
          Edge Wallet
        </a>
        <a href="https://support.edge.app/">
          <svg aria-hidden="true"><use href="${assetPrefix}/assets/tool-icons.svg#icon-help"></use></svg>
          Help Center
        </a>
      </nav>`
}

export function renderNavigation({ assetPrefix = '.', current = '', mode = 'public', part = 'header' } = {}) {
  const primary = mode === 'staff'
    ? staffNavigation({ current })
    : publicNavigation({ assetPrefix, current })
  return part === 'official' ? officialNavigation({ assetPrefix }) : primary
}

export { routes }
