import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'SELLKIT',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'sellkit-demo',
  chains: [base],
  ssr: false,
})

export { base }
