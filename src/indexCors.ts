import compression from 'compression'
import cors from 'cors'
import express, { Request, Response } from 'express'
import PromiseRouter from 'express-promise-router'
import fetch, {
  FetchError,
  HeadersInit,
  RequestInit,
  Response as FetchResponse
} from 'node-fetch'
import getRawBody from 'raw-body'

import { checkStatusCode } from './fetchExceptions'

const mylog = (...args: string[]): void => {
  const now = new Date().toISOString().slice(11, 23)
  console.log(`${now}: ${args.join(' ')}`)
}

const app = express()
const router = PromiseRouter()

app.use(compression())
app.use(cors())
app.use(router)

router.use(async (req: Request, res: Response): Promise<void> => {
  const { headers, ip, method, rawHeaders } = req
  const { 'x-proxy-url': proxyUrl } = headers
  const ipString = ip.includes(':') ? `[${ip}]` : ip
  const rawBody = await getRawBody(req, {
    length: req.headers['content-length'],
    encoding: req.headers['content-encoding']
  })
  const body = rawBody.byteLength > 0 ? rawBody.toString() : undefined

  if (proxyUrl == null) {
    res.status(400).send('No x-proxy-url specified in headers')
    return
  } else if (typeof proxyUrl !== 'string') {
    res.status(400).send('Invalid x-proxy-url specified in headers')
    return
  }
  mylog(`Proxy: ${method} ${proxyUrl}`)

  const headersInit: HeadersInit = []

  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i]
    const value = rawHeaders[i + 1]
    // Node.js includes some pseudo-headers that should not be forwarded
    if (key.startsWith(':')) continue

    if (key.toLowerCase() === 'user-agent') continue
    if (key.toLowerCase() === 'forwarded') continue
    if (key.toLowerCase() === 'x-forwarded-for') continue
    if (key.toLowerCase() === 'content-length') continue
    if (key.toLowerCase() === 'x-proxy-url') continue
    if (key.toLowerCase() === 'connection') continue
    if (key.toLowerCase() === 'host') continue
    headersInit.push([key, value])
  }

  const xForwardedFor =
    typeof headers['x-forwarded-for'] === 'string'
      ? `${headers['x-forwarded-for']}, ${ipString}`
      : ipString
  const forwarded =
    typeof headers.forwarded === 'string'
      ? `${headers.forwarded}, for=${ipString}`
      : `for=${ipString}`

  headersInit.push(['X-Forwarded-For', xForwardedFor])
  headersInit.push(['Forwarded', forwarded])

  const init: RequestInit = {
    method,
    headers: headersInit,
    body
  }

  try {
    const response: FetchResponse = await fetch(proxyUrl, init)
    const bodyText = await response.text()
    // Forward the headers
    response.headers.forEach((value, name) => {
      if (name === 'transfer-encoding') return
      if (name === 'content-encoding') return
      res.header(name, value)
    })
    const overrideStatusCode = checkStatusCode(response)
    res.status(overrideStatusCode ?? response.status).send(bodyText)
  } catch (err: unknown) {
    let errMsg
    if (err instanceof FetchError) {
      const { code = '', errno = '', message = '' } = err
      errMsg = `Bad Gateway: ${code ?? errno} ${message}`
    } else if (typeof err === 'string') {
      errMsg = err
    } else {
      errMsg = JSON.stringify(err)
    }
    console.error(errMsg)
    res.status(502).send(errMsg)
  }
})

app.listen(8008, () => {
  console.log('Listening on port 8008')
})
