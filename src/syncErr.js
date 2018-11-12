import _ from 'lodash'
import Promise from 'bluebird'
import Er from './models/er'
import * as utils from './utils'
import { FACTORY } from './config'

export const parse = (startBlock, endBlock, page = 1, limit = 500) => {
	const startInfo = startBlock + ((page - 1) * limit)
	if (startInfo > endBlock) {
		return Promise.resolve(true)
	}
	return utils.getTxInternalList(FACTORY, startBlock, endBlock, page, limit)
		.then((txs) => {
			const ps = []
			if (txs.length > 0) {
				const txsError = _.filter(txs, { isError: '1' })
				txsError.forEach((tx) => {
					ps.push(utils.erSave({ tx: tx.hash, block: tx.blockNumber }))
				});
			} else {
				return false
			}
			return Promise.all(ps)
		})
		.then((result) => {
			if (result === false) {
				return true
			} else {
				return parse(startBlock, endBlock, (page + 1), limit)
			}
		})
		.catch((e) => {
      console.log('sync error', startBlock);
      console.log(e);
		})
}

const sync = () => {
	const endBlock = utils.getLastBlock()
	return Er.findOne().select('block').sort({ block: 'desc' }).exec()
		.then((row) => {
			let startBlock = 0
			if (row !== null) {
				startBlock = row.block + 1
			}
			return parse(startBlock, endBlock)
		})
		.then(() => {
			const lastBlock = utils.getLastBlock()
			if (lastBlock !== endBlock) {
				return sync()
			} else {
				return true
			}
		})
}
export default sync
