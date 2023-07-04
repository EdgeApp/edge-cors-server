import cors from 'cors'
import express, { Request, Response } from 'express'
import fetch, {
  RequestInfo,
  RequestInit,
  Response as FetchResponse
} from 'node-fetch'

const app = express()

app.use(express.json())
app.use(cors())

app.all('*', async (req: Request, res: Response) => {
  const { body, headers, ip, method, path } = req
  const { 'proxy-url': proxyUrl } = headers
  const ipString = ip.includes(':') ? `[${ip}]` : ip
  delete headers['content-length']
  delete headers['proxy-url']
  delete headers.connection
  delete headers.host

  if (proxyUrl == null) {
    res.status(400).send('No proxy-url specified in headers')
    return
  }

  const url: RequestInfo = `${proxyUrl}${path}`
  const init: RequestInit = {
    method,
    headers: {...headers,
      'X-Forwarded-For': ipString,
      'Forwarded': `for=${ipString}`
    } as { [key: string]: string },
    body: JSON.stringify(body)
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
