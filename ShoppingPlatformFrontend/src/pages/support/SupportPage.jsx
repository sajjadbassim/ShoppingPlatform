// src/pages/support/SupportPage.jsx
import { Truck, RotateCcw, CreditCard } from 'lucide-react'
import DocumentPage from '../../components/common/DocumentPage'
import { supportDocuments, SUPPORT_LAST_UPDATED } from './supportContent'

const docIcons = {
  shipping: Truck,
  returnPolicy: RotateCcw,
  payment: CreditCard,
}

const documents = Object.fromEntries(
  Object.entries(supportDocuments).map(([key, d]) => [key, { ...d, icon: docIcons[key] }])
)

const SupportPage = ({ doc }) => (
  <DocumentPage
    documents={documents}
    docKey={doc}
    group={{ label: 'الدعم', path: '/help' }}
    lastUpdated={SUPPORT_LAST_UPDATED}
  />
)

export default SupportPage
