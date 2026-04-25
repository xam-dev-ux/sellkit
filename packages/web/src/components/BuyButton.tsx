import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import toast from 'react-hot-toast'
import { ERC20_ABI, CONTRACT_ADDRESS, USDC_ADDRESS } from '../lib/contract'
import { TransactionModal } from './TransactionModal'

interface Props {
  serviceId: string
  sellerAddress: string
  priceUsdc: number
  serviceName: string
}

type Step = 'idle' | 'approving' | 'paying' | 'confirming' | 'done'

export function BuyButton({ serviceId, sellerAddress, priceUsdc, serviceName }: Props) {
  const { address, isConnected } = useAccount()
  const [step, setStep] = useState<Step>('idle')
  const [txHash, setTxHash] = useState<string>()

  const { writeContractAsync } = useWriteContract()

  const priceUnits = parseUnits(priceUsdc.toString(), 6)

  async function handleBuy() {
    if (!address || !CONTRACT_ADDRESS) return
    try {
      // Step 1: Approve USDC
      setStep('approving')
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, priceUnits],
      })
      setTxHash(approveTx)
      setStep('paying')

      // Step 2: Call service endpoint (x402 payment proof flow)
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/serve/${serviceId}`,
        {
          headers: {
            'x-buyer-address': address,
          },
        }
      )

      if (!res.ok) {
        throw new Error(`Service call failed: ${res.status}`)
      }

      setStep('confirming')

      toast.success(`Paid for "${serviceName}" ✓`)
      setStep('done')
    } catch (err: any) {
      console.error('Buy error:', err)
      toast.error(err.message ?? 'Transaction failed')
      setStep('idle')
    }
  }

  if (!isConnected) {
    return (
      <div className="w-full">
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button
              onClick={openConnectModal}
              className="w-full py-3.5 rounded-xl bg-base text-white font-semibold text-sm hover:bg-baseDark transition-colors"
            >
              Connect wallet to buy
            </button>
          )}
        </ConnectButton.Custom>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handleBuy}
        disabled={step !== 'idle'}
        className="w-full py-3.5 rounded-xl bg-base text-white font-semibold text-sm hover:bg-baseDark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {step === 'idle' && `Buy for $${priceUsdc.toFixed(4)} USDC`}
        {step === 'approving' && 'Approving USDC…'}
        {step === 'paying' && 'Processing payment…'}
        {step === 'confirming' && 'Confirming…'}
        {step === 'done' && '✓ Purchased'}
      </button>

      <TransactionModal
        status={step === 'approving' ? 'pending' : step === 'confirming' ? 'confirming' : step === 'done' ? 'success' : 'error'}
        txHash={txHash}
        title="Approve USDC spend"
        onClose={() => setStep('idle')}
      />
    </>
  )
}
