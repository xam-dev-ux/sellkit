import { Link } from 'react-router-dom'
import { WalletButton } from '../components/WalletButton'
import { ContractLink } from '../components/ContractLink'

export function DocsPage() {
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined
  const feePercent = '5'
  const freeTierLimit = '1,000'

  return (
    <div className="min-h-screen bg-white font-body">
      <header className="sticky top-0 z-40 bg-white border-b border-border px-4 py-3 flex items-center justify-between max-w-miniapp mx-auto">
        <Link to="/" className="text-sm text-muted hover:text-ink">← Back</Link>
        <WalletButton />
      </header>

      <main className="max-w-miniapp mx-auto px-4 pb-12">
        <div className="py-5 border-b border-border">
          <h1 className="text-xl font-semibold text-ink">How SELLKIT works</h1>
        </div>

        {/* Section 1 */}
        <section className="py-5 border-b border-border">
          <h2 className="font-semibold text-ink mb-3">What is SELLKIT?</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            SELLKIT lets anyone turn knowledge — trading signals, datasets, analysis, code — into an x402 service that autonomous AI agents can discover and pay for automatically.
          </p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            Sellers describe what they offer in natural language via XMTP or a web form. SELLKIT creates the endpoint, generates a SKILL.md discovery file, and registers the service onchain. No code required.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Buyers (human or agent) pay per request in USDC on Base. The payment split is enforced by the{' '}
            {contractAddress ? <ContractLink address={contractAddress} label="registry contract" /> : 'registry contract'}{' '}
            — neither party needs to trust SELLKIT.
          </p>
        </section>

        {/* Section 2 */}
        <section className="py-5 border-b border-border">
          <h2 className="font-semibold text-ink mb-3">How billing works</h2>

          <div className="space-y-4">
            <div className="bg-surface rounded-xl p-4">
              <p className="text-sm font-medium text-ink mb-1">Free tier</p>
              <p className="text-sm text-muted">
                Every seller gets <strong>{freeTierLimit} free transactions per month</strong>. During the free tier, 100% of payment goes to the seller — zero platform fee.
              </p>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <p className="text-sm font-medium text-ink mb-1">After the free tier</p>
              <p className="text-sm text-muted">
                A <strong>{feePercent}% platform fee</strong> is automatically deducted onchain in <code className="bg-border/60 px-1 py-0.5 rounded text-xs font-data">processPayment()</code>. The split is atomic — it cannot be modified after deployment.
              </p>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <p className="text-sm font-medium text-ink mb-2">Example: $0.10 USDC payment</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Buyer pays</span>
                  <span className="font-data">$0.1000 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-success">Seller receives</span>
                  <span className="font-data text-success">$0.0950 USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Platform fee</span>
                  <span className="font-data text-muted">$0.0050 USDC</span>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <p className="text-sm font-medium text-ink mb-1">Why it's trustless</p>
              <p className="text-sm text-muted">
                The split logic lives in an immutable contract. Anyone can verify the exact percentages on Basescan. SELLKIT never holds funds — payments flow directly from buyer to seller wallet and treasury in a single transaction.
              </p>
              {contractAddress && (
                <p className="text-xs text-muted mt-2">
                  Contract: <ContractLink address={contractAddress} className="text-xs" />
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="py-5 border-b border-border">
          <h2 className="font-semibold text-ink mb-3">How agents discover services</h2>
          <p className="text-sm text-muted leading-relaxed mb-3">
            Each service has a <code className="bg-border/60 px-1 py-0.5 rounded text-xs font-data">SKILL.md</code> file hosted at a stable URL. The file describes the service, its endpoint, payment requirements, and expected output format.
          </p>
          <p className="text-sm text-muted leading-relaxed mb-3">
            Autonomous agents that support ERC-8004 can query the registry to discover all registered skills. Each skill is also registered as an ERC-8004 token on Base mainnet, making it discoverable by any compliant agent framework.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            The x402 payment standard means agents don't need API keys, subscriptions, or human approval — they pay per request using their own on-chain wallet.
          </p>
        </section>

        {/* Flow diagram */}
        <section className="py-5">
          <h2 className="font-semibold text-ink mb-4">Payment flow</h2>
          <FlowDiagram />
        </section>

        <div className="mt-4">
          <Link
            to="/sell"
            className="block w-full text-center py-3.5 rounded-xl bg-base text-white font-semibold text-sm hover:bg-baseDark transition-colors"
          >
            Start selling →
          </Link>
        </div>
      </main>
    </div>
  )
}

function FlowDiagram() {
  return (
    <svg viewBox="0 0 340 220" className="w-full" aria-label="Payment flow diagram">
      {/* Buyer */}
      <rect x="8" y="20" width="70" height="36" rx="8" fill="#F9FAFB" stroke="#E5E7EB" />
      <text x="43" y="42" textAnchor="middle" fontSize="10" fill="#111827" fontFamily="DM Sans">Agent/Buyer</text>

      {/* Arrow: Buyer → Endpoint */}
      <path d="M78 38 L112 38" stroke="#0052FF" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="95" y="32" textAnchor="middle" fontSize="8" fill="#6B7280">x402 req</text>

      {/* Endpoint */}
      <rect x="112" y="20" width="70" height="36" rx="8" fill="#EFF6FF" stroke="#0052FF" strokeWidth="1.5" />
      <text x="147" y="42" textAnchor="middle" fontSize="10" fill="#0052FF" fontFamily="DM Sans">x402 Endpoint</text>

      {/* Arrow: Endpoint → Contract */}
      <path d="M182 38 L216 38" stroke="#0052FF" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="199" y="32" textAnchor="middle" fontSize="8" fill="#6B7280">USDC</text>

      {/* Contract */}
      <rect x="216" y="20" width="80" height="36" rx="8" fill="#F0FDF4" stroke="#00C48C" strokeWidth="1.5" />
      <text x="256" y="38" textAnchor="middle" fontSize="10" fill="#00C48C" fontFamily="DM Sans">SellKitRegistry</text>
      <text x="256" y="50" textAnchor="middle" fontSize="9" fill="#6B7280">processPayment()</text>

      {/* Arrow: Contract → Seller */}
      <path d="M256 56 L256 90" stroke="#00C48C" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="270" y="78" textAnchor="start" fontSize="8" fill="#00C48C">95%</text>

      {/* Seller wallet */}
      <rect x="200" y="90" width="116" height="36" rx="8" fill="#F9FAFB" stroke="#E5E7EB" />
      <text x="258" y="112" textAnchor="middle" fontSize="10" fill="#111827" fontFamily="DM Sans">Seller Wallet</text>

      {/* Arrow: Contract → Treasury */}
      <path d="M296 56 L296 90" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrowWarn)" />
      <text x="302" y="78" textAnchor="start" fontSize="8" fill="#F59E0B">5%</text>

      {/* Treasury */}
      <rect x="8" y="140" width="80" height="36" rx="8" fill="#FFFBEB" stroke="#F59E0B" />
      <text x="48" y="162" textAnchor="middle" fontSize="10" fill="#B45309" fontFamily="DM Sans">Treasury</text>

      {/* Arrow: Contract → Treasury (long) */}
      <path d="M216 48 L48 140" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrowWarn)" />

      {/* SKILL.md */}
      <rect x="110" y="140" width="80" height="36" rx="8" fill="#F5F3FF" stroke="#8B5CF6" />
      <text x="150" y="158" textAnchor="middle" fontSize="10" fill="#8B5CF6" fontFamily="DM Sans">SKILL.md</text>
      <text x="150" y="170" textAnchor="middle" fontSize="8" fill="#6B7280">ERC-8004</text>

      {/* Basescan */}
      <rect x="210" y="140" width="80" height="36" rx="8" fill="#F9FAFB" stroke="#E5E7EB" />
      <text x="250" y="158" textAnchor="middle" fontSize="10" fill="#111827" fontFamily="DM Sans">Basescan</text>
      <text x="250" y="170" textAnchor="middle" fontSize="8" fill="#6B7280">verifiable</text>

      {/* Arrow defs */}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#0052FF" />
        </marker>
        <marker id="arrowWarn" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#F59E0B" />
        </marker>
      </defs>
    </svg>
  )
}
