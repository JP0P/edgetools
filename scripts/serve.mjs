import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

import { build } from './build.mjs'
import { handlePublicStatus } from '../worker/public-status.js'
import { handlePublicToken } from '../worker/public-token.js'

const args = process.argv.slice(2)

function readFlag(name, fallback) {
  const inline = args.find(value => value.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)

  const index = args.indexOf(name)
  if (index !== -1 && args[index + 1]) return args[index + 1]
  return fallback
}

const host = readFlag('--host', '127.0.0.1')
const port = Number(readFlag('--port', '4173'))

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid port: ${port}`)
}

const { mainOutput, staffOutput, supportOutput, supportStaffOutput } = await build()

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8']
])

function chooseOutput(request) {
  const hostname = request.headers.host?.split(':')[0].toLowerCase() ?? ''
  const requestUrl = new URL(request.url ?? '/', `http://${hostname || 'localhost'}`)
  const supportHost = hostname === 'support.edgetools.app' || hostname.startsWith('support.')
  const supportPath = requestUrl.pathname === '/support' || requestUrl.pathname.startsWith('/support/')
  const localSupportStaffPath =
    requestUrl.pathname === '/support/staff' || requestUrl.pathname.startsWith('/support/staff/')
  const hostedSupportStaffPath =
    supportHost && (requestUrl.pathname === '/staff' || requestUrl.pathname.startsWith('/staff/'))
  const staffHost = hostname === 'staff.edgetools.app' || hostname.startsWith('staff.')
  const staffPath = requestUrl.pathname === '/staff' || requestUrl.pathname.startsWith('/staff/')

  if (localSupportStaffPath || hostedSupportStaffPath) {
    const pathname = localSupportStaffPath
      ? requestUrl.pathname.replace(/^\/support\/staff(?=\/|$)/, '') || '/'
      : requestUrl.pathname.replace(/^\/staff(?=\/|$)/, '') || '/'
    return { outputRoot: supportStaffOutput, pathname }
  }

  if (staffHost || staffPath) {
    const pathname = staffPath
      ? requestUrl.pathname.replace(/^\/staff(?=\/|$)/, '') || '/'
      : requestUrl.pathname
    return { outputRoot: staffOutput, pathname }
  }

  if (supportHost || supportPath) {
    const pathname = supportPath
      ? requestUrl.pathname.replace(/^\/support(?=\/|$)/, '') || '/'
      : requestUrl.pathname
    return { outputRoot: supportOutput, pathname }
  }

  return { outputRoot: mainOutput, pathname: requestUrl.pathname }
}

function safeFilePath(outputRoot, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const requestedPath = decoded.endsWith('/') ? `${decoded}index.html` : decoded
  const filePath = resolve(outputRoot, `.${requestedPath}`)
  if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${sep}`)) return null
  return filePath
}

async function findResponseFile(outputRoot, pathname) {
  const requested = safeFilePath(outputRoot, pathname)
  if (!requested) return { filePath: resolve(outputRoot, '404.html'), statusCode: 404 }

  try {
    const details = await stat(requested)
    if (details.isFile()) return { filePath: requested, statusCode: 200 }
    if (details.isDirectory()) {
      const indexPath = resolve(requested, 'index.html')
      const indexDetails = await stat(indexPath)
      if (indexDetails.isFile()) return { filePath: indexPath, statusCode: 200 }
    }
  } catch {
    // The static 404 page below is the intended fallback.
  }

  return { filePath: resolve(outputRoot, '404.html'), statusCode: 404 }
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method not allowed')
    return
  }

  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)
  const apiHandler = requestUrl.pathname === '/api/status'
    ? handlePublicStatus
    : requestUrl.pathname === '/api/token'
      ? handlePublicToken
      : null
  if (apiHandler) {
    const apiResponse = await apiHandler(new Request(requestUrl, { method: request.method, headers: request.headers }))
    response.writeHead(apiResponse.status, Object.fromEntries(apiResponse.headers))
    response.end(request.method === 'HEAD' ? undefined : Buffer.from(await apiResponse.arrayBuffer()))
    return
  }

  const { outputRoot, pathname } = chooseOutput(request)
  const { filePath, statusCode } = await findResponseFile(outputRoot, pathname)
  const contentType = contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream'

  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff'
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(filePath).pipe(response)
})

server.listen(port, host, () => {
  const displayHost = host.includes(':') ? `[${host}]` : host
  console.log(`EdgeTools preview: http://${displayHost}:${port}/`)
  console.log(`Support preview: http://${displayHost}:${port}/support/`)
  console.log(`DateCalc preview: http://${displayHost}:${port}/support/staff/datecalc/`)
  console.log(`Staff hub preview: http://${displayHost}:${port}/staff/`)
  console.log(`QA staff preview: http://${displayHost}:${port}/staff/qa/`)
  console.log(`Support staff preview: http://${displayHost}:${port}/support/staff/`)
})

function close() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
