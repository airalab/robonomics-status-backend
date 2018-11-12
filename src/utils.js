import Web3 from 'web3'
import axios from 'axios'
import _ from 'lodash'
import Promise from 'bluebird'
import PubSub from 'pubsub-js'
import Li from './models/li'
import Er from './models/er'
import ABI_TOKEN from './abi/token'
import ABI_LIABILITY from './abi/liability'
import ABI_FACTORY from './abi/factory'
import { XRT, FACTORY, PARITY, ETHERSCAN, ETHERSCAN_KEY, EVENT_BUILDER_LIABILITY, EVENT_FINALIZED, EVENT_TRANSFER } from './config'

function promiseDebounce(fn, delay, count) {
  let working = 0
  const queue = []
  function work() {
    if ((queue.length === 0) || (working === count)) return
    working += 1
    Promise.delay(delay).tap(() => { working -= 1 }).then(work)
    const next = queue.shift()
    next[2](fn.apply(next[0], next[1]))
  }
  return function debounced(...args) {
    return new Promise((resolve) => {
      queue.push([this, args, resolve])
      if (working < count) work()
    })
  }
}

axios.get = promiseDebounce(axios.get, 1000, 4)

export const providerWeb3 = new Web3.providers.HttpProvider(PARITY)
export const web3 = new Web3(providerWeb3);

export const getTxInternalList = (address, startblock = 0, endblock = 'latest', page = 1, offset = 0, sort = 'asc') => {
	return axios.get(ETHERSCAN + '/api?module=account&action=txlistinternal&address=' + address +
		'&startblock=' + startblock +
		'&endblock=' + endblock +
		'&page=' + page +
		'&offset=' + offset +
		'&sort=' + sort +
		'&apikey=' + ETHERSCAN_KEY)
		.then((response) => response.data.result)
}

export const getLastPriceEth = () => {
	return axios.get(ETHERSCAN + '/api?module=stats&action=ethprice&apikey=' + ETHERSCAN_KEY)
		.then((response) => response.data.result.ethusd)
}

export const getTxsByBlock = (num) => {
	const block = web3.eth.getBlock(num);
	return block.transactions
}

export const getTxsByBlockA = (num) => {
	return Promise.promisify(web3.eth.getBlock)(num)
		.then((block) => {
			if (!_.has(block, 'transactions')) {
				// console.log('no transactions', num);
				return []
			}
			return block.transactions
		})
}

export const getTx = (hash) => {
	return web3.eth.getTransaction(hash)
}

export const getTxA = (hash) => {
	return Promise.promisify(web3.eth.getTransaction)(hash)
}

export const getTxReceipt = (hash) => {
	return web3.eth.getTransactionReceipt(hash)
}

export const getTxReceiptA = (hash) => {
	return Promise.promisify(web3.eth.getTransactionReceipt)(hash)
}

export const getLastBlock = () => {
	return web3.eth.blockNumber
}

let lLastBlock
let lOldBlock
export const listenLastBlock = () => {
	const newLLastBlock = web3.eth.blockNumber
	if (newLLastBlock !== lLastBlock) {
		if (lLastBlock > 0) {
			lOldBlock = lLastBlock + 1
		} else {
			lOldBlock = newLLastBlock
		}
		lLastBlock = newLLastBlock
		for (let i = lOldBlock; i <= lLastBlock; i++) {
			PubSub.publish('lastBlock', i);
		}
	}
	setTimeout(listenLastBlock, 1000);
}

export const totalSupply = () => {
	var weth = web3.eth.contract(ABI_TOKEN).at(XRT);
	var decimals = Number(weth.decimals())
	var totalSupply = Number(weth.totalSupply())
	return totalSupply / Math.pow(10, decimals)
}

export const totalSupplyA = () => {
	return new Promise((resolve) => {
		resolve(totalSupply())
	})
}

export const getStartBlock = (endBlock, type = 'b') => {
	let startBlock = 0
	if (type === 'b') {
		startBlock = endBlock
	} else if (type === 'd' || type === 'w' || type === 'm') {
		const dayBlocks = 6075
		let blocks = dayBlocks
		if (type === 'd') {
			blocks = dayBlocks
		} else if (type === 'w') {
			blocks = dayBlocks * 7
		} else if (type === 'm') {
			blocks = dayBlocks * 7 * 30
		}
		startBlock = endBlock - blocks
	}
	return startBlock
}

export const getFullGas = (blocks) => {
	let where = {}
	if (blocks.startBlock === blocks.endBlock) {
		where = { blockCreate: blocks.endBlock }
	} else {
		where = { blockCreate: { $gte: blocks.startBlock, $lt: blocks.endBlock } }
	}
	return Li.aggregate().match(where).group({
		_id : null,
		gas : {
			$sum : { $add: ["$gasCreate", "$gasFin"] }
		}
	})
		.then((row) => {
			if (row.length > 0) {
				return Number(row[0].gas)
			}
			return 0
		})
}

export const getFinGas = (blocks) => {
	let where = {}
	if (blocks.startBlock === blocks.endBlock) {
		where = { blockFin: blocks.endBlock }
	} else {
		where = { blockFin: { $gte: blocks.startBlock, $lt: blocks.endBlock } }
	}
	return Li.aggregate().match(where).group({
		_id : null,
		gas : {
			$sum : { $add: ["$gasCreate", "$gasFin"] }
		}
	})
		.then((row) => {
			if (row.length > 0) {
				return Number(row[0].gas)
			}
			return 0
		})
}

export const getCreateCount = (blocks) => {
	let where = {}
	if (blocks.startBlock === blocks.endBlock) {
		where = { blockCreate: blocks.endBlock }
	} else {
		where = { blockCreate: { $gte: blocks.startBlock, $lt: blocks.endBlock } }
	}
	return Li.count(where)
}

export const getFinCount = (blocks) => {
	let where = {}
	if (blocks.startBlock === blocks.endBlock) {
		where = { blockFin: blocks.endBlock }
	} else {
		where = { blockFin: { $gte: blocks.startBlock, $lt: blocks.endBlock } }
	}
	return Li.count(where)
}

export const getErrCount = (blocks) => {
	let where = {}
	if (blocks.startBlock === blocks.endBlock) {
		where = { block: blocks.endBlock }
	} else {
		where = { block: { $gte: blocks.startBlock, $lt: blocks.endBlock } }
	}
	return Er.count(where)
}

export const liSave = (data) => {
	return Li.findOne().select('address').where({ address: data.address }).exec()
		.then((row) => {
			if (row === null) {
				return Li.create(data)
			} else {
				return row.update({ blockFin: data.blockFin, txFin: data.txFin, isFinalized: data.isFinalized, gasFactory: data.gasFactory, gasFin: data.gasFin })
			}
		})
}

export const erSave = (data) => {
	return Er.findOne().select('tx').where({ tx: data.tx }).exec()
		.then((row) => {
			if (row === null) {
				return Er.create(data)
			} else {
				return true
			}
		})
}

export const getLastLi = (limit = 5) => {
	return Li.find().sort({ blockCreate: 'desc' }).limit(limit).exec()
}

export const getLastLiFin = (limit = 5) => {
	return Li.find().where({ isFinalized: true }).sort({ blockCreate: 'desc' }).limit(limit).exec()
}

export const getWn = () => {
	const factory = web3.eth.contract(ABI_FACTORY).at(FACTORY);
	return Number(factory.wnFromGas(1))
}

export const getFullInfo = (lastBlock) => {
	const types = ['b', 'd', 'w', 'm']
	const ps = []
	types.forEach((type) => {
		const startBlock = getStartBlock(lastBlock, type)
		ps.push(getFullGas({ startBlock, endBlock: lastBlock }))
		ps.push(getFinGas({ startBlock, endBlock: lastBlock }))
		ps.push(getCreateCount({ startBlock, endBlock: lastBlock }))
		ps.push(getFinCount({ startBlock, endBlock: lastBlock }))
		ps.push(getErrCount({ startBlock, endBlock: lastBlock }))
	})
	ps.push(getLastLi())
	ps.push(totalSupplyA())
	ps.push(getWn())
	return Promise.all(ps)
		.then((result) => {
			return {
				lastBlock,
				gas: {
          full: {
  					b: result[0],
  					d: result[5],
  					w: result[10],
  					m: result[15]
  				},
  				fin: {
  					b: result[1],
  					d: result[6],
  					w: result[11],
  					m: result[16]
  				}
				},
				li: {
          create: {
  					b: result[2],
  					d: result[7],
  					w: result[12],
  					m: result[17]
  				},
  				fin: {
  					b: result[3],
  					d: result[8],
  					w: result[13],
  					m: result[18]
  				}
				},
				err: {
					b: result[4],
					d: result[9],
					w: result[14],
					m: result[19]
				},
				liability: result[20],
				totalSupply: result[21],
				wn: result[22]
			}
		})
}

export const isFinalized = (address) => {
	const li = web3.eth.contract(ABI_LIABILITY).at(address);
	return li.isFinalized()
}

export const gasLi = (address) => {
	const factory = web3.eth.contract(ABI_FACTORY).at(FACTORY);
	return Number(factory.gasUtilizing(address))
}

export const getBlockFin = (address) => {
	const liability = web3.eth.contract(ABI_LIABILITY).at(address);
	const token = liability.token()
	return axios.get(ETHERSCAN + '/api?module=logs' +
		'&action=getLogs' +
		'&fromBlock=0' +
		'&toBlock=9999999' +
		'&address=' + token +
		'&topic0=' + EVENT_TRANSFER +
		'&topic0_1_opr=and' +
		'&topic1=0x000000000000000000000000' + address.replace('0x', '') +
		'&apikey=' + ETHERSCAN_KEY)
		.then((response) => {
			if (response.data.result.length > 0) {
				return {
					address,
					tx: response.data.result[0].transactionHash,
					block: Number(response.data.result[0].blockNumber),
					gas: Number(response.data.result[0].gasUsed)
				}
			}
			return {
				address,
				tx: null,
				block: null,
				gas: 0
			}
		})
}

export const saveTxs = (txsAll) => {
	const contracts = {}
	const txs = _.compact(txsAll)
	txs.forEach((info, i) => {
		if (_.has(info, 'logs') && info.logs.length === 3 && info.logs[1].address.toLowerCase() === XRT.toLowerCase()
			&& info.logs[0].topics[0].toLowerCase() === EVENT_FINALIZED // emission
			&& info.logs[1].topics[0].toLowerCase() === EVENT_TRANSFER) { // transfer
			const address = '0x' + info.logs[1].topics[1].substring(info.logs[1].topics[1].length - 40)
			contracts[address] = {
				blockCreate: null,
				txCreate: null,
				blockFin: info.blockNumber,
				txFin: info.transactionHash,
				isFinalized: isFinalized(address),
				gasFactory: gasLi(address),
				gasCreate: 0,
				gasFin: info.gasUsed
			}
		} else if (_.has(info, 'logs') && info.logs.length > 0) {
			if (info.logs[0].topics[0] === EVENT_BUILDER_LIABILITY) {
				const address = '0x' + info.logs[0].topics[1].substring(info.logs[0].topics[1].length - 40)
				contracts[address] = {
					blockCreate: info.blockNumber,
					txCreate: info.transactionHash,
					blockFin: null,
					txFin: null,
					isFinalized: isFinalized(address),
					gasFactory: gasLi(address),
					gasCreate: info.gasUsed,
					gasFin: 0
				}
			}
		}
	})

	const fins = []
	_.forEach(contracts, (contract, address) => {
		if (contract.isFinalized && contract.blockFin === null) {
			fins.push(getBlockFin(address))
		}
	});
	return Promise.all(fins)
		.then((finsTx) => {
			finsTx.forEach((res) => {
				if (_.has(contracts, res.address)) {
					contracts[res.address] = {
						...contracts[res.address],
						blockFin: res.block,
						txFin: res.tx,
						gasFin: res.gas
					}
				}
			})

			const ps = []
			let gas = 0
			_.forEach(contracts, (contract, address) => {
				ps.push(liSave({ ...contract, address }))
			});
			if (ps.length > 0) {
				return Promise.all(ps)
			}
			return Promise.resolve(false)
		})
}

export const blockParse = (block) => {
	return getTxsByBlockA(block)
		.then((txs) => {
			const ps = []
			const psTo = []
			txs.forEach((tx) => {
				ps.push(getTxReceiptA(tx))
				psTo.push(getTxA(tx))
			});
			return Promise.join(Promise.all(ps), Promise.all(psTo))
		})
		.then((txs) => {
			const txsTo = _.map(txs[0], (item, i) => {
				if (item === null) {
					// console.log('skip tx by block', block);
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
					// console.log('skip tx', item.transactionHash);
					return
				}
				return {
					...item,
					to
				}
			})
			return saveTxs(txsTo)
		})
}
