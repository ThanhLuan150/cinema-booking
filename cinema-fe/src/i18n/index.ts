import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = ['vi', 'en', 'zh', 'ko', 'th', 'ja', 'ru', 'fr', 'de', 'hi'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Every JSON file under src/locales/<lng>/<namespace>.json is picked up automatically,
// so adding a new namespace only requires dropping in the file — no edits here.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  '../locales/*/*.json',
  { eager: true },
);

type Resources = Record<string, Record<string, Record<string, unknown>>>;

const resources: Resources = {};
const namespaceSet = new Set<string>();

for (const path in localeModules) {
  const match = path.match(/\.\.\/locales\/([a-zA-Z-]+)\/([\w-]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  resources[lng] ??= {};
  resources[lng][ns] = localeModules[path].default;
  namespaceSet.add(ns);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: Array.from(namespaceSet),
    defaultNS: 'common',
    fallbackLng: 'vi',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lang',
    },
  });

export default i18n;
