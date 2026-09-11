import type { PresentationPreferences } from '../utils/format'

const en = {
  settings: 'Settings',
  settingsSubtitle: 'Manage your preferences, account, and data.',
  preferences: 'Preferences',
  preferencesDescription: 'Personalise your experience and set your defaults.',
  language: 'Language',
  locale: 'Locale',
  defaultCurrency: 'Default currency',
  timeZone: 'Time zone',
  dateFormat: 'Date format',
  monthlyInvestmentGoal: 'Monthly investment goal',
  monthlyInvestmentGoalHint:
    'Used to track monthly investment progress on the Dashboard.',
  investmentGoalInvalid: 'Enter an amount greater than zero.',
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  savePreferences: 'Save preferences',
  saving: 'Saving...',
  preferencesSaved: 'Preferences saved.',
  preferencesSaveFailed: 'Could not save preferences.',
  account: 'Account',
  accountDescription: 'Manage your account and sign-in details.',
  localMode: 'Local mode',
  signedIn: 'Signed in with account access enabled.',
  localDescription: 'No account controls are active on this local setup.',
  signOut: 'Sign out',
  localOnly: 'Local only',
  categories: 'Categories',
  categoriesDescription: 'Choose the categories available in transactions.',
  dataOrganisation: 'Data & organisation',
  dataOrganisationDescription: "Manage your financial data and how it's organised.",
  import: 'Import',
  importDescription: 'Preview CSV/XLSX files before committing rows.',
  exportBackup: 'Export / Backup',
  exportDescription: 'Export records for backup or manual inspection.',
} as const

type MessageKey = keyof typeof en

const pt: Record<MessageKey, string> = {
  settings: 'Definições',
  settingsSubtitle: 'Gerir as suas preferências, conta e dados.',
  preferences: 'Preferências',
  preferencesDescription: 'Personalize a sua experiência e defina as predefinições.',
  language: 'Idioma',
  locale: 'Região',
  defaultCurrency: 'Moeda predefinida',
  timeZone: 'Fuso horário',
  dateFormat: 'Formato da data',
  monthlyInvestmentGoal: 'Objetivo mensal de investimento',
  monthlyInvestmentGoalHint:
    'Utilizado para acompanhar o progresso mensal de investimento no Dashboard.',
  investmentGoalInvalid: 'Introduza um valor superior a zero.',
  short: 'Curto',
  medium: 'Médio',
  long: 'Longo',
  savePreferences: 'Guardar preferências',
  saving: 'A guardar...',
  preferencesSaved: 'Preferências guardadas.',
  preferencesSaveFailed: 'Não foi possível guardar as preferências.',
  account: 'Conta',
  accountDescription: 'Gerir a sua conta e dados de sessão.',
  localMode: 'Modo local',
  signedIn: 'Sessão iniciada com acesso à conta.',
  localDescription: 'Não existem controlos de conta ativos nesta instalação local.',
  signOut: 'Terminar sessão',
  localOnly: 'Apenas local',
  categories: 'Categorias',
  categoriesDescription: 'Escolha as categorias disponíveis nas transações.',
  dataOrganisation: 'Dados e organização',
  dataOrganisationDescription: 'Gerir os seus dados financeiros e a forma como estão organizados.',
  import: 'Importar',
  importDescription: 'Pré-visualize ficheiros CSV/XLSX antes de guardar linhas.',
  exportBackup: 'Exportar / Cópia de segurança',
  exportDescription: 'Exporte registos para cópia de segurança ou inspeção manual.',
}

const catalogs = { en, pt }

export function translate(language: PresentationPreferences['language'], key: MessageKey) {
  return catalogs[language][key]
}
