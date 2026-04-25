import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ServiceCard } from '../components/ServiceCard'
import { ContractLink } from '../components/ContractLink'
import { generateIdenticon, truncateAddress } from '../lib/identicon'
import { WalletButton } from '../components/WalletButton'

export function SellerPage() {
  const { address } = useParams<{ address: string }>()

  const { data: seller, isLoading } = useQuery({
    queryKey: ['seller', address],
    queryFn: () => api.seller(address!),
    enabled: !!address,
  })

  if (isLoading) {
    return (
      <div className="max-w-miniapp mx-auto px-4 py-8">
        <div className="h-16 bg-surface animate-pulse rounded-xl mb-4" />
        <div className="h-40 bg-surface animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="max-w-miniapp mx-auto px-4 py-16 text-center text-muted">
        <p>Seller not found.</p>
        <Link to="/" className="text-base text-sm mt-2 inline-block">← Back</Link>
      </div>
    )
  }

  const avatarSrc = generateIdenticon(seller.sellerAddress, 48)
  const daysSince = Math.floor((Date.now() / 1000 - seller.registeredAt) / 86400)

  return (
    <div className="min-h-screen bg-white font-body">
      <header className="sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between max-w-miniapp mx-auto">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Back</Link>
        <WalletButton />
      </header>

      <main className="max-w-miniapp mx-auto px-4 pb-8">
        {/* Profile */}
        <div className="py-5 flex items-center gap-4 border-b border-border">
          <img src={avatarSrc} alt="" className="w-12 h-12 rounded-full border border-border" />
          <div>
            <p className="font-semibold text-ink">
              {seller.basename || truncateAddress(seller.sellerAddress)}
            </p>
            <ContractLink address={seller.sellerAddress} className="text-xs" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 py-4 border-b border-border">
          <Stat label="Services" value={seller.services.length.toString()} />
          <Stat label="Calls" value={seller.metrics.totalTransactions.toLocaleString()} />
          <Stat label="Revenue" value={`$${seller.metrics.totalRevenueUsdc.toFixed(0)}`} />
          <Stat label="Days" value={daysSince.toString()} />
        </div>

        {/* Services */}
        <div className="py-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Services</p>
          {seller.services.length === 0 ? (
            <p className="text-sm text-muted">No active services</p>
          ) : (
            <div className="flex flex-col gap-3">
              {seller.services.map(svc => (
                <ServiceCard key={svc.id} service={svc} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-data font-semibold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
