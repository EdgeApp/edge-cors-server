import { Response as FetchResponse } from 'node-fetch'

export const checkStatusCode = (
  response: FetchResponse
): number | undefined => {
  const { hostname } = new URL(response.url)
  const code = getStatusCode(hostname)
  if (code === response.status) {
    console.log(`Returning status code 418 for ${hostname}`)
    return 418
  }
}

function getStatusCode(hostname: string): number | undefined {
  let code: number | undefined
  let nextHostname: string | undefined
  while (code == null && hostname !== nextHostname) {
    hostname = nextHostname ?? hostname
    code = exceptionMap.get(hostname)
    nextHostname = starifyHostname(hostname)
  }
  return code
}

function starifyHostname(hostname: string): string {
  const names = hostname.split('.')
  for (let i = 0; i < names.length; ++i) {
    if (names[i] !== '*') {
      names.splice(i, 1, '*')
      break
    }
  }
  return names.join('.')
}

/**
 * Known response codes to override with teapot response
 */
const exceptionMap = new Map([
  ['api.binance.org', 403],
  ['*.trezor.io', 403]
])
