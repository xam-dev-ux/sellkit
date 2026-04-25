interface Props {
  used: number
  limit: number
  className?: string
}

export function FreeTierBar({ used, limit, className = '' }: Props) {
  const pct = Math.min((used / limit) * 100, 100)
  const remaining = Math.max(limit - used, 0)
  const color = pct < 70 ? 'bg-success' : pct < 90 ? 'bg-warn' : 'bg-danger'

  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-muted mb-1.5">
        <span className="font-data">{used.toLocaleString()} / {limit.toLocaleString()} free tx used</span>
        <span className="font-data text-ink font-medium">{remaining.toLocaleString()} remaining</span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 && (
        <p className="text-xs text-danger mt-1">
          Free tier exhausted — platform fee applies to new transactions.
        </p>
      )}
    </div>
  )
}
