import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { BuyButton } from '../components/BuyButton'
import { PaymentSplitPreview } from '../components/PaymentSplitPreview'
import { FreeTierBar } from '../components/FreeTierBar'
import { ContractLink } from '../components/ContractLink'
import { WalletButton } from '../components/WalletButton'
import { CATEGORY_LABELS } from '@sellkit/shared'
import { useFreeTierStatus } from '../lib/contract'

export function ServicePage() {
  const { id } = useParams<{ id: string }>()

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.service(id!),
    enabled: !!id,
  })

  const { data: freeTier } = useFreeTierStatus(service?.sellerAddress as `0x${string}` | undefined)
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined

  if (isLoading) {
    return (
      <div className="max-w-miniapp mx-auto px-4 py-8">
        <div className="h-8 bg-surface animate-pulse rounded-xl w-3/4 mb-4" />
        <div className="h-32 bg-surface animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="max-w-miniapp mx-auto px-4 py-16 text-center text-muted">
        <p>Service not found.</p>
        <Link to="/" className="text-base text-sm mt-2 inline-block">← Back</Link>
      </div>
    )
  }

  const [ftUsed, ftLimit] = freeTier ?? [0n, 1000n, 0n, false]

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between max-w-miniapp mx-auto">
        <Link to="/" className="text-sm text-muted hover:text-ink transition-colors">← Back</Link>
        <WalletButton />
      </header>

      <main className="max-w-miniapp mx-auto px-4 pb-8">
        {/* Title */}
        <div className="py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-base/10 text-base font-medium px-2 py-0.5 rounded-full">
              {CATEGORY_LABELS[service.category]}
            </span>
            {service.active && (
              <span className="text-xs bg-success/10 text-success font-medium px-2 py-0.5 rounded-full">Live</span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-ink leading-snug">{service.name}</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">{service.description}</p>
        </div>

        {/* Price */}
        <div className="py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Price per request</p>
            <p className="font-data font-bold text-2xl text-ink">${service.priceUsdc.toFixed(4)}</p>
            <p className="text-xs text-muted">USDC on Base</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Total calls</p>
            <p className="font-data font-semibold text-ink">{service.totalCalls.toLocaleString()}</p>
          </div>
        </div>

        {/* Payment split preview — most important component */}
        <div className="py-4 border-b border-border">
          <PaymentSplitPreview
            sellerAddress={service.sellerAddress}
            priceUsdc={service.priceUsdc}
          />
        </div>

        {/* Free tier */}
        {freeTier && (
          <div className="py-4 border-b border-border">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Seller free tier</p>
            <FreeTierBar used={Number(ftUsed)} limit={Number(ftLimit)} />
            <p className="text-xs text-muted mt-2">
              First {Number(ftLimit).toLocaleString()} tx/month per seller have no platform fee.
            </p>
          </div>
        )}

        {/* Buy button */}
        <div className="py-4 border-b border-border">
          <BuyButton
            serviceId={service.id}
            sellerAddress={service.sellerAddress}
            priceUsdc={service.priceUsdc}
            serviceName={service.name}
          />
        </div>

        {/* Seller */}
        <div className="py-4 border-b border-border">
          <p className="text-xs text-muted mb-1">Seller</p>
          <Link to={`/seller/${service.sellerAddress}`} className="text-sm text-base hover:underline">
            <ContractLink address={service.sellerAddress} />
          </Link>
        </div>

        {/* SKILL.md */}
        <div className="py-4 border-b border-border">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Agent discovery</p>
          <a
            href={service.skillFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-base hover:underline break-all"
          >
            {service.skillFileUrl}
          </a>
          <p className="text-xs text-muted mt-1">SKILL.md — agents use this to discover and call the service</p>
        </div>

        {/* Contract */}
        {contractAddress && (
          <div className="py-4">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Verified onchain</p>
            <p className="text-xs text-muted mb-1">All payments processed by:</p>
            <ContractLink address={contractAddress} className="text-sm" />
            <p className="text-xs text-muted mt-1">
              The fee split is enforced in the contract — neither SELLKIT nor the seller can modify payments mid-flight.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
