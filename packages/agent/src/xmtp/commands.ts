import type { Conversation } from '@xmtp/node-sdk'
import { CATEGORY_LABELS } from '@sellkit/shared'
import { contractClient } from '../contract/client.js'
import { ethers } from 'ethers'

export async function handleCommand(
  conversation: Conversation,
  senderAddress: string,
  message: string
): Promise<boolean> {
  const lower = message.toLowerCase().trim()

  if (lower === 'my services') {
    return handleMyServices(conversation, senderAddress)
  }
  if (lower === 'my earnings') {
    return handleMyEarnings(conversation, senderAddress)
  }
  if (lower.startsWith('update price ')) {
    return handleUpdatePrice(conversation, senderAddress, message)
  }
  if (lower.startsWith('pause service ')) {
    return handlePauseService(conversation, senderAddress, message)
  }
  if (lower === 'stats') {
    return handleStats(conversation)
  }
  if (lower === 'how does billing work') {
    return handleBillingInfo(conversation, senderAddress)
  }

  return false
}

async function handleMyServices(conversation: Conversation, address: string): Promise<boolean> {
  const services = await contractClient.getSellerServices(address)
  if (!services.length) {
    await conversation.sendText('you have no active services. describe what you want to sell to get started.')
    return true
  }
  const lines = ['your services:\n']
  for (const svc of services) {
    const price = (Number(svc.priceUsdc) / 1e6).toFixed(4)
    const revenue = (Number(svc.totalRevenueUsdc) / 1e6).toFixed(2)
    lines.push(
      `• ${svc.name}\n  id: ${svc.serviceId}\n  price: $${price} USDC\n  calls: ${svc.totalCalls}\n  revenue: $${revenue} USDC\n  status: ${svc.active ? 'active' : 'paused'}`
    )
  }
  await conversation.sendText(lines.join('\n'))
  return true
}

async function handleMyEarnings(conversation: Conversation, address: string): Promise<boolean> {
  const services = await contractClient.getSellerServices(address)
  const [ftUsed, ftLimit, , isActive] = await contractClient.getFreeTierStatus(address)

  let totalRevenue = 0n
  let totalCalls = 0n
  for (const svc of services) {
    totalRevenue += BigInt(svc.totalRevenueUsdc)
    totalCalls += BigInt(svc.totalCalls)
  }

  const feeConfig = await contractClient.getFeeConfig()
  const feePercent = (Number(feeConfig.globalFeePercent) / 100).toFixed(1)
  const revenueDisplay = (Number(totalRevenue) / 1e6).toFixed(2)
  const freeTierLeft = Number(ftLimit) - Number(ftUsed)

  await conversation.sendText(
    `your earnings:\n\ntotal revenue: $${revenueDisplay} USDC\ntotal calls: ${totalCalls}\nfree tier remaining: ${freeTierLeft} / ${ftLimit} tx this month\nplatform fee: ${feePercent}% (after free tier)\n\npayments arrive directly in your registered wallet.`
  )
  return true
}

async function handleUpdatePrice(conversation: Conversation, address: string, message: string): Promise<boolean> {
  const parts = message.split(' ')
  // format: "update price <serviceId> <newPrice>"
  if (parts.length < 4) {
    await conversation.sendText('usage: update price <serviceId> <newPriceUsdc>\nexample: update price 0xabc...123 0.10')
    return true
  }
  const serviceId = parts[2]
  const newPrice = parseFloat(parts[3])
  if (isNaN(newPrice) || newPrice <= 0) {
    await conversation.sendText('invalid price. please provide a positive number.')
    return true
  }

  const svc = await contractClient.getService(serviceId)
  if (!svc || svc.seller.toLowerCase() !== address.toLowerCase()) {
    await conversation.sendText('service not found or you are not the owner.')
    return true
  }

  const newPriceUnits = BigInt(Math.round(newPrice * 1e6))
  const operatorWallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY!, contractClient.provider)
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, [
    'function updateService(bytes32 serviceId, string calldata endpoint, string calldata skillFileUrl, uint256 newPrice)',
  ], operatorWallet)
  const tx = await contract.updateService(serviceId, svc.endpoint, svc.skillFileUrl, newPriceUnits)
  const receipt = await tx.wait()

  await conversation.sendText(`✓ price updated to $${newPrice} USDC\ntx: https://basescan.org/tx/${receipt.hash}`)
  return true
}

async function handlePauseService(conversation: Conversation, address: string, message: string): Promise<boolean> {
  const parts = message.split(' ')
  if (parts.length < 3) {
    await conversation.sendText('usage: pause service <serviceId>')
    return true
  }
  const serviceId = parts[2]
  const svc = await contractClient.getService(serviceId)
  if (!svc || svc.seller.toLowerCase() !== address.toLowerCase()) {
    await conversation.sendText('service not found or you are not the owner.')
    return true
  }

  const operatorWallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY!, contractClient.provider)
  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, [
    'function deactivateService(bytes32 serviceId)',
  ], operatorWallet)
  const tx = await contract.deactivateService(serviceId)
  const receipt = await tx.wait()

  await conversation.sendText(`✓ service "${svc.name}" paused\ntx: https://basescan.org/tx/${receipt.hash}`)
  return true
}

async function handleStats(conversation: Conversation): Promise<boolean> {
  const [sellers, services, transactions, volume] = await contractClient.getGlobalStats()
  const volumeDisplay = (Number(volume) / 1e6).toFixed(2)

  await conversation.sendText(
    `sellkit marketplace stats:\n\nactive sellers: ${sellers}\nactive services: ${services}\ntotal transactions: ${transactions}\ntotal volume: $${volumeDisplay} USDC`
  )
  return true
}

async function handleBillingInfo(conversation: Conversation, address: string): Promise<boolean> {
  const feeConfig = await contractClient.getFeeConfig()
  const feePercent = (Number(feeConfig.globalFeePercent) / 100).toFixed(1)
  const freeTierLimit = Number(feeConfig.freeTierLimit)

  let ftInfo = ''
  try {
    const [used] = await contractClient.getFreeTierStatus(address)
    ftInfo = `\nyour free tier: ${used}/${freeTierLimit} used this month`
  } catch {}

  await conversation.sendText(
    `how billing works:\n\nfree tier: first ${freeTierLimit} transactions/month per seller are completely free — no platform fee.\n\nafter that: ${feePercent}% platform fee on each payment, automatically deducted onchain.\n\nexample: buyer pays $0.10 USDC\n→ $${(0.10 * (1 - Number(feeConfig.globalFeePercent) / 10000)).toFixed(4)} to you\n→ $${(0.10 * Number(feeConfig.globalFeePercent) / 10000).toFixed(4)} to sellkit\n\neverything is trustless — the split happens in the contract, not by us.${ftInfo}\n\nverify: https://basescan.org/address/${process.env.CONTRACT_ADDRESS}`
  )
  return true
}
