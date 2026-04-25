import cron from 'node-cron'
import { contractClient } from '../contract/client.js'

const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60

export function startMonthlyResetJob() {
  const schedule = process.env.MONTHLY_RESET_CRON || '0 0 1 * *'
  console.log(`Monthly free-tier reset scheduled: ${schedule}`)

  cron.schedule(schedule, async () => {
    console.log(`[cron] Running monthly free-tier reset — ${new Date().toISOString()}`)
    try {
      const sellers = await contractClient.getAllSellerAddresses()
      const now = Math.floor(Date.now() / 1000)
      let resetCount = 0

      for (const seller of sellers) {
        try {
          const [, , periodStart, isActive] = await contractClient.getFreeTierStatus(seller)
          if (!isActive) continue
          if (Number(periodStart) > now - ONE_MONTH_SECONDS) continue

          const receipt = await contractClient.resetFreeTier(seller)
          console.log(`[cron] Reset ${seller} — tx: ${receipt.hash}`)
          resetCount++
        } catch (err) {
          console.error(`[cron] Failed to reset ${seller}:`, err)
        }
      }

      console.log(`[cron] Monthly reset complete. Reset ${resetCount}/${sellers.length} sellers.`)
    } catch (err) {
      console.error('[cron] Monthly reset job error:', err)
    }
  })
}
