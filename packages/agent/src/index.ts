import 'dotenv/config'
import { buildApiServer } from './api/server.js'
import { startXmtpAgent } from './xmtp/agent.js'
import { startMonthlyResetJob } from './jobs/monthlyReset.js'

const PORT = parseInt(process.env.PORT || '3001', 10)

async function main() {
  // Start REST API + endpoint engine
  const app = buildApiServer()
  app.listen(PORT, () => {
    console.log(`SELLKIT agent API listening on port ${PORT}`)
  })

  // Start XMTP message handler (non-blocking)
  startXmtpAgent().catch(err => {
    console.error('XMTP agent error:', err)
  })

  // Start monthly free-tier reset cron
  startMonthlyResetJob()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
