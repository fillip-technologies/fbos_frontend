// A tax category picker. Blank means "the default": the offering's category, else the
// organization's default (Billing settings), else the tax system's.
export default function TaxCategorySelect({ categories, value, onChange, id, blankLabel = 'Default', required = false, ...rest }) {
  return (
    <select id={id} value={value} required={required} onChange={(e) => onChange(e.target.value)} {...rest}>
      {!required && <option value="">{blankLabel}</option>}
      {required && <option value="">— Choose —</option>}
      {categories.map((category) => (
        <option key={category.code} value={category.code}>
          {category.name}
          {category.treatment === 'taxable' && category.percent != null ? ` (${category.percent}%)` : ''}
        </option>
      ))}
    </select>
  )
}
