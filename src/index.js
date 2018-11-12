import express from 'express'
import cors from 'cors'
import Socket from 'socket.io'
import PubSub from 'pubsub-js'
import Queue from 'better-queue'
import * as utils from './utils'
import { sync as syncDb } from './models/db'
import sync from './sync'
import syncErr, { parse as parseErr } from './syncErr'
import { PORT } from './config'
import createServer from './server'

const app = express()
const server = createServer(app)
const io = Socket(server)
app.use(cors())

app.get('/', (req, res) => {
  res.send('hello');
});

app.get('/start', (req, res) => {
  const lastBlock = utils.getLastBlock()
  utils.getFullInfo(lastBlock)
    .then((result) => {
      res.send({
        result
      });
    })
});

app.get('/last', (req, res) => {
  utils.getLastLiFin(1)
    .then((result) => {
      res.send({
        result
      });
    })
});

const queue = new Queue((input, cb) => {
  const lastBlock = input
  utils.blockParse(lastBlock)
    .then((r) => {
      if (r !== false) {
        utils.getFullInfo(lastBlock)
          .then((result) => {
            io.emit('gas', result.gas)
            io.emit('li', result.li)
            io.emit('err', result.err)
            io.emit('liability', result.liability)
            io.emit('totalSupply', result.totalSupply)
            io.emit('wn', result.wn)
          })
      }
      cb(null, true);
    })
    .catch((e) => {
      console.log(lastBlock, e);
      cb(null, false);
    })
})

const socketApp = () => {
  utils.listenLastBlock()
  syncErr()
    .then(() => {
      console.log('stop sync err')
    })
  sync()
    .then(() => {
      console.log('stop sync')
      PubSub.subscribe('lastBlock', (msg, lastBlock) => {
        queue.push(lastBlock)
      });
    })
  PubSub.subscribe('lastBlock', (msg, lastBlock) => {
    io.emit('lastBlock', lastBlock)
    parseErr(lastBlock, lastBlock)
  });
}

syncDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log('App listening on port ' + PORT);
      socketApp()
    });
  })
