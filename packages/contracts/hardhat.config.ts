import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || 'https://mainnet-preconf.base.org',
      accounts: process.env.DEPLOYER_PRIVATE_KEY?.length === 66
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : process.env.OPERATOR_PRIVATE_KEY?.length === 66
          ? [process.env.OPERATOR_PRIVATE_KEY]
          : [],
      chainId: 8453,
    },
  },
  // @ts-ignore — etherscan key is injected by @nomicfoundation/hardhat-verify (part of hardhat-toolbox)
  etherscan: {
    // Single string = Etherscan V2 unified API (works for all chains incl. Base with chainid param)
    apiKey: process.env.BASESCAN_API_KEY || '',
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=8453',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}

export default config
