import india from '@svg-maps/india'

// GST state codes (the place of supply revenue keeps) → the map's state ids. Ladakh (38) has no
// shape in this map; 97 and 99 are not states.
const GST_TO_MAP = {
  '01': 'jk', '02': 'hp', '03': 'pb', '04': 'ch', '05': 'ut', '06': 'hr', '07': 'dl', '08': 'rj', '09': 'up', 10: 'br',
  11: 'sk', 12: 'ar', 13: 'nl', 14: 'mn', 15: 'mz', 16: 'tr', 17: 'ml', 18: 'as', 19: 'wb', 20: 'jh',
  21: 'or', 22: 'ct', 23: 'mp', 24: 'gj', 25: 'dd', 26: 'dn', 27: 'mh', 29: 'ka', 30: 'ga', 31: 'ld',
  32: 'kl', 33: 'tn', 34: 'py', 35: 'an', 36: 'tg', 37: 'ap',
}

const norm = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '')
const BY_NAME = Object.fromEntries(india.locations.map((l) => [norm(l.name), l.id]))

// The map shape for a place key: a GST code ("27") or a state name.
export function mapIdFor(key, name) {
  return GST_TO_MAP[String(key).padStart(2, '0')] ?? GST_TO_MAP[key] ?? BY_NAME[norm(name ?? key)] ?? BY_NAME[norm(key)] ?? null
}

// India by state, each shaded by its value (darker = more). `values` is { mapId: { value, label } }.
export default function IndiaMap({ values, format, title }) {
  const max = Math.max(0, ...Object.values(values).map((v) => v.value))
  return (
    <svg className="cc-map" viewBox={india.viewBox} role="img" aria-label={title}>
      {india.locations.map((l) => {
        const v = values[l.id]
        const level = v && max > 0 ? 0.25 + 0.75 * (v.value / max) : 0
        return (
          <path key={l.id} d={l.path} className="cc-map-state"
            style={{ fill: v ? `rgba(2, 66, 162, ${level.toFixed(2)})` : undefined }}>
            <title>{v ? `${l.name}: ${format(v.value)}` : `${l.name}: none`}</title>
          </path>
        )
      })}
    </svg>
  )
}
