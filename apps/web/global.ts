import type { Locale } from '@/lib/i18n/routing';
import type en from '@/messages/en.json';

// Typed locales and message keys: a missing or misspelled key fails
// `check-types`.
declare module 'next-intl' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: augments next-intl's interface, which needs declaration merging.
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
