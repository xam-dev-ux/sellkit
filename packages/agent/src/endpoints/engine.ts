import express, { Request, Response, NextFunction, Router } from 'express'
import { contractClient } from '../contract/client.js'
import { generateSkillMd } from './skillmd.js'
import { CATEGORY_LABELS } from '@sellkit/shared'
import type { ServiceCategory } from '@sellkit/shared'

// In-memory store for skill files and manual delivery queues
const skillFiles = new Map<string, string>()
const manualDeliveryQueue = new Map<string, {
  resolve: (data: string) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}>()

export const MANUAL_DELIVERY_TIMEOUT_MS = 5 * 60 * 1000

export function registerService(params: {
  serviceId: string
  serviceName: string
  description: string
  priceUsdc: number
  category: ServiceCategory
  deliveryMode: 'automatic' | 'manual'
  sellerAddress: string
  contractAddress: string
  feePercent: number
  baseUrl: string
}) {
  const md = generateSkillMd({
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    description: params.description,
    priceUsdc: params.priceUsdc,
    category: params.category,
    contractAddress: params.contractAddress,
    feePercent: params.feePercent,
    baseUrl: params.baseUrl,
  })
  skillFiles.set(params.serviceId, md)
}

export function getSkillMd(serviceId: string): string | undefined {
  return skillFiles.get(serviceId)
}

/**
 * Called by XMTP handler when a seller delivers manual content.
 */
export function deliverManualContent(serviceId: string, content: string) {
  const pending = manualDeliveryQueue.get(serviceId)
  if (pending) {
    clearTimeout(pending.timer)
    manualDeliveryQueue.delete(serviceId)
    pending.resolve(content)
  }
}

/**
 * Express router that handles x402 service endpoints.
 * The actual x402 payment verification is done in the middleware layer.
 */
export function buildEndpointRouter(): Router {
  const router = Router()

  // Serve x402-gated service content
  router.get('/serve/:serviceId', async (req: Request, res: Response) => {
    const { serviceId } = req.params

    try {
      const svc = await contractClient.getService(serviceId)
      if (!svc || !svc.active) {
        return res.status(404).json({ error: 'Service not found or inactive' })
      }

      // buyer address comes from x402 verified payment header
      const buyerAddress = (req as any).paymentSender as string | undefined

      if (buyerAddress) {
        try {
          await contractClient.processPayment(serviceId, buyerAddress)
        } catch (err) {
          console.error('processPayment failed:', err)
          return res.status(500).json({ error: 'Payment processing failed' })
        }
      }

      // For manual delivery services: wait for seller XMTP response
      const isManual = manualDeliveryQueue.has(serviceId) || skillFiles.get(serviceId)?.includes('manual')
      if (isManual) {
        const content = await waitForManualDelivery(serviceId)
        return res.json({ serviceId, result: content, timestamp: Date.now() })
      }

      // Automatic delivery — return generic acknowledgement
      return res.json({
        serviceId,
        name: svc.name,
        result: { message: 'Service response delivered', serviceId },
        timestamp: Date.now(),
      })
    } catch (err) {
      console.error('Service endpoint error:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  })

  // Serve SKILL.md
  router.get('/.well-known/:serviceId/SKILL.md', (req: Request, res: Response) => {
    const { serviceId } = req.params
    const md = skillFiles.get(serviceId)
    if (!md) {
      return res.status(404).send('SKILL.md not found')
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.send(md)
  })

  return router
}

function waitForManualDelivery(serviceId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      manualDeliveryQueue.delete(serviceId)
      reject(new Error('Manual delivery timeout'))
    }, MANUAL_DELIVERY_TIMEOUT_MS)

    manualDeliveryQueue.set(serviceId, { resolve, reject, timer })
  })
}
