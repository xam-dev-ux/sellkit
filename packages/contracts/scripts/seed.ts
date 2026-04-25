// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ethers } = require('hardhat')
import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const SEED_SELLERS = [
  {
    walletAddress: '0x1111111111111111111111111111111111111111',
    basename: 'alice.base.eth',
    services: [
      {
        name: 'ETH/USDC Signal Feed',
        description: 'Real-time directional signals for ETH/USDC based on on-chain order flow and funding rates. Updated every 15 minutes.',
        priceUsdc: 50000n,    // 0.05 USDC (6 decimals)
        category: 0,          // trading-signals
      },
    ],
  },
  {
    walletAddress: '0x2222222222222222222222222222222222222222',
    basename: 'bob.base.eth',
    services: [
      {
        name: 'Base Gas Oracle',
        description: 'Current gas price data for Base mainnet including base fee, priority fee, and 7-day trend analysis.',
        priceUsdc: 1000n,     // 0.001 USDC
        category: 1,          // market-data
      },
    ],
  },
  {
    walletAddress: '0x3333333333333333333333333333333333333333',
    basename: 'carol.base.eth',
    services: [
      {
        name: 'Wallet Risk Score',
        description: 'On-chain risk scoring for any EVM wallet. Returns a 0–100 score based on transaction history, DeFi exposure, and contract interactions.',
        priceUsdc: 20000n,    // 0.02 USDC
        category: 2,          // wallet-analysis
      },
    ],
  },
  {
    walletAddress: '0x4444444444444444444444444444444444444444',
    basename: 'dave.base.eth',
    services: [
      {
        name: 'DeFi Protocol TVL Dataset',
        description: 'Historical TVL snapshots for top 50 DeFi protocols on Base. CSV export, updated daily.',
        priceUsdc: 100000n,   // 0.10 USDC
        category: 3,          // datasets
      },
    ],
  },
  {
    walletAddress: '0x5555555555555555555555555555555555555555',
    basename: 'eve.base.eth',
    services: [
      {
        name: 'Solidity Snippet Runner',
        description: 'Execute arbitrary Solidity snippets in a sandboxed Base fork. Returns execution trace and gas usage.',
        priceUsdc: 20000n,    // 0.02 USDC
        category: 4,          // code-execution
      },
    ],
  },
]

async function main() {
  const deploymentPath = path.resolve(__dirname, '../deployments/base-mainnet.json')
  if (!fs.existsSync(deploymentPath)) throw new Error('Run deploy.ts first')
  const { address } = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))

  const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  if (!operatorKey || operatorKey.length !== 66) throw new Error('OPERATOR_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY required')
  const funder = new ethers.Wallet(operatorKey, ethers.provider)
  console.log('Funding from:', funder.address)
  const balance = await ethers.provider.getBalance(funder.address)
  console.log('Balance:', ethers.formatEther(balance), 'ETH')

  const contract = await ethers.getContractAt('SellKitRegistry', address, funder)
  const baseUrl = process.env.AGENT_BASE_URL || 'https://sellkit.railway.app'

  for (const seller of SEED_SELLERS) {
    console.log('\nRegistering seller:', seller.basename)

    const sellerWallet = ethers.Wallet.createRandom().connect(ethers.provider)

    // Fund seller wallet with enough ETH for 2 transactions
    const fundTx = await funder.sendTransaction({
      to: sellerWallet.address,
      value: ethers.parseEther('0.001'),
    })
    await fundTx.wait()

    const tx1 = await (contract.connect(sellerWallet) as any).registerSeller(
      seller.walletAddress,
      seller.basename
    )
    await tx1.wait()
    console.log('  Registered:', tx1.hash)

    for (const svc of seller.services) {
      const serviceId = ethers.id(`${seller.basename}:${svc.name}`) as `0x${string}`
      const endpoint = `${baseUrl}/api/serve/${serviceId}`
      const skillFileUrl = `${baseUrl}/.well-known/${serviceId}/SKILL.md`

      const tx2 = await (contract.connect(sellerWallet) as any).createService(
        serviceId,
        svc.name,
        svc.description,
        endpoint,
        skillFileUrl,
        svc.priceUsdc,
        svc.category
      )
      await tx2.wait()
      console.log('  Service created:', svc.name, tx2.hash)
    }
  }

  console.log('\nSeed complete.')
}

main().catch(e => { console.error(e); process.exit(1) })
