import type { PresentationPreferences } from '../utils/format'

const en = {
  settings: 'Settings',
  settingsSubtitle: 'Manage presentation, data tools, rules, and access mode.',
  languageRegion: 'Language & region',
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
  access: 'Access',
  localMode: 'Local mode',
  signedIn: 'Signed in with account access enabled.',
  localDescription: 'No account controls are active on this local setup.',
  signOut: 'Sign out',
  localOnly: 'Local only',
  organisation: 'Organisation',
  categories: 'Categories',
  categoriesDescription: 'Choose the categories available in transactions.',
  data: 'Data',
  import: 'Import',
  importDescription: 'Preview CSV/XLSX files before committing rows.',
  exportBackup: 'Export / Backup',
  exportDescription: 'Export records for backup or manual inspection.',
  open: 'Open',
} as const

type MessageKey = keyof typeof en

const pt: Record<MessageKey, string> = {
  settings: 'Definições',
  settingsSubtitle: 'Gerir apresentação, ferramentas de dados, regras e modo de acesso.',
  languageRegion: 'Idioma e região',
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
  access: 'Acesso',
  localMode: 'Modo local',
  signedIn: 'Sessão iniciada com acesso à conta.',
  localDescription: 'Não existem controlos de conta ativos nesta instalação local.',
  signOut: 'Terminar sessão',
  localOnly: 'Apenas local',
  organisation: 'Organização',
  categories: 'Categorias',
  categoriesDescription: 'Escolha as categorias disponíveis nas transações.',
  data: 'Dados',
  import: 'Importar',
  importDescription: 'Pré-visualize ficheiros CSV/XLSX antes de guardar linhas.',
  exportBackup: 'Exportar / Cópia de segurança',
  exportDescription: 'Exporte registos para cópia de segurança ou inspeção manual.',
  open: 'Abrir',
}

const catalogs = { en, pt }

export function translate(language: PresentationPreferences['language'], key: MessageKey) {
  return catalogs[language][key]
}
