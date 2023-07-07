import cors from 'cors'
import express, { Request, Response } from 'express'
import getRawBody from 'raw-body'
import fetch, {
  HeadersInit,
  RequestInfo,
  RequestInit,
  Response as FetchResponse
} from 'node-fetch'

const app = express()

app.use(cors())

app.all('*', async (req: Request, res: Response) => {
  const { headers, ip, method, path, rawHeaders } = req
  const { 'proxy-url': proxyUrl } = headers
  const ipString = ip.includes(':') ? `[${ip}]` : ip
  const rawBody = await getRawBody(req, {
    length: req.headers['content-length'],
    encoding: req.headers['content-encoding'],
  })
  const body = rawBody.byteLength > 0 ? rawBody.toString() : undefined

  if (proxyUrl == null) {
    res.status(400).send('No proxy-url specified in headers')
    return
  }

  const headersInit: HeadersInit = [];

  for (let i = 0; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i]
    const value = rawHeaders[i + 1]
    // Node.js includes some pseudo-headers that should not be forwarded
    if (key.startsWith(':')) continue

    if (key.toLowerCase() === 'forwarded') continue
    if (key.toLowerCase() === 'x-forwarded-for') continue
    if (key.toLowerCase() === 'content-length') continue
    if (key.toLowerCase() === 'proxy-url') continue
    if (key.toLowerCase() === 'connection') continue
    if (key.toLowerCase() === 'host') continue
    headersInit.push([key, value])
  }

  const xForwardedFor = typeof headers['x-forwarded-for'] === 'string' ? `${headers['x-forwarded-for']}, ${ipString}` : ipString
  const forwarded = typeof headers['forwarded'] === 'string' ?  `${headers['forwarded']}, for=${ipString}` : `for=${ipString}`

  headersInit.push(['X-Forwarded-For', xForwardedFor])
  headersInit.push(['Forwarded', forwarded])

  const url: RequestInfo = `${proxyUrl}${path}`
  const init: RequestInit = {
    method,
    headers: headersInit,
    body
  }

  try {
    const response: FetchResponse = await fetch(url, init)
    const bodyText = await response.text()
    // Forward the headers
    response.headers.forEach((value, name) => {
      if (name === 'transfer-encoding') return
      res.header(name, value)
    })
    res.status(response.status).send(bodyText)
  } catch (err) {
    let errMsg
    if (typeof err === 'object')    {
      const {code = '', errno = '', message = ''} = err as any
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
