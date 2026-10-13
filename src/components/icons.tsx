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
