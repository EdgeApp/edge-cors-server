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
  const proxyDomain = req.headers.proxydomain
  delete req.headers.proxydomain
  delete req.headers['content-length']
  delete req.headers.connection
  delete req.headers.host

  if (proxyDomain == null) {
    res.status(400).send('No proxyDomain specified in headers')
    return
  }

  const url: RequestInfo = `${proxyDomain}${req.path}`
  const init: RequestInit = {
    method: req.method,
    headers: req.headers as { [key: string]: string },
    body: JSON.stringify(req.body)
  }

  try {
    const response: FetchResponse = await fetch(url, init)
    const body = await response.text()
    // Forward the headers
    response.headers.forEach((value, name) => {
      if (name === 'transfer-encoding') return
      res.header(name, value)
    })
    res.send(body)
  } catch (err) {
    console.error(err)
    res.status(500).send('Error while making request')
  }
})

app.listen(8008, () => {
  console.log('Listening on port 8008')
})
