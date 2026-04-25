import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { base } from 'wagmi/chains'
import { parseUnits } from 'viem'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`

const REGISTRY_ABI = [
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'seller', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getSeller',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'seller', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'sellerAddress', type: 'address' },
        { name: 'walletAddress', type: 'address' },
        { name: 'basename', type: 'string' },
        { name: 'registeredAt', type: 'uint256' },
        { name: 'active', type: 'bool' },
        { name: 'feeOverride', type: 'uint16' },
      ],
    }],
  },
  {
    name: 'getFreeTierStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'seller', type: 'address' }],
    outputs: [
      { name: 'used', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
      { name: 'periodStart', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'getFeeConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'globalFeePercent', type: 'uint16' },
        { name: 'freeTierLimit', type: 'uint256' },
        { name: 'treasury', type: 'address' },
      ],
    }],
  },
  {
    name: 'calculateFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'seller', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      { name: 'sellerAmount', type: 'uint256' },
      { name: 'feeAmount', type: 'uint256' },
      { name: 'wasFreeTier', type: 'bool' },
    ],
  },
  {
    name: 'getGlobalStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalSellers', type: 'uint256' },
      { name: 'totalServices', type: 'uint256' },
      { name: 'totalTransactions', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
    ],
  },
  {
    name: 'registerSeller',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'walletAddress', type: 'address' },
      { name: 'basename', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'createService',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'serviceId', type: 'bytes32' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'skillFileUrl', type: 'string' },
      { name: 'priceUsdc', type: 'uint256' },
      { name: 'category', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'updateService',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'serviceId', type: 'bytes32' },
      { name: 'endpoint', type: 'string' },
      { name: 'skillFileUrl', type: 'string' },
      { name: 'newPrice', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'deactivateService',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'serviceId', type: 'bytes32' }],
    outputs: [],
  },
] as const

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

export { CONTRACT_ADDRESS, USDC_ADDRESS, REGISTRY_ABI, ERC20_ABI }

export function useIsRegistered(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACT_ADDRESS },
    chainId: base.id,
  })
}

export function useFreeTierStatus(address?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getFreeTierStatus',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACT_ADDRESS },
    chainId: base.id,
  })
}

export function useFeeConfig() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getFeeConfig',
    query: { enabled: !!CONTRACT_ADDRESS },
    chainId: base.id,
  })
}

export function useGlobalStats() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getGlobalStats',
    query: { enabled: !!CONTRACT_ADDRESS, refetchInterval: 30_000 },
    chainId: base.id,
  })
}

export function useCalculateFee(seller?: `0x${string}`, amountUsdc?: number) {
  const amount = amountUsdc ? parseUnits(amountUsdc.toString(), 6) : undefined
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'calculateFee',
    args: seller && amount ? [seller, amount] : undefined,
    query: { enabled: !!seller && !!amount && !!CONTRACT_ADDRESS },
    chainId: base.id,
  })
}

export function useUsdcBalance(address?: `0x${string}`) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 30_000,
    },
    chainId: base.id,
  })
}
