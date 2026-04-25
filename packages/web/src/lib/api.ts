import type { ServiceListing, SellerProfile, GlobalStats, FeeConfig } from '@sellkit/shared'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  stats: () => get<GlobalStats>('/api/stats'),
  fees: () => get<FeeConfig>('/api/fees'),
  services: (category?: string) =>
    get<ServiceListing[]>(`/api/services${category ? `?category=${category}` : ''}`),
  service: (id: string) => get<ServiceListing>(`/api/services/${id}`),
  seller: (address: string) => get<SellerProfile>(`/api/sellers/${address}`),
  sellerServices: (address: string) => get<ServiceListing[]>(`/api/sellers/${address}/services`),
}
