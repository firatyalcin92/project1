/**
 * Sohbetteki danışmanın çizim avatarı: sade, düz renkli bir erkek terapist
 * illüstrasyonu (gerçek bir kişiyi temsil etmez). Küçük boyutta da okunur.
 */
export function TherapistAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Yapay zekâ çift terapisti"
      className={className}
    >
      <defs>
        <clipPath id="ta-clip">
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath="url(#ta-clip)">
        <rect width="64" height="64" fill="#E9D8C9" />
        {/* Kazak ve gömlek yakası */}
        <path d="M8 64c1.5-12 10.5-18.5 24-18.5S54.5 52 56 64z" fill="#5E7A8C" />
        <path d="M24.5 46.5 32 55l7.5-8.5c-2.3-.7-4.8-1-7.5-1s-5.2.3-7.5 1z" fill="#F4EEE7" />
        <path d="M29.5 49.5 32 55l2.5-5.5z" fill="#B85C3E" />
        {/* Boyun */}
        <path d="M27 40h10v7.5c-1.6 1-3.3 1.5-5 1.5s-3.4-.5-5-1.5z" fill="#D9A27E" />
        {/* Kulaklar */}
        <ellipse cx="18.6" cy="30" rx="2.6" ry="3.6" fill="#D9A27E" />
        <ellipse cx="45.4" cy="30" rx="2.6" ry="3.6" fill="#D9A27E" />
        {/* Yüz */}
        <path
          d="M19.5 26c0-8.2 5.6-13.5 12.5-13.5S44.5 17.8 44.5 26v4.5c0 7.9-5.6 13-12.5 13s-12.5-5.1-12.5-13z"
          fill="#E8B892"
        />
        {/* Sakal */}
        <path
          d="M19.6 30.5c.6 7.4 5.9 12.9 12.4 12.9s11.8-5.5 12.4-12.9c-1.2 2.6-2.6 4.3-4.3 5.2-2.2-1.6-4.9-2.2-8.1-2.2s-5.9.6-8.1 2.2c-1.7-.9-3.1-2.6-4.3-5.2z"
          fill="#4A3A31"
        />
        <path
          d="M28.2 37.6c1.1.7 2.4 1 3.8 1s2.7-.3 3.8-1"
          stroke="#E8B892"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Saç */}
        <path
          d="M18.8 27.5c-.9-9.8 4.6-17 13.4-17 8.5 0 13.9 6.4 13 16.4-1-3.6-3.2-6.4-6.4-7.8-3.7 1.6-9.6 2.2-15.3.9-2.2 1.6-3.8 4.2-4.7 7.5z"
          fill="#4A3A31"
        />
        {/* Gözlük */}
        <g fill="none" stroke="#2E2622" strokeWidth="1.5">
          <rect x="22.3" y="25.2" width="8.2" height="6.4" rx="2.6" />
          <rect x="33.5" y="25.2" width="8.2" height="6.4" rx="2.6" />
          <path d="M30.5 27.6c1-.7 2-.7 3 0" />
        </g>
        {/* Gözler ve kaşlar */}
        <circle cx="26.4" cy="28.5" r="1.2" fill="#2E2622" />
        <circle cx="37.6" cy="28.5" r="1.2" fill="#2E2622" />
        <path
          d="M23.6 23.2c1.6-.9 3.6-1 5.4-.3M35 22.9c1.8-.7 3.8-.6 5.4.3"
          stroke="#4A3A31"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Hafif gülümseme */}
        <path
          d="M29.2 34.4c1.7 1.1 3.9 1.1 5.6 0"
          stroke="#B86F55"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
