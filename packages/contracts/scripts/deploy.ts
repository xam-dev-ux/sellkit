// eslint-disable-next-line @typescript-eslint/no-var-requires
const hre = require('hardhat')
const { ethers, run } = hre
import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const INITIAL_FEE_PERCENT = 500   // 5 %
const FREE_TIER_LIMIT = 1000

async function main() {
  const treasury = process.env.TREASURY_ADDRESS
  if (!treasury) throw new Error('TREASURY_ADDRESS not set in .env')

  const [deployer] = await ethers.getSigners()
  console.log('Deploying with:', deployer.address)
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH')

  const Factory = await ethers.getContractFactory('SellKitRegistry')
  const contract = await Factory.deploy(
    USDC_ADDRESS,
    treasury,
    INITIAL_FEE_PERCENT,
    FREE_TIER_LIMIT
  )
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log('SellKitRegistry deployed to:', address)
  console.log('Tx hash:', contract.deploymentTransaction()?.hash)

  // Persist address and ABI for other packages
  const deploymentDir = path.resolve(__dirname, '../deployments')
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir)

  const artifact = await ethers.getContractFactory('SellKitRegistry')
  fs.writeFileSync(
    path.join(deploymentDir, 'base-mainnet.json'),
    JSON.stringify({ address, abi: artifact.interface.formatJson() }, null, 2)
  )
  console.log('Deployment saved to deployments/base-mainnet.json')

  // Wait a few blocks then verify
  console.log('Waiting 30s before Basescan verification...')
  await new Promise(r => setTimeout(r, 30_000))

  try {
    await run('verify:verify', {
      address,
      constructorArguments: [USDC_ADDRESS, treasury, INITIAL_FEE_PERCENT, FREE_TIER_LIMIT],
    })
    console.log('Verified on Basescan')
  } catch (e: any) {
    console.warn('Verification failed (may already be verified):', e.message)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
