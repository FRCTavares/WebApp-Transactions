import { TransactionCategoriesPanel } from '../components/categories/TransactionCategoriesPanel'

export function CategoriesPage() {
  return (
    <section className="rules-page">
      <header>
        <p className="eyebrow">Settings</p>
        <h1>Categories</h1>
        <p className="page-subtitle">
          Manage the categories available in transaction forms and filters.
        </p>
      </header>

      <TransactionCategoriesPanel />
    </section>
  )
}
