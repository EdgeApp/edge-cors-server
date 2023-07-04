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
  const { 'proxy-url': proxyUrl } = req.headers
  delete req.headers['content-length']
  delete req.headers['proxy-url']
  delete req.headers.connection
  delete req.headers.host

  if (proxyUrl == null) {
    res.status(400).send('No proxy-url specified in headers')
    return
  }

  const url: RequestInfo = `${proxyUrl}${req.path}`
  const init: RequestInit = {
    method: req.method,
    headers: req.headers as { [key: string]: string },
    body: JSON.stringify(req.body)
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
