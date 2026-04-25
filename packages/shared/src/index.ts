export type ServiceCategory =
  | 'trading-signals'
  | 'market-data'
  | 'wallet-analysis'
  | 'datasets'
  | 'code-execution'
  | 'research'
  | 'other'

export interface ServiceListing {
  id: string
  sellerAddress: string
  name: string
  description: string
  endpoint: string
  skillFileUrl: string
  priceUsdc: number
  token: string
  category: ServiceCategory
  erc8004TokenId: number | null
  active: boolean
  createdAt: number
  totalCalls: number
  totalRevenueUsdc: number
}

export interface SellerMetrics {
  freeTierUsed: number
  freeTierLimit: number
  totalTransactions: number
  totalRevenueUsdc: number
  totalFeePaidUsdc: number
  monthlyResetAt: number
}

export interface SellerProfile {
  sellerAddress: string
  basename: string
  registeredAt: number
  active: boolean
  feeOverride: number | null
  services: ServiceListing[]
  metrics: SellerMetrics
}

export interface PaymentRecord {
  txHash: string
  buyer: string
  seller: string
  serviceId: string
  grossAmount: number
  sellerAmount: number
  feeAmount: number
  feePercent: number
  wasFreeTier: boolean
  timestamp: number
  block: number
}

export interface GlobalStats {
  totalSellers: number
  totalServices: number
  totalTransactions: number
  totalVolumeUsdc: number
  totalFeesCollectedUsdc: number
  currentFeePercent: number
  freeTierLimit: number
}

export interface FeeConfig {
  globalFeePercent: number
  freeTierLimit: number
  treasury: string
}

export interface OnboardingState {
  step: 1 | 2 | 3 | 4 | 5
  serviceName?: string
  serviceDescription?: string
  category?: ServiceCategory
  priceUsdc?: number
  deliveryMode?: 'automatic' | 'manual'
  walletAddress?: string
}

export const SUGGESTED_PRICES: Record<ServiceCategory, number> = {
  'trading-signals': 0.05,
  'market-data': 0.001,
  'wallet-analysis': 0.02,
  datasets: 0.10,
  'code-execution': 0.02,
  research: 0.05,
  other: 0.01,
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  'trading-signals': 'Trading Signals',
  'market-data': 'Market Data',
  'wallet-analysis': 'Wallet Analysis',
  datasets: 'Datasets',
  'code-execution': 'Code Execution',
  research: 'Research',
  other: 'Other',
}

export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const BASE_CHAIN_ID = 8453
export const FREE_TIER_LIMIT = 1000
export const DEFAULT_FEE_PERCENT = 500
