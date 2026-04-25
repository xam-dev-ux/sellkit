import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { ServiceCard } from '../components/ServiceCard'
import { ContractLink } from '../components/ContractLink'
import { WalletButton } from '../components/WalletButton'
import { useGlobalStats } from '../lib/contract'
import type { ServiceCategory } from '@sellkit/shared'
import { CATEGORY_LABELS } from '@sellkit/shared'

const CATEGORIES: Array<ServiceCategory | 'all'> = [
  'all',
  'trading-signals',
  'market-data',
  'wallet-analysis',
  'datasets',
  'code-execution',
  'research',
  'other',
]

export function HomePage() {
  const [category, setCategory] = useState<ServiceCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', category],
    queryFn: () => api.services(category === 'all' ? undefined : category),
    refetchInterval: 30_000,
  })

  const { data: onchainStats } = useGlobalStats()

  const filtered = services.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between max-w-miniapp mx-auto w-full">
        <Link to="/" className="font-data font-semibold text-ink text-lg tracking-tight">
          SELLKIT
        </Link>
        <WalletButton />
      </header>

      <main className="max-w-miniapp mx-auto px-4 pb-20">
        {/* Stats bar */}
        {onchainStats && (
          <div className="grid grid-cols-3 gap-3 py-4 border-b border-border">
            <Stat label="Services" value={Number(onchainStats[1]).toLocaleString()} />
            <Stat
              label="Volume"
              value={`$${(Number(onchainStats[3]) / 1e6).toFixed(0)}`}
            />
            <Stat label="Sellers" value={Number(onchainStats[0]).toLocaleString()} />
          </div>
        )}

        {/* Hero */}
        <div className="py-6 border-b border-border">
          <h1 className="text-2xl font-semibold text-ink leading-tight mb-1">
            Buy knowledge.<br />
            <span className="text-base">Pay AI-native.</span>
          </h1>
          <p className="text-sm text-muted mb-4">
            x402 services discoverable by autonomous agents. Trustless splits onchain.
          </p>
          {contractAddress && (
            <p className="text-xs text-muted">
              Contract:{' '}
              <ContractLink address={contractAddress} className="text-xs" />
            </p>
          )}
        </div>

        {/* Search */}
        <div className="py-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full px-4 py-3 rounded-xl border border-border text-sm placeholder:text-muted focus:outline-none focus:border-base transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-base text-white'
                  : 'bg-surface text-muted hover:bg-border'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Service grid */}
        <div className="mt-4 flex flex-col gap-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-surface animate-pulse rounded-2xl" />
            ))}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-16 text-muted">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">No services found</p>
            </div>
          )}

          {filtered.map(svc => (
            <ServiceCard key={svc.id} service={svc} />
          ))}
        </div>
      </main>

      {/* Sell CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 max-w-miniapp mx-auto">
        <Link
          to="/sell"
          className="block w-full text-center py-3.5 rounded-xl bg-ink text-white font-semibold text-sm hover:bg-ink/80 transition-colors"
        >
          Sell your knowledge →
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-data font-semibold text-ink text-lg">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
