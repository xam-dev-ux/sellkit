import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { api } from '../lib/api'
import { FreeTierBar } from '../components/FreeTierBar'
import { ContractLink } from '../components/ContractLink'
import { WalletButton } from '../components/WalletButton'
import { useFreeTierStatus, useIsRegistered } from '../lib/contract'
import { CATEGORY_LABELS } from '@sellkit/shared'
import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import { CONTRACT_ADDRESS, REGISTRY_ABI } from '../lib/contract'
import toast from 'react-hot-toast'

export function DashboardPage() {
  const { address, isConnected } = useAccount()
  const { data: isRegistered, isLoading: loadingReg } = useIsRegistered(address)

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 max-w-miniapp mx-auto">
        <p className="text-ink font-semibold mb-4">Connect your wallet</p>
        <ConnectButton />
        <Link to="/" className="text-sm text-muted mt-4 hover:text-base">← Browse services</Link>
      </div>
    )
  }

  if (loadingReg) {
    return (
      <div className="max-w-miniapp mx-auto px-4 py-12 text-center">
        <div className="w-8 h-8 border-4 border-base border-t-transparent animate-spin rounded-full mx-auto" />
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 max-w-miniapp mx-auto text-center">
        <p className="text-ink font-semibold mb-2">You're not a seller yet</p>
        <p className="text-sm text-muted mb-6">Register your first service to see your dashboard.</p>
        <Link to="/sell" className="py-3 px-6 rounded-xl bg-base text-white font-medium text-sm hover:bg-baseDark transition-colors">
          Start selling →
        </Link>
      </div>
    )
  }

  return <DashboardContent address={address!} />
}

function DashboardContent({ address }: { address: string }) {
  const { data: seller, isLoading, refetch } = useQuery({
    queryKey: ['seller', address],
    queryFn: () => api.seller(address),
    refetchInterval: 30_000,
  })

  const { data: freeTier } = useFreeTierStatus(address as `0x${string}`)
  const { writeContractAsync } = useWriteContract()
  const [updatingPrice, setUpdatingPrice] = useState<string | null>(null)
  const [newPriceInput, setNewPriceInput] = useState('')

  const [ftUsed, ftLimit, ftPeriodStart] = freeTier ?? [0n, 1000n, 0n]
  const nextReset = new Date((Number(ftPeriodStart) + 30 * 24 * 60 * 60) * 1000).toLocaleDateString()

  async function handleDeactivate(serviceId: string) {
    if (!CONTRACT_ADDRESS) return
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'deactivateService',
        args: [serviceId as `0x${string}`],
      })
      toast.success('Service paused')
      refetch()
    } catch (err: any) {
      toast.error(err.shortMessage ?? 'Failed')
    }
  }

  async function handleUpdatePrice(serviceId: string, endpoint: string, skillFileUrl: string) {
    if (!CONTRACT_ADDRESS) return
    const price = parseFloat(newPriceInput)
    if (isNaN(price) || price <= 0) { toast.error('Invalid price'); return }
    try {
      const { parseUnits } = await import('viem')
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'updateService',
        args: [serviceId as `0x${string}`, endpoint, skillFileUrl, parseUnits(price.toString(), 6)],
      })
      toast.success('Price updated')
      setUpdatingPrice(null)
      refetch()
    } catch (err: any) {
      toast.error(err.shortMessage ?? 'Failed')
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-miniapp mx-auto px-4 py-12 text-center">
        <div className="w-8 h-8 border-4 border-base border-t-transparent animate-spin rounded-full mx-auto" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-body">
      <header className="sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between max-w-miniapp mx-auto">
        <Link to="/" className="font-data font-semibold text-ink">SELLKIT</Link>
        <WalletButton />
      </header>

      <main className="max-w-miniapp mx-auto px-4 pb-24">
        <div className="py-5 border-b border-border">
          <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        </div>

        {/* Free tier — most important */}
        {freeTier && (
          <div className="py-4 border-b border-border">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Free tier</p>
            <FreeTierBar used={Number(ftUsed)} limit={Number(ftLimit)} />
            <p className="text-xs text-muted mt-2">Resets {nextReset}</p>
          </div>
        )}

        {/* Revenue */}
        {seller && (
          <div className="grid grid-cols-3 gap-3 py-4 border-b border-border">
            <div className="text-center">
              <p className="font-data font-bold text-success text-lg">${seller.metrics.totalRevenueUsdc.toFixed(2)}</p>
              <p className="text-xs text-muted">Revenue</p>
            </div>
            <div className="text-center">
              <p className="font-data font-bold text-ink text-lg">${seller.metrics.totalFeePaidUsdc.toFixed(2)}</p>
              <p className="text-xs text-muted">Fees paid</p>
            </div>
            <div className="text-center">
              <p className="font-data font-bold text-ink text-lg">{seller.metrics.totalTransactions.toLocaleString()}</p>
              <p className="text-xs text-muted">Calls</p>
            </div>
          </div>
        )}

        {/* Services */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">My services</p>
            <Link to="/sell" className="text-xs text-base hover:underline">+ New</Link>
          </div>

          {seller?.services.map(svc => (
            <div key={svc.id} className="bg-surface rounded-2xl border border-border p-4 mb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-sm text-ink">{svc.name}</p>
                <span className="text-xs bg-success/10 text-success rounded-full px-2 py-0.5">Active</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted mb-3">
                <span className="font-data">${svc.priceUsdc.toFixed(4)} USDC</span>
                <span>{svc.totalCalls} calls</span>
                <span className="text-success">${svc.totalRevenueUsdc.toFixed(2)} rev</span>
              </div>

              {updatingPrice === svc.id ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newPriceInput}
                    onChange={e => setNewPriceInput(e.target.value)}
                    placeholder={svc.priceUsdc.toString()}
                    className="flex-1 px-3 py-2 rounded-xl border border-border text-sm font-data focus:outline-none focus:border-base"
                  />
                  <button
                    onClick={() => handleUpdatePrice(svc.id, svc.endpoint, svc.skillFileUrl)}
                    className="px-4 py-2 rounded-xl bg-base text-white text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setUpdatingPrice(null)}
                    className="px-3 py-2 rounded-xl border border-border text-xs text-muted"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setUpdatingPrice(svc.id); setNewPriceInput('') }}
                    className="flex-1 py-2 rounded-xl border border-border text-xs text-ink hover:bg-white transition-colors"
                  >
                    Update price
                  </button>
                  <button
                    onClick={() => handleDeactivate(svc.id)}
                    className="px-3 py-2 rounded-xl border border-border text-xs text-muted hover:border-danger hover:text-danger transition-colors"
                  >
                    Pause
                  </button>
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-border">
                <ContractLink address={svc.id} label="service id" className="text-xs" />
              </div>
            </div>
          ))}
        </div>

        {/* Contract */}
        {import.meta.env.VITE_CONTRACT_ADDRESS && (
          <div className="py-4 border-t border-border">
            <p className="text-xs text-muted mb-1">Registry contract</p>
            <ContractLink address={import.meta.env.VITE_CONTRACT_ADDRESS} className="text-xs" />
          </div>
        )}
      </main>
    </div>
  )
}
