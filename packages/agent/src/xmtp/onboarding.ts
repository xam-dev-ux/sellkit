import type { Conversation } from '@xmtp/node-sdk'
import { type OnboardingState, type ServiceCategory, SUGGESTED_PRICES, CATEGORY_LABELS } from '@sellkit/shared'
import { ethers } from 'ethers'
import { contractClient } from '../contract/client.js'
import { registerService } from '../endpoints/engine.js'

// In-progress onboarding sessions keyed by address
const sessions = new Map<string, OnboardingState>()

const CATEGORY_KEYWORDS: Record<string, ServiceCategory> = {
  'trading': 'trading-signals',
  'signal': 'trading-signals',
  'price': 'market-data',
  'gas': 'market-data',
  'market': 'market-data',
  'wallet': 'wallet-analysis',
  'risk': 'wallet-analysis',
  'analysis': 'wallet-analysis',
  'data': 'datasets',
  'dataset': 'datasets',
  'csv': 'datasets',
  'code': 'code-execution',
  'execute': 'code-execution',
  'run': 'code-execution',
  'research': 'research',
}

function inferCategory(text: string): ServiceCategory {
  const lower = text.toLowerCase()
  for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(kw)) return cat
  }
  return 'other'
}

function extractServiceInfo(text: string): { name: string; description: string; category: ServiceCategory } {
  const lines = text.trim().split('\n')
  const name = lines[0].slice(0, 60)
  const description = text.trim()
  const category = inferCategory(text)
  return { name, description, category }
}

export async function handleOnboarding(
  conversation: Conversation,
  senderAddress: string,
  message: string
): Promise<boolean> {
  let state = sessions.get(senderAddress)

  // New user — start onboarding
  if (!state) {
    sessions.set(senderAddress, { step: 1 })
    await conversation.sendText(
      `hey, i'm sellkit — turn what you know into an x402 service that AI agents can discover and pay for automatically.\n\nwhat do you want to sell?`
    )
    return true
  }

  switch (state.step) {
    case 1: {
      // Received service description
      const { name, description, category } = extractServiceInfo(message)
      const suggestedPrice = SUGGESTED_PRICES[category]
      state.serviceName = name
      state.serviceDescription = description
      state.category = category
      state.step = 2
      sessions.set(senderAddress, state)

      await conversation.sendText(
        `got it — "${name}" (${CATEGORY_LABELS[category]})\n\nwhat should agents pay per request?\n\nsuggested: $${suggestedPrice} USDC\n\nreply with a price in USDC (e.g. "0.05")`
      )
      return true
    }

    case 2: {
      // Received price
      const price = parseFloat(message.replace(/[^0-9.]/g, ''))
      if (isNaN(price) || price <= 0) {
        await conversation.sendText('please enter a valid price in USDC, e.g. "0.05"')
        return true
      }
      state.priceUsdc = price
      state.step = 3
      sessions.set(senderAddress, state)

      await conversation.sendText(
        `$${price} USDC per request ✓\n\nhow do you deliver the service?\n\n[1] automatic — you have an existing API or script\n[2] manual — you'll reply via XMTP each time an agent pays\n\nreply with 1 or 2`
      )
      return true
    }

    case 3: {
      // Received delivery mode
      const isManual = message.trim() === '2' || message.toLowerCase().includes('manual')
      state.deliveryMode = isManual ? 'manual' : 'automatic'
      state.step = 4
      sessions.set(senderAddress, state)

      await conversation.sendText(
        `${isManual ? 'manual delivery' : 'automatic delivery'} ✓\n\nwhat wallet should receive your USDC payments?\n\nshare your Base wallet address (0x...) or your basename (e.g. alice.base.eth)\n\ntip: register a free basename at base.org/names`
      )
      return true
    }

    case 4: {
      // Received wallet
      const wallet = message.trim()
      const isAddress = /^0x[0-9a-fA-F]{40}$/.test(wallet)
      const isBasename = wallet.endsWith('.base.eth') || wallet.endsWith('.eth')

      if (!isAddress && !isBasename) {
        await conversation.sendText('please share a valid wallet address (0x...) or basename')
        return true
      }

      state.walletAddress = wallet
      state.step = 5
      sessions.set(senderAddress, state)

      const feeConfig = await contractClient.getFeeConfig()
      const feePercent = Number(feeConfig.globalFeePercent) / 100

      await conversation.sendText(
        `almost there!\n\nservice: ${state.serviceName}\ncategory: ${CATEGORY_LABELS[state.category!]}\nprice: $${state.priceUsdc} USDC/request\ndelivery: ${state.deliveryMode}\nwallet: ${wallet}\nfee: ${feePercent}% platform fee (first 1,000 tx/month free)\n\n[Launch my service] — reply "launch"\n[Edit details] — reply "edit"\n[Cancel] — reply "cancel"`
      )
      return true
    }

    case 5: {
      const cmd = message.toLowerCase().trim()

      if (cmd === 'cancel') {
        sessions.delete(senderAddress)
        await conversation.sendText('onboarding cancelled. message me any time to start again.')
        return true
      }

      if (cmd === 'edit') {
        sessions.set(senderAddress, { step: 1 })
        await conversation.sendText('starting over — what do you want to sell?')
        return true
      }

      if (cmd !== 'launch' && !cmd.includes('launch')) {
        await conversation.sendText('reply "launch" to go live, "edit" to change details, or "cancel" to stop.')
        return true
      }

      // Launch the service
      try {
        await conversation.sendText('launching your service onchain...')
        if (!state.serviceName || !state.serviceDescription || !state.category || !state.priceUsdc || !state.deliveryMode || !state.walletAddress) {
          await conversation.sendText('missing required fields. please start over.')
          sessions.delete(senderAddress)
          return true
        }
        await launchService(conversation, senderAddress, state as CompleteOnboardingState)
      } catch (err: any) {
        console.error('Launch error:', err)
        await conversation.sendText(`something went wrong: ${err.message}\n\nplease try again or contact support.`)
      }

      sessions.delete(senderAddress)
      return true
    }
  }

  return false
}

interface CompleteOnboardingState {
  step: 5
  serviceName: string
  serviceDescription: string
  category: ServiceCategory
  priceUsdc: number
  deliveryMode: 'automatic' | 'manual'
  walletAddress: string
}

async function launchService(
  conversation: Conversation,
  senderAddress: string,
  state: CompleteOnboardingState
) {
  const baseUrl = process.env.AGENT_BASE_URL || 'https://sellkit.railway.app'
  const contractAddress = process.env.CONTRACT_ADDRESS!

  // 1. Register seller (using operator wallet for gas, but seller is msg.sender-equivalent)
  //    In production, seller signs registration via their wallet. Here operator calls on their behalf.
  const isRegistered = await contractClient.isRegistered(senderAddress)
  let registerTxHash = ''

  if (!isRegistered) {
    const receipt = await contractClient.registerSeller(state.walletAddress, '')
    registerTxHash = receipt.hash
  }

  // 2. Build serviceId
  const serviceId = contractClient.serviceIdFromName(senderAddress, state.serviceName)
  const endpoint = `${baseUrl}/api/serve/${serviceId}`
  const skillFileUrl = `${baseUrl}/.well-known/${serviceId}/SKILL.md`

  // 3. Create service onchain
  const priceInUnits = BigInt(Math.round(state.priceUsdc * 1e6))
  const categoryIndex = categoryToIndex(state.category)

  const svcReceipt = await contractClient.createServiceFor(
    new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY!, contractClient.provider),
    {
      serviceId,
      name: state.serviceName,
      description: state.serviceDescription,
      endpoint,
      skillFileUrl,
      priceUsdc: priceInUnits,
      category: categoryIndex,
    }
  )

  // 4. Register skill file in memory
  const feeConfig = await contractClient.getFeeConfig()
  registerService({
    serviceId,
    serviceName: state.serviceName,
    description: state.serviceDescription,
    priceUsdc: state.priceUsdc,
    category: state.category,
    deliveryMode: state.deliveryMode,
    sellerAddress: senderAddress,
    contractAddress,
    feePercent: Number(feeConfig.globalFeePercent),
    baseUrl,
  })

  // 5. Get free tier status
  const [ftUsed, ftLimit] = await contractClient.getFreeTierStatus(senderAddress)

  await conversation.sendText(
    `✓ your service is live\n\nendpoint: ${endpoint}\nskill file: ${skillFileUrl}\nfree tier: ${ftLimit.toString()} transactions/month (${ftUsed.toString()} used)\n\nagents can now discover and pay for your service automatically.\ntx: https://basescan.org/tx/${svcReceipt.hash}`
  )
}

const CATEGORY_MAP: ServiceCategory[] = [
  'trading-signals',
  'market-data',
  'wallet-analysis',
  'datasets',
  'code-execution',
  'research',
  'other',
]

function categoryToIndex(cat: ServiceCategory): number {
  return CATEGORY_MAP.indexOf(cat)
}
