import { TransactionCategoriesPanel } from '../components/categories/TransactionCategoriesPanel'
import { PageHeader } from '../components/ui'

export function CategoriesPage() {
  return (
    <section className="rules-page">
      <PageHeader
        eyebrow="Settings"
        title="Categories"
        description="Manage the categories available in transaction forms and filters."
      />

      <TransactionCategoriesPanel />
    </section>
  )
}
