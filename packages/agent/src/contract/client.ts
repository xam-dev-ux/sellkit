import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load ABI from compiled artifacts if available, otherwise use minimal ABI
function loadAbi(): ethers.InterfaceAbi {
  const artifactPaths = [
    path.resolve(__dirname, '../../../../contracts/artifacts/contracts/SellKitRegistry.sol/SellKitRegistry.json'),
    path.resolve(__dirname, '../../../contracts/artifacts/contracts/SellKitRegistry.sol/SellKitRegistry.json'),
  ]
  for (const p of artifactPaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8')).abi
    }
  }
  // Minimal ABI for runtime
  return MINIMAL_ABI
}

const MINIMAL_ABI = [
  'function isRegistered(address seller) view returns (bool)',
  'function getSeller(address seller) view returns (tuple(address sellerAddress, address walletAddress, string basename, uint256 registeredAt, bool active, uint16 feeOverride))',
  'function getService(bytes32 serviceId) view returns (tuple(bytes32 serviceId, address seller, string name, string description, string endpoint, string skillFileUrl, uint256 priceUsdc, uint8 category, uint256 erc8004TokenId, bool active, uint256 createdAt, uint256 totalCalls, uint256 totalRevenueUsdc))',
  'function getSellerServices(address seller) view returns (tuple(bytes32 serviceId, address seller, string name, string description, string endpoint, string skillFileUrl, uint256 priceUsdc, uint8 category, uint256 erc8004TokenId, bool active, uint256 createdAt, uint256 totalCalls, uint256 totalRevenueUsdc)[])',
  'function getFreeTierStatus(address seller) view returns (uint256 used, uint256 limit, uint256 periodStart, bool isActive)',
  'function getFeeConfig() view returns (tuple(uint16 globalFeePercent, uint256 freeTierLimit, address treasury))',
  'function calculateFee(address seller, uint256 amount) view returns (uint256 sellerAmount, uint256 feeAmount, bool wasFreeTier)',
  'function getGlobalStats() view returns (uint256 totalSellers, uint256 totalServices, uint256 totalTransactions, uint256 totalVolume)',
  'function getAllSellerAddresses() view returns (address[])',
  'function registerSeller(address walletAddress, string calldata basename)',
  'function createService(bytes32 serviceId, string calldata name, string calldata description, string calldata endpoint, string calldata skillFileUrl, uint256 priceUsdc, uint8 category)',
  'function updateService(bytes32 serviceId, string calldata endpoint, string calldata skillFileUrl, uint256 newPrice)',
  'function deactivateService(bytes32 serviceId)',
  'function processPayment(bytes32 serviceId, address buyer)',
  'function resetFreeTier(address seller)',
  'function setErc8004TokenId(bytes32 serviceId, uint256 tokenId)',
  'event SellerRegistered(address indexed seller, address walletAddress, string basename, uint256 timestamp)',
  'event ServiceCreated(address indexed seller, bytes32 indexed serviceId, string name, uint256 priceUsdc, uint8 category)',
  'event PaymentProcessed(address indexed buyer, address indexed seller, bytes32 indexed serviceId, uint256 grossAmount, uint256 sellerAmount, uint256 feeAmount, bool wasFreeTier)',
  'event FreeTierReset(address indexed seller, uint256 newPeriodStart)',
] as const

export class ContractClient {
  readonly provider: ethers.JsonRpcProvider
  readonly operator: ethers.Wallet
  readonly contract: ethers.Contract
  readonly address: string

  constructor() {
    const rpc = process.env.RPC_URL || 'https://mainnet-preconf.base.org'
    const contractAddress = process.env.CONTRACT_ADDRESS
    const operatorKey = process.env.OPERATOR_PRIVATE_KEY

    if (!contractAddress) throw new Error('CONTRACT_ADDRESS not set')
    if (!operatorKey) throw new Error('OPERATOR_PRIVATE_KEY not set')

    this.address = contractAddress
    this.provider = new ethers.JsonRpcProvider(rpc)
    this.operator = new ethers.Wallet(operatorKey, this.provider)
    this.contract = new ethers.Contract(contractAddress, loadAbi(), this.operator)
  }

  async isRegistered(address: string): Promise<boolean> {
    return this.contract.isRegistered(address) as Promise<boolean>
  }

  async getSeller(address: string) {
    return this.contract.getSeller(address)
  }

  async getSellerServices(address: string) {
    return this.contract.getSellerServices(address)
  }

  async getService(serviceId: string) {
    return this.contract.getService(serviceId)
  }

  async getFreeTierStatus(seller: string) {
    return this.contract.getFreeTierStatus(seller)
  }

  async getFeeConfig() {
    return this.contract.getFeeConfig()
  }

  async getGlobalStats() {
    return this.contract.getGlobalStats()
  }

  async calculateFee(seller: string, amount: bigint) {
    return this.contract.calculateFee(seller, amount)
  }

  async registerSeller(walletAddress: string, basename: string): Promise<ethers.TransactionReceipt> {
    const signerContract = this.contract.connect(
      new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY!, this.provider)
    ) as ethers.Contract

    // Seller must call this themselves — we build a tx for their wallet
    const tx = await this.contract.registerSeller(walletAddress, basename)
    return tx.wait()
  }

  async registerSellerFor(sellerWallet: ethers.Wallet, walletAddress: string, basename: string): Promise<ethers.TransactionReceipt> {
    const contract = new ethers.Contract(this.address, loadAbi(), sellerWallet)
    const tx = await contract.registerSeller(walletAddress, basename)
    return tx.wait()
  }

  async createServiceFor(sellerWallet: ethers.Wallet, params: {
    serviceId: string
    name: string
    description: string
    endpoint: string
    skillFileUrl: string
    priceUsdc: bigint
    category: number
  }): Promise<ethers.TransactionReceipt> {
    const contract = new ethers.Contract(this.address, loadAbi(), sellerWallet)
    const tx = await contract.createService(
      params.serviceId,
      params.name,
      params.description,
      params.endpoint,
      params.skillFileUrl,
      params.priceUsdc,
      params.category
    )
    return tx.wait()
  }

  async processPayment(serviceId: string, buyer: string): Promise<ethers.TransactionReceipt> {
    const tx = await this.contract.processPayment(serviceId, buyer)
    return tx.wait()
  }

  async getAllSellerAddresses(): Promise<string[]> {
    return this.contract.getAllSellerAddresses()
  }

  async resetFreeTier(seller: string): Promise<ethers.TransactionReceipt> {
    const tx = await this.contract.resetFreeTier(seller)
    return tx.wait()
  }

  serviceIdFromName(seller: string, name: string): string {
    return ethers.id(`${seller}:${name}`)
  }
}

export const contractClient = new ContractClient()
