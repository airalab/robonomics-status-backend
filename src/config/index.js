export * from './prod'
// export * from './local'

export const EVENT_BUILDER_LIABILITY = '0xf0f0e2354315aae25080baa26761b4ef52d621c91208fb0edde9e3f3fade3219'
export const EVENT_FINALIZED = '0x7d5242f52c478159b4963f0898012c593d0786bfa3bce2e9bb2f073b068caee0'
export const EVENT_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const SYNC_COUNT = 50
export const SSL_ENABLE = process.env.SSL_ENABLE || false
export const SSL = {
  key: process.env.SSL_KEY || '',
  cer: process.env.SSL_CER || ''
}
export const PARITY = process.env.PARITY || 'http://127.0.0.1:8545/'
export const PORT = process.env.PORT || 3004
