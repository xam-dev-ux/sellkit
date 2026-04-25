import { ServiceCategory, CATEGORY_LABELS } from '@sellkit/shared'

interface SkillMdParams {
  serviceId: string
  serviceName: string
  description: string
  priceUsdc: number
  category: ServiceCategory
  contractAddress: string
  feePercent: number
  baseUrl: string
}

export function generateSkillMd(p: SkillMdParams): string {
  const priceDisplay = p.priceUsdc.toFixed(p.priceUsdc < 0.01 ? 4 : 3)
  const feeDisplay = (p.feePercent / 100).toFixed(1)

  return `# ${p.serviceName}

## Description
${p.description}

## Category
${CATEGORY_LABELS[p.category]}

## Endpoints

### GET /api/serve/${p.serviceId}
- **Description**: ${p.description}
- **Payment**: ${priceDisplay} USDC via x402 (Base mainnet)
- **Output**: JSON response with service-specific payload
- **Free tier**: First 1,000 requests/month per seller at no platform fee

## Authentication
x402 payment required. No API key needed.
Payments processed via SellKitRegistry contract: \`${p.contractAddress}\`
Fee split: verified onchain — ${feeDisplay}% platform fee, remainder to seller.

## Example Request
\`\`\`
GET ${p.baseUrl}/api/serve/${p.serviceId}
x402-payment: <payment-proof>
\`\`\`

## Example Response
\`\`\`json
{
  "serviceId": "${p.serviceId}",
  "result": { ... },
  "timestamp": 1714000000
}
\`\`\`

## Side Effects
Each request calls \`processPayment()\` on Base mainnet.
Transaction visible at: https://basescan.org

## Discovery
ERC-8004 registry: registered on Base mainnet.
Skill file: ${p.baseUrl}/.well-known/${p.serviceId}/SKILL.md
`
}
