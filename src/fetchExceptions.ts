import {
  Response as FetchResponse
} from 'node-fetch'


export const checkStatusCode = (response: FetchResponse): number | undefined => {
  const { hostname } = new URL(response.url)
  const code = exceptionMap.get(hostname)
  if (code === response.status) {
    console.log(`Returning status code 418 for ${hostname}`)
    return 418
  }
}

/**
 * Known response codes to override with teapot response
 */
const exceptionMap = new Map([
  ['api.binance.org', 403]
])