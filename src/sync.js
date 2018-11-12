import Promise from 'bluebird'
import _ from 'lodash'
import Li from './models/li'
import * as utils from './utils'
import { FACTORY, SYNC_COUNT } from './config'

const parse = (startBlock, endBlock, page = 1, limit = 50) => {
	const startInfo = startBlock + ((page - 1) * limit)
	return utils.getTxInternalList(FACTORY, startBlock, endBlock, page, limit)
		.then((txs) => {
			if (txs.length === 0) {
				return Promise.reject(new Error('no tx'))
			}
			const ps = []
			const psTo = []
			txs.forEach((tx) => {
				ps.push(utils.getTxReceiptA(tx.hash))
				psTo.push(utils.getTxA(tx.hash))
			});
			return Promise.join(Promise.all(ps), Promise.all(psTo))
		})
		.then((txs) => {
			const txsTo = _.map(txs[0], (item, i) => {
				if (item === null) {
					return
				}
				let to = ''
				if (_.has(item, 'to') && !_.isEmpty(item.to)) {
					to = item.to
				} else if (_.has(item, 'contractAddress') && !_.isEmpty(item.contractAddress)) {
					to = item.contractAddress
				} else if (item.transactionHash === txs[1][i].hash && _.has(txs[1][i], 'to') && !_.isEmpty(txs[1][i].to)) {
					to = txs[1][i].to
				}
				if (_.isEmpty(to)) {
					return
				}
				return {
					...item,
					to
				}
			})
			const txsAll = _.compact(txsTo)
			if (txsAll.length === 0) {
				return true
			}
			return utils.saveTxs(txsAll)
		})
		.then((result) => {
			if (result === false) {
				return endBlock + 1
			} else {
				return parse(startBlock, endBlock, (page + 1), limit)
			}
		})
		.catch((e) => {
			console.log(e.toString());
			console.log('stop parse', startBlock, endBlock, page);
			return endBlock + 1
		})
}

const sync = (block = 0) => {
	const endBlock = utils.getLastBlock()
	return Li.findOne().select('blockCreate').sort({ blockCreate: 'desc' }).exec()
		.then((row) => {
			let startBlock = block
			if (row !== null) {
				startBlock = row.blockCreate + 1
			}
			return parse(startBlock, endBlock, 1, SYNC_COUNT)
		})
		.then((b) => {
			const lastBlock = utils.getLastBlock()
			if (lastBlock !== endBlock) {
				return sync(b)
			} else {
				return true
			}
		})
}
export default sync
