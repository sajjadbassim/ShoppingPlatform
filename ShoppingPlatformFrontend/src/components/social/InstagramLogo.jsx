import { useId } from 'react'

// شعار إنستغرام (التدرّج الرسمي)
const InstagramLogo = ({ className = 'w-6 h-6' }) => {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="0.3" cy="1.07" r="1.3">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset="0.1" stopColor="#fdf497" />
          <stop offset="0.5" stopColor="#fd5949" />
          <stop offset="0.68" stopColor="#d6249f" />
          <stop offset="1" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${id})`} />
      <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3.4" />
      <circle cx="24" cy="24" r="6.2" fill="none" stroke="#fff" strokeWidth="3.4" />
      <circle cx="32.4" cy="15.6" r="2" fill="#fff" />
    </svg>
  )
}

export default InstagramLogo
