import db from './db'

const erSchema = db.Schema({
  _id: db.Schema.Types.ObjectId,
  block: Number,
  tx: String,
  created: {
    type: Date,
    default: Date.now
  }
});

const Er = db.model('Er', erSchema);

Er.create = (item) => {
  const er = new Er({
    _id: new db.Types.ObjectId(),
    ...item
  });
  return er.save()
}

export default Er
