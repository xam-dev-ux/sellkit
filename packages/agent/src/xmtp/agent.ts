import { Client, type Signer, type XmtpEnv } from '@xmtp/node-sdk'
import { ethers } from 'ethers'
import { handleOnboarding } from './onboarding.js'
import { handleCommand } from './commands.js'

export async function startXmtpAgent() {
  const walletKey = process.env.XMTP_WALLET_KEY
  const env = (process.env.XMTP_ENV || 'production') as XmtpEnv

  if (!walletKey) {
    console.warn('XMTP_WALLET_KEY not set — XMTP agent disabled')
    return
  }

  const wallet = new ethers.Wallet(walletKey)

  const signer: Signer = {
    type: 'EOA',
    getIdentifier: () => ({ identifier: wallet.address, identifierKind: 0 }),
    // SignMessage expects (message: string) => Promise<Uint8Array>
    signMessage: async (message: string) => {
      const sig = await wallet.signMessage(message)
      return ethers.getBytes(sig)
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = await Client.create(signer, { env, dbPath: null } as any)
  console.log(`XMTP agent started, inboxId: ${client.inboxId}`)

  await client.conversations.sync()
  const stream = await client.conversations.streamAllMessages()

  for await (const message of stream) {
    if (!message || message.senderInboxId === client.inboxId) continue

    const content = typeof message.content === 'string' ? message.content : ''
    if (!content.trim()) continue

    const senderAddress = message.senderInboxId
    console.log(`[XMTP] from ${senderAddress}: ${content.slice(0, 80)}`)

    const conversation = await client.conversations.getConversationById(message.conversationId)
    if (!conversation) continue

    try {
      const isCommand = await handleCommand(conversation as any, senderAddress, content)
      if (isCommand) continue
      await handleOnboarding(conversation as any, senderAddress, content)
    } catch (err) {
      console.error('[XMTP] handler error:', err)
      try {
        await (conversation as any).sendText('something went wrong. please try again.')
      } catch {}
    }
  }
}
