import { motion, AnimatePresence } from 'framer-motion'
import { ContractLink } from './ContractLink'

type Status = 'pending' | 'confirming' | 'success' | 'error'

interface Props {
  status: Status
  txHash?: string
  title?: string
  sellerAmount?: number
  feeAmount?: number
  onClose?: () => void
}

export function TransactionModal({ status, txHash, title, sellerAmount, feeAmount, onClose }: Props) {
  return (
    <AnimatePresence>
      {status !== 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6"
          onClick={status === 'success' ? onClose : undefined}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="w-full max-w-miniapp bg-white rounded-2xl shadow-2xl p-6"
            onClick={e => e.stopPropagation()}
          >
            {status === 'pending' && <PendingView title={title} />}
            {status === 'confirming' && <ConfirmingView txHash={txHash} />}
            {status === 'success' && (
              <SuccessView
                txHash={txHash}
                sellerAmount={sellerAmount}
                feeAmount={feeAmount}
                onClose={onClose}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PendingView({ title }: { title?: string }) {
  return (
    <div className="text-center py-4">
      <div className="w-12 h-12 rounded-full border-4 border-base border-t-transparent animate-spin mx-auto mb-4" />
      <p className="font-semibold text-ink">{title ?? 'Waiting for approval…'}</p>
      <p className="text-sm text-muted mt-1">Confirm the transaction in your wallet</p>
    </div>
  )
}

function ConfirmingView({ txHash }: { txHash?: string }) {
  return (
    <div className="text-center py-4">
      <div className="w-12 h-12 rounded-full bg-base/10 flex items-center justify-center mx-auto mb-4">
        <div className="w-6 h-6 rounded-full border-4 border-base border-t-transparent animate-spin" />
      </div>
      <p className="font-semibold text-ink">Transaction submitted</p>
      <p className="text-sm text-muted mt-1 mb-3">Waiting for confirmation on Base…</p>
      {txHash && (
        <ContractLink address={txHash} type="tx" label="View on Basescan →" className="text-sm" />
      )}
    </div>
  )
}

function SuccessView({
  txHash,
  sellerAmount,
  feeAmount,
  onClose,
}: {
  txHash?: string
  sellerAmount?: number
  feeAmount?: number
  onClose?: () => void
}) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4 text-2xl">
        ✓
      </div>
      <p className="font-semibold text-ink text-lg">Transaction confirmed</p>
      {sellerAmount !== undefined && (
        <div className="mt-4 bg-surface rounded-xl p-4 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Seller received</span>
            <span className="font-data font-medium text-success">${sellerAmount.toFixed(4)} USDC</span>
          </div>
          {feeAmount !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Platform fee</span>
              <span className="font-data text-muted">${feeAmount.toFixed(4)} USDC</span>
            </div>
          )}
        </div>
      )}
      {txHash && (
        <div className="mt-3">
          <ContractLink address={txHash} type="tx" label="View on Basescan →" className="text-sm" />
        </div>
      )}
      <button
        onClick={onClose}
        className="mt-5 w-full py-3 rounded-xl bg-ink text-white font-medium text-sm hover:bg-ink/80 transition-colors"
      >
        Done
      </button>
    </div>
  )
}
