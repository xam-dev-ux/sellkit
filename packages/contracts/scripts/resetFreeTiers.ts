// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ethers } = require('hardhat')
import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

async function main() {
  const deploymentPath = path.resolve(__dirname, '../deployments/base-mainnet.json')
  if (!fs.existsSync(deploymentPath)) throw new Error('Run deploy.ts first')
  const { address } = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'))

  const [operator] = await ethers.getSigners()
  const contract = await ethers.getContractAt('SellKitRegistry', address, operator)

  // Collect all seller addresses via SellerRegistered events
  const filter = contract.filters.SellerRegistered()
  const events = await contract.queryFilter(filter, 0, 'latest')
  const sellers = [...new Set(events.map((e: any) => e.args.seller as string))]

  const now = new Date()
  console.log(`Monthly free-tier reset — ${now.toISOString()}`)
  console.log(`Found ${sellers.length} sellers`)

  const oneMonthAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

  let resetCount = 0
  for (const seller of sellers) {
    const [, , periodStart, isActive] = await contract.getFreeTierStatus(seller)
    if (!isActive) { console.log(`  Skipping inactive: ${seller}`); continue }
    if (Number(periodStart) > oneMonthAgo) { console.log(`  Already reset: ${seller}`); continue }

    const tx = await contract.resetFreeTier(seller)
    await tx.wait()
    console.log(`  Reset ${seller} — tx: ${tx.hash}`)
    resetCount++
  }

  console.log(`\nDone. Reset ${resetCount} / ${sellers.length} sellers.`)
}

main().catch(e => { console.error(e); process.exit(1) })
