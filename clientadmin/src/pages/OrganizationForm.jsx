import { DEFAULT_FISCAL_YEAR_START, FISCAL_YEAR_PATTERN, formatFiscalYearStart } from '../utils/format.js'

// Shared field block for creating / editing an organization.
// `fieldErrors` is the { field: message } map from getFieldErrors().
export default function OrganizationFields({ form, set, fieldErrors, isCreate }) {
  const fyInvalid = !new RegExp(FISCAL_YEAR_PATTERN).test(form.fiscal_year_start)
  return (
    <>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            className={fieldErrors.name ? 'invalid' : ''}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
          {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
        </div>
        <div className="field">
          <label htmlFor="code">Code {isCreate && '*'}</label>
          <input
            id="code"
            className={fieldErrors.code ? 'invalid' : ''}
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            disabled={!isCreate}
            required={isCreate}
            placeholder="ACME-IN"
          />
          {fieldErrors.code ? (
            <div className="field-error">{fieldErrors.code}</div>
          ) : (
            <div className="hint">{isCreate ? 'Unique slug used to identify the organization.' : 'Cannot be changed.'}</div>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="email">Contact email *</label>
        <input
          id="email"
          type="email"
          className={fieldErrors.email ? 'invalid' : ''}
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
        />
        {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="base_currency">Base currency</label>
          <input
            id="base_currency"
            value={form.base_currency}
            onChange={(e) => set('base_currency', e.target.value.toUpperCase())}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="timezone">Timezone</label>
          <input id="timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="fiscal_year_start">Fiscal year start (DD-MM)</label>
        <input
          id="fiscal_year_start"
          className={fieldErrors.fiscal_year_start || fyInvalid ? 'invalid' : ''}
          value={form.fiscal_year_start}
          onChange={(e) => set('fiscal_year_start', e.target.value)}
          pattern={FISCAL_YEAR_PATTERN}
          placeholder={DEFAULT_FISCAL_YEAR_START}
          required
        />
        {fieldErrors.fiscal_year_start || fyInvalid ? (
          <div className="field-error">Use DD-MM, for example 01-04 for 1 April.</div>
        ) : (
          <div className="hint">Your fiscal year begins on {formatFiscalYearStart(form.fiscal_year_start)}.</div>
        )}
      </div>
    </>
  )
}
