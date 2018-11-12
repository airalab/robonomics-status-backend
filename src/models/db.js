import db from 'mongoose'
import Promise from 'bluebird'
import { DB_NAME } from '../config'

db.Promise = Promise;

export const sync = () => {
  return new Promise((resolve,reject) => {
    db.connect('mongodb://localhost/' + DB_NAME, err =>
    err ? reject(err) : resolve())
  })
}

export default db
