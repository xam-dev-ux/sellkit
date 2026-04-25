import { formatUnits } from 'viem'
import { useCalculateFee } from '../lib/contract'

interface Props {
  sellerAddress: string
  priceUsdc: number
  className?: string
}

export function PaymentSplitPreview({ sellerAddress, priceUsdc, className = '' }: Props) {
  const { data, isLoading } = useCalculateFee(
    sellerAddress as `0x${string}`,
    priceUsdc
  )

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-border p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-surface rounded w-3/4 mb-3" />
        <div className="h-4 bg-surface rounded w-1/2" />
      </div>
    )
  }

  const [sellerAmount, feeAmount, wasFreeTier] = data ?? [BigInt(Math.round(priceUsdc * 1e6)), 0n, false]

  const sellerUsdc = Number(formatUnits(BigInt(sellerAmount?.toString() ?? '0'), 6))
  const feeUsdc = Number(formatUnits(BigInt(feeAmount?.toString() ?? '0'), 6))

  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Payment split</p>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-ink">Buyer pays</span>
          <span className="font-data font-medium text-ink">${priceUsdc.toFixed(4)} USDC</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-success font-medium">→ Seller receives</span>
          <span className="font-data font-semibold text-success">${sellerUsdc.toFixed(4)} USDC</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted">→ Platform fee</span>
          <span className="font-data text-muted">
            {wasFreeTier ? '$0.0000 (free tier)' : `$${feeUsdc.toFixed(4)} USDC`}
          </span>
        </div>
      </div>
      {wasFreeTier && (
        <p className="text-xs text-success mt-3 bg-success/10 rounded-lg px-3 py-2">
          This seller has free-tier transactions remaining — no platform fee on this payment.
        </p>
      )}
      <p className="text-xs text-muted mt-3">
        Split verified onchain in{' '}
        <a
          href={`${import.meta.env.VITE_BASESCAN_URL}/address/${import.meta.env.VITE_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base hover:underline"
        >
          SellKitRegistry
        </a>
      </p>
    </div>
  )
}
