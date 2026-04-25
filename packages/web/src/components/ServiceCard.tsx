import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { ServiceListing } from '@sellkit/shared'
import { CATEGORY_LABELS } from '@sellkit/shared'
import { ContractLink } from './ContractLink'

interface Props {
  service: ServiceListing
}

const CATEGORY_COLORS: Record<string, string> = {
  'trading-signals': 'bg-base/10 text-base',
  'market-data': 'bg-success/10 text-success',
  'wallet-analysis': 'bg-warn/10 text-warn',
  datasets: 'bg-purple-100 text-purple-700',
  'code-execution': 'bg-rose-100 text-rose-700',
  research: 'bg-sky-100 text-sky-700',
  other: 'bg-surface text-muted',
}

export function ServiceCard({ service }: Props) {
  const priceDisplay = service.priceUsdc < 0.01
    ? `$${service.priceUsdc.toFixed(4)}`
    : `$${service.priceUsdc.toFixed(3)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-3 hover:border-base/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/service/${service.id}`}
          className="font-semibold text-ink text-sm leading-snug hover:text-base transition-colors line-clamp-2"
        >
          {service.name}
        </Link>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${CATEGORY_COLORS[service.category] ?? 'bg-surface text-muted'}`}>
          {CATEGORY_LABELS[service.category]}
        </span>
      </div>

      <p className="text-xs text-muted line-clamp-2 leading-relaxed">{service.description}</p>

      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="font-data font-semibold text-ink text-base">{priceDisplay}</span>
          <span className="text-xs text-muted ml-1">USDC / req</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted font-data">{service.totalCalls.toLocaleString()} calls</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={`/service/${service.id}`}
          className="flex-1 text-center py-2.5 rounded-xl bg-base text-white text-sm font-medium hover:bg-baseDark transition-colors"
        >
          Buy via x402
        </Link>
        <Link
          to={`/seller/${service.sellerAddress}`}
          className="text-xs text-muted hover:text-base transition-colors"
        >
          <ContractLink address={service.sellerAddress} label="seller" className="text-xs" />
        </Link>
      </div>
    </motion.div>
  )
}
