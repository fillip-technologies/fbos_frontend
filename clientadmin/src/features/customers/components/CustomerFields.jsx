import { CUSTOMER_STATUSES, CUSTOMER_TYPES, GST_STATES, capitalize } from '@/features/customers/utils.js'

function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

// Customer form body, shared by create and edit. Type, PAN and source are set once at
// creation (the backend doesn't change them); status is only changed on an existing customer.
// `owners` is the company's users, or null when they can't be listed (then only `me`).
export default function CustomerFields({ form, set, setAddress, fieldErrors, owners, me, isCreate }) {
  const ownerChoices = owners || [me].filter(Boolean)
  const knownOwner = ownerChoices.some((u) => u.id === form.owner_user_id)

  return (
    <>
      <div className="grid-2">
        <Field id="name" label="Display name *" error={fieldErrors.name}>
          <input id="name" required maxLength={255} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id="legal_name" label="Legal name *" error={fieldErrors.legal_name}>
          <input
            id="legal_name"
            required
            maxLength={512}
            value={form.legal_name}
            onChange={(e) => set('legal_name', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid-2">
        {isCreate ? (
          <Field id="client_type" label="Type">
            <select id="client_type" value={form.client_type} onChange={(e) => set('client_type', e.target.value)}>
              {Object.entries(CUSTOMER_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field id="status" label="Status">
            <select id="status" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>{capitalize(s)}</option>
              ))}
            </select>
          </Field>
        )}
        <Field
          id="owner_user_id"
          label="Owner *"
          error={fieldErrors.owner_user_id}
          hint={owners ? 'The person responsible for this customer.' : 'You can only pick yourself: the user list needs permission to view users.'}
        >
          <select
            id="owner_user_id"
            required
            value={form.owner_user_id}
            onChange={(e) => set('owner_user_id', e.target.value)}
          >
            <option value="">— Choose —</option>
            {!knownOwner && form.owner_user_id && <option value={form.owner_user_id}>Current owner</option>}
            {ownerChoices.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me?.id ? `${u.name} (you)` : u.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid-2">
        <Field
          id="gstin"
          label="GSTIN"
          error={fieldErrors.gstin}
          hint="15 characters, starting with the billing state's code."
        >
          <input
            id="gstin"
            className="mono-input"
            maxLength={15}
            value={form.gstin}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
          />
        </Field>
        {isCreate && (
          <Field id="pan" label="PAN" error={fieldErrors.pan}>
            <input
              id="pan"
              className="mono-input"
              maxLength={10}
              value={form.pan}
              onChange={(e) => set('pan', e.target.value.toUpperCase())}
            />
          </Field>
        )}
      </div>

      <h3 style={{ margin: '8px 0 10px', fontSize: 15 }}>Billing address</h3>
      <div className="grid-2">
        <Field id="line1" label="Address line 1 *" error={fieldErrors.line1}>
          <input id="line1" required value={form.address.line1} onChange={(e) => setAddress('line1', e.target.value)} />
        </Field>
        <Field id="line2" label="Address line 2">
          <input id="line2" value={form.address.line2} onChange={(e) => setAddress('line2', e.target.value)} />
        </Field>
      </div>
      <div className="grid-3">
        <Field id="city" label="City *" error={fieldErrors.city}>
          <input id="city" required value={form.address.city} onChange={(e) => setAddress('city', e.target.value)} />
        </Field>
        <Field id="state_code" label="State *" error={fieldErrors.state_code || fieldErrors.state}>
          <select
            id="state_code"
            required
            value={form.address.state_code}
            onChange={(e) => setAddress('state_code', e.target.value)}
          >
            <option value="">— Choose —</option>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
            ))}
          </select>
        </Field>
        <Field id="postal_code" label="PIN code *" error={fieldErrors.postal_code}>
          <input
            id="postal_code"
            required
            value={form.address.postal_code}
            onChange={(e) => setAddress('postal_code', e.target.value)}
          />
        </Field>
      </div>

      {isCreate && (
        <Field id="source" label="Source" hint="Where this customer came from, e.g. referral or website.">
          <input id="source" value={form.source} onChange={(e) => set('source', e.target.value)} />
        </Field>
      )}
    </>
  )
}
