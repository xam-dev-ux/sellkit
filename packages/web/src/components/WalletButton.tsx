import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useUsdcBalance } from '../lib/contract'
import { generateIdenticon, truncateAddress } from '../lib/identicon'
import { formatUnits } from 'viem'
import toast from 'react-hot-toast'
import { useState } from 'react'

export function WalletButton() {
  const { address } = useAccount()
  const { data: usdcBalance } = useUsdcBalance(address)
  const [showMenu, setShowMenu] = useState(false)

  const usdcDisplay = usdcBalance
    ? `$${parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)}`
    : null

  return (
    <ConnectButton.Custom>
      {({ account, chain, openChainModal, openConnectModal, openAccountModal, mounted }) => {
        if (!mounted) return null

        if (!account || !chain) {
          return (
            <button
              onClick={openConnectModal}
              className="px-4 py-2 rounded-xl bg-base text-white text-sm font-medium hover:bg-baseDark transition-colors"
            >
              Connect
            </button>
          )
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="px-4 py-2 rounded-xl bg-danger text-white text-sm font-medium animate-pulse"
            >
              Wrong network
            </button>
          )
        }

        const avatarSrc = generateIdenticon(account.address, 28)

        return (
          <div className="relative">
            <button
              onClick={() => setShowMenu(m => !m)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-white hover:border-base/40 transition-colors"
            >
              <img src={avatarSrc} alt="" className="w-7 h-7 rounded-full" />
              <div className="text-left">
                <p className="text-xs font-medium text-ink leading-none">{truncateAddress(account.address)}</p>
                {usdcDisplay && (
                  <p className="text-xs text-muted font-data leading-none mt-0.5">{usdcDisplay} USDC</p>
                )}
              </div>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(account.address)
                    toast.success('Address copied!')
                    setShowMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-ink hover:bg-surface transition-colors border-b border-border"
                >
                  Copy address
                </button>
                <button
                  onClick={() => { openAccountModal(); setShowMenu(false) }}
                  className="w-full px-4 py-3 text-left text-sm text-ink hover:bg-surface transition-colors border-b border-border"
                >
                  Account details
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-3 text-left text-sm text-danger hover:bg-danger/5 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
