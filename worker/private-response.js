const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow'
}

export function privateResponse(response) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(privateHeaders)) headers.set(name, value)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export function notFound() {
  return privateResponse(new Response('Not Found', { status: 404 }))
}
