// أسماء مستويات الولاء (موحّدة مع تطبيق الهاتف) — المفتاح من الباك: bronze/silver/gold/platinum
const TIERS = {
  bronze:   { label: 'بذرة', icon: '🌱' },
  silver:   { label: 'برعم', icon: '🌿' },
  gold:     { label: 'زهرة', icon: '🌸' },
  platinum: { label: 'ثمرة', icon: '🍊' },
}

export const getTier = (tier) => TIERS[String(tier || '').toLowerCase()] || TIERS.bronze
export const tierLabel = (tier) => getTier(tier).label
export const tierWithIcon = (tier) => `${getTier(tier).icon} ${getTier(tier).label}`
