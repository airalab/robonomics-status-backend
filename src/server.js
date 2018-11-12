import fs from 'fs'
import https from 'https'
import http from 'http'
import { SSL_ENABLE, SSL } from './config'

export default (app) => {
  if (SSL_ENABLE) {
    const options = {
      key: fs.readFileSync(SSL.key),
      cert: fs.readFileSync(SSL.cer)
    };
    return https.createServer(options, app);
  }
  return http.createServer(app);
}
