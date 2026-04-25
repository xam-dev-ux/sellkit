import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { keccak256, toHex, parseUnits } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { CATEGORY_LABELS, SUGGESTED_PRICES } from '@sellkit/shared'
import type { ServiceCategory } from '@sellkit/shared'
import { CONTRACT_ADDRESS, REGISTRY_ABI, useFeeConfig, useIsRegistered } from '../lib/contract'
import { TransactionModal } from '../components/TransactionModal'
import { WalletButton } from '../components/WalletButton'

const CATEGORIES: ServiceCategory[] = [
  'trading-signals', 'market-data', 'wallet-analysis',
  'datasets', 'code-execution', 'research', 'other',
]

const API_URL = import.meta.env.VITE_API_URL || ''

export function OnboardPage() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const { data: feeConfig } = useFeeConfig()
  const { data: alreadyRegistered } = useIsRegistered(address)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'other' as ServiceCategory,
    priceUsdc: '',
    deliveryMode: 'manual' as 'automatic' | 'manual',
  })
  const [txModal, setTxModal] = useState<{ status: 'pending' | 'confirming' | 'success'; hash?: string } | null>(null)

  const { writeContractAsync } = useWriteContract()

  const feePercent = feeConfig ? (Number(feeConfig.globalFeePercent) / 100).toFixed(1) : '5.0'
  const freeTierLimit = feeConfig ? Number(feeConfig.freeTierLimit) : 1000

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleLaunch() {
    if (!address || !CONTRACT_ADDRESS) {
      toast.error('Connect your wallet first')
      return
    }

    const price = parseFloat(form.priceUsdc)
    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid price')
      return
    }
    if (!form.name.trim()) {
      toast.error('Enter a service name')
      return
    }

    try {
      setTxModal({ status: 'pending' })

      // 1. Register seller (idempotent)
      if (!alreadyRegistered) {
        const regTx = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'registerSeller',
          args: [address, ''],
        })
        setTxModal({ status: 'confirming', hash: regTx })
        await new Promise(r => setTimeout(r, 3000))
      }

      // 2. Create service
      const serviceId = keccak256(toHex(`${address}:${form.name}`)) as `0x${string}`
      const endpoint = `${API_URL}/api/serve/${serviceId}`
      const skillFileUrl = `${API_URL}/.well-known/${serviceId}/SKILL.md`
      const priceUnits = parseUnits(price.toString(), 6)
      const catIndex = CATEGORIES.indexOf(form.category)

      const svcTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'createService',
        args: [serviceId, form.name, form.description, endpoint, skillFileUrl, priceUnits, catIndex],
      })

      setTxModal({ status: 'confirming', hash: svcTx })
      await new Promise(r => setTimeout(r, 4000))
      setTxModal({ status: 'success', hash: svcTx })

      toast.success('Service launched!')
    } catch (err: any) {
      toast.error(err.shortMessage ?? err.message ?? 'Transaction failed')
      setTxModal(null)
    }
  }

  const steps = ['Service', 'Pricing', 'Delivery', 'Launch']

  return (
    <div className="min-h-screen bg-white font-body">
      <header className="sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between max-w-miniapp mx-auto">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Back</Link>
        <WalletButton />
      </header>

      <main className="max-w-miniapp mx-auto px-4 pb-24">
        <div className="py-5">
          <h1 className="text-xl font-semibold text-ink">Sell your knowledge</h1>
          <p className="text-sm text-muted mt-1">Launch an x402 service agents can pay for automatically</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i + 1 <= step ? 'bg-base' : 'bg-border'}`} />
              <p className={`text-xs mt-1 text-center ${i + 1 === step ? 'text-base font-medium' : 'text-muted'}`}>{s}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepCard key="step1">
              <Label>Service name</Label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="e.g. ETH/USDC Signal Feed"
                className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-base transition-colors mt-1"
              />
              <Label className="mt-4">Description</Label>
              <textarea
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="What does your service provide? Be specific — agents read this."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-base transition-colors mt-1 resize-none"
              />
              <Label className="mt-4">Category</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => update('category', cat)}
                    className={`py-2 px-3 rounded-xl border text-sm transition-colors text-left ${
                      form.category === cat ? 'border-base bg-base/5 text-base font-medium' : 'border-border text-muted'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {step === 2 && (
            <StepCard key="step2">
              <Label>Price per request (USDC)</Label>
              <div className="mt-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={form.priceUsdc}
                  onChange={e => update('priceUsdc', e.target.value)}
                  placeholder={SUGGESTED_PRICES[form.category].toFixed(3)}
                  className="w-full pl-8 pr-4 py-3 rounded-xl border border-border text-sm font-data focus:outline-none focus:border-base transition-colors"
                />
              </div>
              <p className="text-xs text-muted mt-1">Suggested for {CATEGORY_LABELS[form.category]}: ${SUGGESTED_PRICES[form.category]}</p>

              <div className="mt-4 bg-surface rounded-xl p-4 text-sm text-muted">
                <p className="font-medium text-ink mb-2">Free tier</p>
                <p>First <span className="font-data text-ink">{freeTierLimit.toLocaleString()}</span> requests/month have no platform fee.</p>
                <p className="mt-1">After that: <span className="font-data text-ink">{feePercent}%</span> fee on each payment.</p>
              </div>
            </StepCard>
          )}

          {step === 3 && (
            <StepCard key="step3">
              <Label>Delivery mode</Label>
              <div className="space-y-3 mt-2">
                {(['automatic', 'manual'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => update('deliveryMode', mode)}
                    className={`w-full p-4 rounded-xl border text-left transition-colors ${
                      form.deliveryMode === mode ? 'border-base bg-base/5' : 'border-border'
                    }`}
                  >
                    <p className={`text-sm font-medium ${form.deliveryMode === mode ? 'text-base' : 'text-ink'}`}>
                      {mode === 'automatic' ? 'Automatic' : 'Manual (XMTP)'}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {mode === 'automatic'
                        ? 'You have an existing API or script. Agents get instant responses.'
                        : 'You reply via XMTP each time an agent pays. No code required.'}
                    </p>
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {step === 4 && (
            <StepCard key="step4">
              <div className="space-y-3">
                <Row label="Service" value={form.name} />
                <Row label="Category" value={CATEGORY_LABELS[form.category]} />
                <Row label="Price" value={`$${form.priceUsdc} USDC / request`} />
                <Row label="Delivery" value={form.deliveryMode} />
                <Row label="Free tier" value={`${freeTierLimit.toLocaleString()} tx/month`} />
                <Row label="Platform fee" value={`${feePercent}% after free tier`} />
              </div>

              {!isConnected && (
                <div className="mt-4">
                  <ConnectButton />
                </div>
              )}

              {isConnected && (
                <button
                  onClick={handleLaunch}
                  className="mt-5 w-full py-3.5 rounded-xl bg-base text-white font-semibold text-sm hover:bg-baseDark transition-colors"
                >
                  Register & Launch
                </button>
              )}
            </StepCard>
          )}
        </AnimatePresence>

        {/* Nav */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-xl border border-border text-sm text-ink hover:bg-surface transition-colors"
            >
              Back
            </button>
          )}
          {step < 4 && (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !form.name.trim()}
              className="flex-1 py-3 rounded-xl bg-base text-white text-sm font-medium hover:bg-baseDark transition-colors disabled:opacity-40"
            >
              Next →
            </button>
          )}
        </div>
      </main>

      {txModal && (
        <TransactionModal
          status={txModal.status}
          txHash={txModal.hash}
          onClose={() => { setTxModal(null); navigate('/dashboard') }}
        />
      )}
    </div>
  )
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-medium text-muted uppercase tracking-wide ${className}`}>{children}</p>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  )
}
