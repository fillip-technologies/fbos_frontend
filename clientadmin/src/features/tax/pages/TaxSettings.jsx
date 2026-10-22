import { useSearchParams } from 'react-router-dom'
import { ACCESS, hasAccess } from '@/features/auth/access.js'
import { useAuth } from '@/features/auth/AuthContext.jsx'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'
import OrgSwitcher from '@/features/organizations/components/OrgSwitcher.jsx'
import BillingSettings from '@/features/tax/components/BillingSettings.jsx'
import TaxConfigEntries from '@/features/tax/components/TaxConfigEntries.jsx'
import TaxHistory from '@/features/tax/components/TaxHistory.jsx'
import TaxPacks from '@/features/tax/components/TaxPacks.jsx'
import TaxRegistrations from '@/features/tax/components/TaxRegistrations.jsx'

const TABS = [
  ['registrations', 'Registrations'],
  ['billing', 'Billing settings'],
  ['config', 'Rates & rules'],
  ['packs', 'Packs'],
  ['history', 'History'],
]

// Everything that decides how the company's documents are taxed and billed. None of it is
// built into the code: it is data with dates, so a change of law is a new entry from its date.
export default function TaxSettings() {
  const [params, setParams] = useSearchParams()
  const { user: me } = useAuth()
  const { orgId, activeOrg } = useActiveOrg()
  const canManage = hasAccess(me, ACCESS.manageTax)
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'registrations'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tax setup</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            How {activeOrg ? `“${activeOrg.name}”` : 'this company'}’s quotations and invoices are taxed, numbered and billed.
          </p>
        </div>
        <OrgSwitcher />
      </div>

      <div className="version-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`version-tab${tab === key ? ' active' : ''}`}
            onClick={() => setParams(key === 'registrations' ? {} : { tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'registrations' && <TaxRegistrations orgId={orgId} canManage={canManage} />}
      {tab === 'billing' && <BillingSettings key={orgId} orgId={orgId} canManage={canManage} />}
      {tab === 'config' && <TaxConfigEntries orgId={orgId} canManage={canManage} />}
      {tab === 'packs' && <TaxPacks orgId={orgId} canManage={canManage} />}
      {tab === 'history' && <TaxHistory orgId={orgId} />}
    </div>
  )
}
