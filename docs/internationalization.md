# Internationalization

The initial supported languages and locales are English (`en`, `en-GB`) and Portuguese (`pt`, `pt-PT`). User preferences persist the language, locale, ISO 4217 display currency, IANA time zone, and date style.

`frontend/src/utils/format.ts` is the presentation boundary for currency and dates. Callers should pass a currency when displaying source data; omitting it intentionally uses the user's default display currency. Importers and stored transaction currencies remain source-specific and are not converted by presentation settings.

New interface copy should be added through language message catalogs as screens are translated; the persisted language field and document language are already wired so components do not need to own browser-locale logic.
