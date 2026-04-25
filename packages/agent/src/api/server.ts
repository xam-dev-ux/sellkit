import express from 'express'
import cors from 'cors'
import { contractClient } from '../contract/client.js'
import { buildEndpointRouter, getSkillMd } from '../endpoints/engine.js'
import { CATEGORY_LABELS } from '@sellkit/shared'
import type { ServiceCategory } from '@sellkit/shared'

const CACHE_TTL = 10 * 1000
let cachedStats: { data: any; ts: number } | null = null

function freshStats() {
  return !cachedStats || Date.now() - cachedStats.ts > CACHE_TTL
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

function mapService(svc: any) {
  const catIndex = Number(svc.category)
  const category: ServiceCategory = CATEGORY_MAP[catIndex] ?? 'other'
  return {
    id: svc.serviceId,
    sellerAddress: svc.seller,
    name: svc.name,
    description: svc.description,
    endpoint: svc.endpoint,
    skillFileUrl: svc.skillFileUrl,
    priceUsdc: Number(svc.priceUsdc) / 1e6,
    token: 'USDC',
    category,
    erc8004TokenId: Number(svc.erc8004TokenId) || null,
    active: svc.active,
    createdAt: Number(svc.createdAt),
    totalCalls: Number(svc.totalCalls),
    totalRevenueUsdc: Number(svc.totalRevenueUsdc) / 1e6,
  }
}

export function buildApiServer() {
  const app = express()
  const corsOrigins = [
    process.env.WEB_ORIGIN || 'https://sellkit.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ]

  app.use(cors({ origin: corsOrigins, credentials: true }))
  app.use(express.json())

  // Mount endpoint engine (x402 serve + SKILL.md)
  app.use(buildEndpointRouter())

  // ── REST API ──────────────────────────────────────

  // GET /api/stats
  app.get('/api/stats', async (req, res) => {
    try {
      if (freshStats()) {
        const [sellers, services, transactions, volume] = await contractClient.getGlobalStats()
        const feeConfig = await contractClient.getFeeConfig()
        cachedStats = {
          data: {
            totalSellers: Number(sellers),
            totalServices: Number(services),
            totalTransactions: Number(transactions),
            totalVolumeUsdc: Number(volume) / 1e6,
            totalFeesCollectedUsdc: 0,
            currentFeePercent: Number(feeConfig.globalFeePercent),
            freeTierLimit: Number(feeConfig.freeTierLimit),
          },
          ts: Date.now(),
        }
      }
      res.json(cachedStats!.data)
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch stats' })
    }
  })

  // GET /api/fees
  app.get('/api/fees', async (req, res) => {
    try {
      const feeConfig = await contractClient.getFeeConfig()
      res.json({
        globalFeePercent: Number(feeConfig.globalFeePercent),
        freeTierLimit: Number(feeConfig.freeTierLimit),
        treasury: feeConfig.treasury,
      })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch fee config' })
    }
  })

  // GET /api/services?category=X
  app.get('/api/services', async (req, res) => {
    try {
      const sellers = await contractClient.getAllSellerAddresses()
      const allServices: any[] = []

      for (const seller of sellers) {
        const services = await contractClient.getSellerServices(seller)
        for (const svc of services) {
          if (!svc.active) continue
          allServices.push(mapService(svc))
        }
      }

      const { category } = req.query
      const filtered = category
        ? allServices.filter(s => s.category === category)
        : allServices

      res.json(filtered)
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch services' })
    }
  })

  // GET /api/services/:serviceId
  app.get('/api/services/:serviceId', async (req, res) => {
    try {
      const svc = await contractClient.getService(req.params.serviceId)
      if (!svc || !svc.active) return res.status(404).json({ error: 'Service not found' })
      res.json(mapService(svc))
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch service' })
    }
  })

  // GET /api/sellers/:address
  app.get('/api/sellers/:address', async (req, res) => {
    try {
      const seller = await contractClient.getSeller(req.params.address)
      if (!seller || !seller.active) return res.status(404).json({ error: 'Seller not found' })

      const [ftUsed, ftLimit, ftPeriodStart] = await contractClient.getFreeTierStatus(req.params.address)
      const services = await contractClient.getSellerServices(req.params.address)

      let totalRevenue = 0n
      let totalCalls = 0n
      for (const svc of services) {
        totalRevenue += BigInt(svc.totalRevenueUsdc)
        totalCalls += BigInt(svc.totalCalls)
      }

      res.json({
        sellerAddress: seller.sellerAddress,
        basename: seller.basename,
        registeredAt: Number(seller.registeredAt),
        active: seller.active,
        feeOverride: seller.feeOverride > 0 ? Number(seller.feeOverride) : null,
        services: services.filter((s: any) => s.active).map(mapService),
        metrics: {
          freeTierUsed: Number(ftUsed),
          freeTierLimit: Number(ftLimit),
          totalTransactions: Number(totalCalls),
          totalRevenueUsdc: Number(totalRevenue) / 1e6,
          totalFeePaidUsdc: 0,
          monthlyResetAt: Number(ftPeriodStart) + 30 * 24 * 60 * 60,
        },
      })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch seller' })
    }
  })

  // GET /api/sellers/:address/services
  app.get('/api/sellers/:address/services', async (req, res) => {
    try {
      const services = await contractClient.getSellerServices(req.params.address)
      res.json(services.filter((s: any) => s.active).map(mapService))
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch seller services' })
    }
  })

  return app
}
