import { Link, useParams } from 'react-router-dom'
import BoardView from '@/features/delivery/components/BoardView.jsx'
import useDeliveryNames from '@/features/delivery/useDeliveryNames.js'
import { useActiveOrg } from '@/features/organizations/ActiveOrg.jsx'

// One customer's work across all their projects, as a board (the customer page links here).
export default function CustomerBoard() {
  const { clientId } = useParams()
  const { orgId } = useActiveOrg()
  const names = useDeliveryNames(orgId)
  const known = names.customerName({ id: clientId })
  const name = known && known !== '—' ? known : null
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{name ? `${name}: board` : 'Customer board'}</h1>
          <p className="muted">
            Every task of this customer's projects, by column. <Link to={`/customers/${clientId}`}>Back to the customer</Link>
          </p>
        </div>
      </div>
      <BoardView
        key={`${orgId}-${clientId}`}
        orgId={orgId}
        scope={{ client_id: clientId }}
        names={names}
        intro="Drag a card to reorder it, or to another column to move the task on. New tasks are added on a project's own board."
      />
    </div>
  )
}
