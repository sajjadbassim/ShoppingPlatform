// src/pages/legal/LegalPage.jsx
import { FileText, Shield, ScrollText } from 'lucide-react'
import DocumentPage from '../../components/common/DocumentPage'
import { legalDocuments, LAST_UPDATED } from './legalContent'

const docIcons = {
  terms: FileText,
  privacy: Shield,
  usage: ScrollText,
}

const documents = Object.fromEntries(
  Object.entries(legalDocuments).map(([key, d]) => [key, { ...d, icon: docIcons[key] }])
)

const LegalPage = ({ doc }) => (
  <DocumentPage
    documents={documents}
    docKey={doc}
    group={{ label: 'القانونية', path: '/terms' }}
    lastUpdated={LAST_UPDATED}
  />
)

export default LegalPage
