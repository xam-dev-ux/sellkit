import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useChainId, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { useEffect } from 'react'
import { HomePage } from './pages/HomePage'
import { OnboardPage } from './pages/OnboardPage'
import { ServicePage } from './pages/ServicePage'
import { SellerPage } from './pages/SellerPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocsPage } from './pages/DocsPage'

function WrongChainGuard({ children }: { children: React.ReactNode }) {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  if (chainId && chainId !== base.id) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-xs">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-semibold text-ink mb-2">Wrong network</p>
          <p className="text-sm text-muted mb-6">
            SELLKIT runs on Base mainnet. Please switch to continue.
          </p>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            className="w-full py-3 rounded-xl bg-base text-white font-medium text-sm hover:bg-baseDark transition-colors"
          >
            Switch to Base Mainnet
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function App() {
  return (
    <WrongChainGuard>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sell" element={<OnboardPage />} />
        <Route path="/service/:id" element={<ServicePage />} />
        <Route path="/seller/:address" element={<SellerPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/how-it-works" element={<DocsPage />} />
      </Routes>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            maxWidth: '340px',
            fontSize: '14px',
            borderRadius: '12px',
          },
        }}
      />
    </WrongChainGuard>
  )
}
