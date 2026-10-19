import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export const IconArrowLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)
export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
  </svg>
)
export const IconUnlock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 016.7-1.4" />
  </svg>
)
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5" />
    <circle cx="16.5" cy="9.5" r="2.6" />
    <path d="M15.5 14.6c2.3.1 4.2 1.7 5 4.9" />
  </svg>
)
export const IconCopy = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2" />
  </svg>
)
export const IconShare = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11M8 8l4-4 4 4" />
    <path d="M6 12.5v5a2 2 0 002 2h8a2 2 0 002-2v-5" />
  </svg>
)
export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5l1.7 4.6 4.8 1.9-4.8 1.9L12 16.5l-1.7-4.6L5.5 10l4.8-1.9z" />
    <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
)
export const IconHeart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0112 7a4.2 4.2 0 017.5 2.5c0 5.6-7.5 10-7.5 10z" />
  </svg>
)
export const IconArchive = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" />
    <path d="M5.5 9v8.5a2 2 0 002 2h9a2 2 0 002-2V9M10 13h4" />
  </svg>
)
export const IconEye = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
)
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5l7 2.8v5.3c0 4.4-3 7.8-7 8.9-4-1.1-7-4.5-7-8.9V6.3z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </svg>
)
export const IconLoop = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 8.5a4.5 4.5 0 100 7c2 0 3.2-1.6 5-3.5s3-3.5 5-3.5a4.5 4.5 0 110 7c-2 0-3.2-1.6-5-3.5S9 8.5 7 8.5z" />
  </svg>
)
export const IconKey = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="3.5" />
    <path d="M10.5 12.5L19 4M16 7l2.5 2.5M14 9l1.8 1.8" />
  </svg>
)
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconLeaf = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 5-13.5 14-14-0.3 9-6 14-14 14z" />
    <path d="M5 19c3-4 6-6.5 9.5-8.5" />
  </svg>
)
export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4l9 15.5H3z" />
    <path d="M12 10v4.2M12 17.2v.3" />
  </svg>
)
export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 4.5h-7a2 2 0 00-2 2v11a2 2 0 002 2h7M17 8.5l3.5 3.5-3.5 3.5M20.5 12H10" />
  </svg>
)
export const IconMail = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M4 7l8 6 8-6" />
  </svg>
)
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
/** Apple ile giriş düğmesi için marka işareti */
export const IconApple = ({ size = 20, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.58 1.1 8.73.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.48zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
  </svg>
)
/** Google ile giriş düğmesi için marka işareti (resmî renkler) */
export const IconGoogle = ({ size = 20, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...props}>
    <path
      fill="#4285F4"
      d="M22.5 12.24c0-.78-.07-1.53-.2-2.24H12v4.24h5.9a5.04 5.04 0 0 1-2.19 3.31v2.75h3.54c2.07-1.9 3.25-4.71 3.25-8.06z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.95 0 5.43-.98 7.24-2.65l-3.54-2.75c-.98.66-2.23 1.05-3.7 1.05-2.85 0-5.26-1.92-6.12-4.5H2.22v2.84A11 11 0 0 0 12 23z"
    />
    <path fill="#FBBC05" d="M5.88 14.15a6.6 6.6 0 0 1 0-4.3V7.01H2.22a11 11 0 0 0 0 9.98l3.66-2.84z" />
    <path
      fill="#EA4335"
      d="M12 5.35c1.6 0 3.04.55 4.18 1.63l3.13-3.13A11 11 0 0 0 2.22 7.01l3.66 2.84C6.74 7.27 9.15 5.35 12 5.35z"
    />
  </svg>
)
