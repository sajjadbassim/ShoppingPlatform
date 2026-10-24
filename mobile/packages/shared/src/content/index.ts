import { legalDocuments, LAST_UPDATED } from './legal';
import { supportDocuments, SUPPORT_LAST_UPDATED } from './support';

export { CONTACT } from './company';
export { faqs, faqCategories } from './support';

// كتل القسم: نص | { list } | { note }
export type DocBlock = string | { list: string[] } | { note: string };
export interface DocSection {
  id: string;
  title: string;
  content: DocBlock[];
}
export interface InfoDocument {
  title: string;
  subtitle: string;
  sections: DocSection[];
  action?: { label: string; path: string };
  lastUpdated: string;
}

export type InfoDocKey = 'terms' | 'privacy' | 'usage' | 'shipping' | 'returnPolicy' | 'payment';

const withDate = (docs: object, date: string) =>
  Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, { ...d, lastUpdated: date }]));

export const infoDocuments = {
  ...withDate(legalDocuments, LAST_UPDATED),
  ...withDate(supportDocuments, SUPPORT_LAST_UPDATED),
} as unknown as Record<InfoDocKey, InfoDocument>;
