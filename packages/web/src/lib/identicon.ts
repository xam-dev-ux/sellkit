// Generate a simple SVG identicon from an address
export function generateIdenticon(address: string, size = 32): string {
  const hash = simpleHash(address.toLowerCase())
  const colors = ['#0052FF', '#00C48C', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
  const bg = colors[hash % colors.length]
  const grid = 5

  let cells = ''
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < Math.ceil(grid / 2); x++) {
      const bit = (hash >> (x + y * 3)) & 1
      if (bit) {
        const cx = x * (size / grid)
        const cy = y * (size / grid)
        const w = size / grid
        cells += `<rect x="${cx}" y="${cy}" width="${w}" height="${w}" fill="white" opacity="0.8"/>`
        // mirror
        if (x < grid - 1 - x) {
          const mx = (grid - 1 - x) * (size / grid)
          cells += `<rect x="${mx}" y="${cy}" width="${w}" height="${w}" fill="white" opacity="0.8"/>`
        }
      }
    }
  }

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${encodeURIComponent(bg)}"/>${cells}</svg>`
}

function simpleHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
