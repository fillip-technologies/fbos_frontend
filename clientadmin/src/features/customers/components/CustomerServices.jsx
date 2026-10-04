import { useCallback, useEffect, useState } from 'react'
import { clientServicesApi } from '@/features/customers/api.js'
import useServiceCatalog from '@/features/customers/useServiceCatalog.js'
import ErrorBanner from '@/shared/components/ErrorBanner.jsx'
import ServiceForm from '@/features/customers/components/ServiceForm.jsx'
import ServicesTable from '@/features/customers/components/ServicesTable.jsx'

// The outside services one customer uses, with add / edit / delete for those allowed.
export default function CustomerServices({ orgId, customerId, canManage, defaultCurrency }) {
  const catalog = useServiceCatalog(canManage ? orgId : null)
  const [services, setServices] = useState([])
  const [cursor, setCursor] = useState(undefined)
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // null: no form; 'new': adding; a record: editing it.
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    clientServicesApi
      .listForCustomer(orgId, customerId, { limit: 50, cursor })
      .then((res) => {
        setServices((prev) => (cursor ? [...prev, ...res.data] : res.data))
        setNext(res.page?.has_more ? res.page.next_cursor : null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [orgId, customerId, cursor])
  useEffect(load, [load])

  function reloadFromStart() {
    setEditing(null)
    if (cursor === undefined) load()
    else setCursor(undefined)
  }

  async function save(body) {
    if (editing === 'new') await clientServicesApi.create(orgId, customerId, body)
    else if (Object.keys(body).length) await clientServicesApi.update(orgId, editing.id, editing.version, body)
    reloadFromStart()
  }

  async function remove(service) {
    if (!window.confirm(`Delete “${service.name}”? This can't be undone.`)) return
    setError(null)
    try {
      await clientServicesApi.remove(orgId, service.id)
      reloadFromStart()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div>
      <div className="section-head">
        <p className="muted small" style={{ margin: 0 }}>
          Hosting, domains, insurance, telecom and anything else this customer uses, with renewal dates.
        </p>
        {canManage && !editing && (
          <button type="button" className="btn" onClick={() => setEditing('new')}>+ Add service</button>
        )}
      </div>

      <ErrorBanner error={error || catalog.error} onRetry={error ? load : catalog.reload} />
      {editing && !catalog.loading && (
        <ServiceForm
          key={editing === 'new' ? 'new' : editing.id}
          service={editing === 'new' ? null : editing}
          providers={catalog.providers}
          categories={catalog.categories}
          defaultCurrency={defaultCurrency}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      <div style={{ marginTop: 14 }}>
        <ServicesTable
          services={services}
          loading={loading && !services.length}
          onEdit={canManage ? setEditing : null}
          onDelete={canManage ? remove : null}
        />
      </div>
      {next && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn secondary" disabled={loading} onClick={() => setCursor(next)}>Load more</button>
        </div>
      )}
    </div>
  )
}
