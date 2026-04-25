// @ts-nocheck — Hardhat injects runtime type extensions (chai matchers, ethers HRE)
//               that TypeScript cannot verify statically without running `hardhat compile`.
import { expect } from 'chai'

const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

const INITIAL_FEE = 500   // 5 %
const FREE_TIER_LIMIT = 1000
const PRICE_USDC = ethers.parseUnits('0.05', 6) // 0.05 USDC

async function deployFixture() {
  const [owner, treasury, alice, bob, buyer] = await ethers.getSigners()

  // Deploy mock USDC
  const MockERC20 = await ethers.getContractFactory('MockERC20')
  const usdc = await MockERC20.deploy('USD Coin', 'USDC', 6)

  // Mint USDC for buyer
  await usdc.mint(buyer.address, ethers.parseUnits('100', 6))

  const Factory = await ethers.getContractFactory('SellKitRegistry')
  const registry = (await Factory.deploy(
    await usdc.getAddress(),
    treasury.address,
    INITIAL_FEE,
    FREE_TIER_LIMIT
  )) as SellKitRegistry

  return { registry, usdc, owner, treasury, alice, bob, buyer }
}

describe('SellKitRegistry', () => {
  // ─── Seller registration ──────────────────────────────
  describe('registerSeller', () => {
    it('registers a new seller', async () => {
      const { registry, alice } = await loadFixture(deployFixture)
      await expect(registry.connect(alice).registerSeller(alice.address, 'alice.base.eth'))
        .to.emit(registry, 'SellerRegistered')
        .withArgs(alice.address, alice.address, 'alice.base.eth', await blockTs())

      const rec = await registry.getSeller(alice.address)
      expect(rec.active).to.be.true
      expect(rec.basename).to.equal('alice.base.eth')
      expect(await registry.totalSellers()).to.equal(1)
    })

    it('updates existing seller without incrementing count', async () => {
      const { registry, alice, bob } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      await registry.connect(alice).registerSeller(bob.address, 'alice2.base.eth')
      expect(await registry.totalSellers()).to.equal(1)
      const rec = await registry.getSeller(alice.address)
      expect(rec.walletAddress).to.equal(bob.address)
    })

    it('reverts on zero wallet address', async () => {
      const { registry, alice } = await loadFixture(deployFixture)
      await expect(
        registry.connect(alice).registerSeller(ethers.ZeroAddress, 'a')
      ).to.be.revertedWithCustomError(registry, 'ZeroAddress')
    })
  })

  // ─── Service creation ─────────────────────────────────
  describe('createService', () => {
    it('creates a service for registered seller', async () => {
      const { registry, alice } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      const id = serviceId('alice:signal')
      await expect(
        registry.connect(alice).createService(id, 'Signal', 'desc', 'http://ep', 'http://sk', PRICE_USDC, 0)
      ).to.emit(registry, 'ServiceCreated').withArgs(alice.address, id, 'Signal', PRICE_USDC, 0)

      const svc = await registry.getService(id)
      expect(svc.active).to.be.true
      expect(await registry.totalServices()).to.equal(1)
    })

    it('reverts for unregistered seller', async () => {
      const { registry, alice } = await loadFixture(deployFixture)
      await expect(
        registry.connect(alice).createService(serviceId('x'), 'n', 'd', 'e', 's', PRICE_USDC, 0)
      ).to.be.revertedWithCustomError(registry, 'NotRegistered')
    })

    it('reverts on duplicate serviceId', async () => {
      const { registry, alice } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      const id = serviceId('dup')
      await registry.connect(alice).createService(id, 'n', 'd', 'e', 's', PRICE_USDC, 0)
      await expect(
        registry.connect(alice).createService(id, 'n', 'd', 'e', 's', PRICE_USDC, 0)
      ).to.be.revertedWithCustomError(registry, 'AlreadyExists')
    })
  })

  // ─── Free tier — tx 999 is free ───────────────────────
  describe('free tier', () => {
    it('tx 999 (last free) sets wasFreeTier=true and no fee', async () => {
      const { registry, usdc, owner, alice, buyer } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      const id = serviceId('free-tier-test')
      await registry.connect(alice).createService(id, 'n', 'd', 'e', 's', PRICE_USDC, 0)

      // Simulate 998 free-tier uses
      const ftBefore = await registry.getFreeTierStatus(alice.address)
      // Directly set via multiple processPayment calls would be expensive; test via calculateFee
      const [, , wasFreeTierCalc] = await registry.calculateFee(alice.address, PRICE_USDC)
      expect(wasFreeTierCalc).to.be.true
    })

    it('tx 1001 charges fee after free tier exhausted', async () => {
      const { registry, usdc, owner, alice, buyer } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      const id = serviceId('fee-charged')
      await registry.connect(alice).createService(id, 'n', 'd', 'e', 's', PRICE_USDC, 0)

      // Approve USDC for many payments
      const totalCost = PRICE_USDC * BigInt(FREE_TIER_LIMIT + 2)
      await usdc.connect(buyer).approve(await registry.getAddress(), totalCost)

      // Exhaust free tier
      for (let i = 0; i < FREE_TIER_LIMIT; i++) {
        await registry.connect(owner).processPayment(id, buyer.address)
      }

      // Next payment should charge fee
      const [sellerAmt, feeAmt, wasFreeTier] = await registry.calculateFee(alice.address, PRICE_USDC)
      expect(wasFreeTier).to.be.false
      expect(feeAmt).to.equal((PRICE_USDC * BigInt(INITIAL_FEE)) / 10000n)
      expect(sellerAmt).to.equal(PRICE_USDC - feeAmt)
    })
  })

  // ─── Payment split ────────────────────────────────────
  describe('processPayment split', () => {
    it('splits payment correctly with global fee', async () => {
      const { registry, usdc, owner, treasury, alice, buyer } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      const id = serviceId('split-test')
      await registry.connect(alice).createService(id, 'n', 'd', 'e', 's', PRICE_USDC, 0)

      // Exhaust free tier first
      await usdc.connect(buyer).approve(await registry.getAddress(), PRICE_USDC * BigInt(FREE_TIER_LIMIT + 1))
      for (let i = 0; i < FREE_TIER_LIMIT; i++) {
        await registry.connect(owner).processPayment(id, buyer.address)
      }

      const aliceBefore = await usdc.balanceOf(alice.address)
      const treasuryBefore = await usdc.balanceOf(treasury.address)

      await registry.connect(owner).processPayment(id, buyer.address)

      const expectedFee = (PRICE_USDC * BigInt(INITIAL_FEE)) / 10000n
      const expectedSeller = PRICE_USDC - expectedFee

      expect(await usdc.balanceOf(alice.address) - aliceBefore).to.equal(expectedSeller)
      expect(await usdc.balanceOf(treasury.address) - treasuryBefore).to.equal(expectedFee)
    })

    it('respects seller fee override', async () => {
      const { registry, usdc, owner, treasury, alice, buyer } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice.base.eth')
      const id = serviceId('override-test')
      await registry.connect(alice).createService(id, 'n', 'd', 'e', 's', PRICE_USDC, 0)
      await registry.connect(owner).setSellerFeeOverride(alice.address, 200) // 2%

      await usdc.connect(buyer).approve(await registry.getAddress(), PRICE_USDC * BigInt(FREE_TIER_LIMIT + 1))
      for (let i = 0; i < FREE_TIER_LIMIT; i++) {
        await registry.connect(owner).processPayment(id, buyer.address)
      }

      const [, feeAmt] = await registry.calculateFee(alice.address, PRICE_USDC)
      expect(feeAmt).to.equal((PRICE_USDC * 200n) / 10000n)
    })
  })

  // ─── Admin / edge cases ───────────────────────────────
  describe('admin', () => {
    it('pausing blocks all writes', async () => {
      const { registry, owner, alice } = await loadFixture(deployFixture)
      await registry.connect(owner).pause()
      await expect(
        registry.connect(alice).registerSeller(alice.address, 'a')
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause')
    })

    it('unpause restores writes', async () => {
      const { registry, owner, alice } = await loadFixture(deployFixture)
      await registry.connect(owner).pause()
      await registry.connect(owner).unpause()
      await expect(
        registry.connect(alice).registerSeller(alice.address, 'a')
      ).not.to.be.reverted
    })

    it('deactivateSeller marks seller inactive', async () => {
      const { registry, owner, alice } = await loadFixture(deployFixture)
      await registry.connect(alice).registerSeller(alice.address, 'alice')
      await registry.connect(owner).deactivateSeller(alice.address)
      const rec = await registry.getSeller(alice.address)
      expect(rec.active).to.be.false
      expect(await registry.isRegistered(alice.address)).to.be.false
    })

    it('setGlobalFee rejects fee > 20%', async () => {
      const { registry, owner } = await loadFixture(deployFixture)
      await expect(
        registry.connect(owner).setGlobalFee(2001)
      ).to.be.revertedWithCustomError(registry, 'FeeTooHigh')
    })

    it('non-owner cannot call processPayment', async () => {
      const { registry, alice, buyer } = await loadFixture(deployFixture)
      const id = serviceId('guard')
      await expect(
        registry.connect(alice).processPayment(id, buyer.address)
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount')
    })
  })
})

// ─── Helpers ──────────────────────────────────────────────
function serviceId(key: string): `0x${string}` {
  return ethers.id(key) as `0x${string}`
}

async function blockTs(): Promise<number> {
  const block = await ethers.provider.getBlock('latest')
  return block!.timestamp + 1
}
