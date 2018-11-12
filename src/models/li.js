import db from './db'

const liSchema = db.Schema({
  _id: db.Schema.Types.ObjectId,
  blockCreate: Number,
  txCreate: String,
  blockFin: Number,
  txFin: String,
  isFinalized: Boolean,
  gasFactory: Number,
  gasCreate: Number,
  gasFin: Number,
  address: String,
  created: {
    type: Date,
    default: Date.now
  }
});

const Li = db.model('Li', liSchema);

Li.create = (item) => {
  const block = new Li({
    _id: new db.Types.ObjectId(),
    ...item
  });
  return block.save()
}

export default Li
