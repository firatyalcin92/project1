import { useState } from 'react'
import type { Role } from '~/lib/views'
import { cx } from './ui'

/**
 * Grafik kuralları (dataviz):
 * - Partner A: --color-partner-a, Partner B: --color-partner-b (açık/koyu mod ayrı doğrulandı)
 * - Metin hiçbir zaman seri renginde değildir; kimlik yanındaki renkli işaretten gelir.
 * - 2 seri → her zaman lejant; hover/odak ipucu; tablo görünümü.
 */

/** Tek bir başlık sayısı için ölçer: X / hedef. */
export function ProgressRing({
  value,
  max,
  size = 76,
  label,
}: {
  value: number
  max: number
  size?: number
  label: string
}) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, value / max)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-clay-soft)" strokeWidth={stroke} />
        {pct > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-clay)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-ink tabular-nums">
        {Math.min(value, max)}/{max}
      </span>
    </div>
  )
}

export function PartnerLegend({ names }: { names: Record<Role, string> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft" aria-label="Lejant">
      {(['A', 'B'] as const).map((r) => (
        <li key={r} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ background: r === 'A' ? 'var(--color-partner-a)' : 'var(--color-partner-b)' }}
            aria-hidden
          />
          {names[r]}
        </li>
      ))}
    </ul>
  )
}

export type PairedRow = { id: string; label: string; A: number; B: number }

/** İki partnerin aynı kategorilerdeki sayımlarını yan yana gösteren yatay çubuklar. */
export function PairedBars({ title, rows, names }: { title: string; rows: PairedRow[]; names: Record<Role, string> }) {
  const [hover, setHover] = useState<string | null>(null)
  const visible = rows.filter((r) => r.A + r.B > 0).sort((x, y) => y.A + y.B - (x.A + x.B))
  const max = Math.max(1, ...visible.flatMap((r) => [r.A, r.B]))

  if (visible.length === 0) {
    return <p className="text-sm text-ink-faint">Henüz paylaşılmış bir seçim yok.</p>
  }

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <PartnerLegend names={names} />
      </figcaption>

      <ul className="space-y-3">
        {visible.map((row) => (
          <li
            key={row.id}
            tabIndex={0}
            onPointerEnter={() => setHover(row.id)}
            onPointerLeave={() => setHover((h) => (h === row.id ? null : h))}
            onFocus={() => setHover(row.id)}
            onBlur={() => setHover((h) => (h === row.id ? null : h))}
            className={cx('relative rounded-lg px-1 py-1 outline-none transition', hover === row.id && 'bg-sunken')}
            aria-label={`${row.label}: ${names.A} ${row.A}, ${names.B} ${row.B}`}
          >
            <p className="mb-1 text-[13px] text-ink-soft">{row.label}</p>
            <div className="space-y-[2px]">
              {(['A', 'B'] as const).map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <div className="h-2.5 flex-1">
                    <div
                      className="h-full rounded-r-[4px] transition-[width] duration-500"
                      style={{
                        width: `${(row[role] / max) * 100}%`,
                        minWidth: row[role] > 0 ? 6 : 0,
                        background: role === 'A' ? 'var(--color-partner-a)' : 'var(--color-partner-b)',
                      }}
                    />
                  </div>
                  <span className="w-5 text-right text-[12px] text-ink-faint tabular-nums">{row[role] || ''}</span>
                </div>
              ))}
            </div>
            {hover === row.id ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute -top-2 right-1 z-10 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-lift"
              >
                <p className="text-ink-faint">{row.label}</p>
                {(['A', 'B'] as const).map((role) => (
                  <p key={role} className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: role === 'A' ? 'var(--color-partner-a)' : 'var(--color-partner-b)' }}
                      aria-hidden
                    />
                    <strong className="text-ink tabular-nums">{row[role]}</strong>
                    <span className="text-ink-soft">{names[role]}</span>
                  </p>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <details className="text-[13px] text-ink-soft">
        <summary className="cursor-pointer select-none py-1 font-medium">Tablo olarak gör</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="py-1 font-medium">{title}</th>
              <th className="py-1 text-right font-medium">{names.A}</th>
              <th className="py-1 text-right font-medium">{names.B}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right tabular-nums">{r.A}</td>
                <td className="py-1 text-right tabular-nums">{r.B}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
