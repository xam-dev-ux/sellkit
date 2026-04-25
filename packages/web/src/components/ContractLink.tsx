import { truncateAddress } from '../lib/identicon'

interface Props {
  address: string
  type?: 'address' | 'tx'
  label?: string
  className?: string
}

export function ContractLink({ address, type = 'address', label, className = '' }: Props) {
  const base = import.meta.env.VITE_BASESCAN_URL || 'https://basescan.org'
  const path = type === 'tx' ? 'tx' : 'address'
  const href = `${base}/${path}/${address}`
  const display = label ?? truncateAddress(address)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`font-data text-base hover:text-baseDark underline underline-offset-2 transition-colors ${className}`}
      title={address}
    >
      {display}
    </a>
  )
}
