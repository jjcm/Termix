import i18n, { type BackendModule, type ResourceKey } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Boot-critical subset of the English catalog (login/registration, toasts,
// shared errors) served by scripts/vite-plugin-boot-locale.ts. The full
// catalog is ~25x bigger and is merged in lazily right after boot so the
// entry bundle does not carry translations for surfaces that only exist
// behind authentication.
import enBootTranslation from "virtual:termix-boot-locale";

type LocaleModule = { default: ResourceKey };

const loadFullEnglishCatalog = () => import("../locales/en.json");

let fullEnglishCatalogPromise: Promise<ResourceKey> | null = null;
function ensureFullEnglishCatalog(): Promise<ResourceKey> {
  fullEnglishCatalogPromise ??= loadFullEnglishCatalog().then((module) => {
    const catalog = module.default as ResourceKey;
    i18n.addResourceBundle("en", "translation", catalog, true, false);
    return catalog;
  });
  return fullEnglishCatalogPromise;
}

const localeLoaders = {
  af: () => import("../locales/translated/af_ZA.json"),
  ar: () => import("../locales/translated/ar_SA.json"),
  bn: () => import("../locales/translated/bn_BD.json"),
  bg: () => import("../locales/translated/bg_BG.json"),
  ca: () => import("../locales/translated/ca_ES.json"),
  cs: () => import("../locales/translated/cs_CZ.json"),
  da: () => import("../locales/translated/da_DK.json"),
  de: () => import("../locales/translated/de_DE.json"),
  el: () => import("../locales/translated/el_GR.json"),
  "es-ES": () => import("../locales/translated/es_ES.json"),
  fi: () => import("../locales/translated/fi_FI.json"),
  fr: () => import("../locales/translated/fr_FR.json"),
  he: () => import("../locales/translated/he_IL.json"),
  hi: () => import("../locales/translated/hi_IN.json"),
  hu: () => import("../locales/translated/hu_HU.json"),
  id: () => import("../locales/translated/id_ID.json"),
  it: () => import("../locales/translated/it_IT.json"),
  ja: () => import("../locales/translated/ja_JP.json"),
  ko: () => import("../locales/translated/ko_KR.json"),
  nl: () => import("../locales/translated/nl_NL.json"),
  no: () => import("../locales/translated/no_NO.json"),
  pl: () => import("../locales/translated/pl_PL.json"),
  "pt-PT": () => import("../locales/translated/pt_PT.json"),
  "pt-BR": () => import("../locales/translated/pt_BR.json"),
  ro: () => import("../locales/translated/ro_RO.json"),
  ru: () => import("../locales/translated/ru_RU.json"),
  sr: () => import("../locales/translated/sr_SP.json"),
  "sv-SE": () => import("../locales/translated/sv_SE.json"),
  th: () => import("../locales/translated/th_TH.json"),
  tr: () => import("../locales/translated/tr_TR.json"),
  uk: () => import("../locales/translated/uk_UA.json"),
  vi: () => import("../locales/translated/vi_VN.json"),
  "zh-CN": () => import("../locales/translated/zh_CN.json"),
  "zh-TW": () => import("../locales/translated/zh_TW.json"),
} satisfies Record<string, () => Promise<LocaleModule>>;

export const supportedLngs = ["en", ...Object.keys(localeLoaders)];
const PENDING_LOGIN_LANGUAGE_KEY = "termix-pending-login-language";

export function normalizeLanguageCode(language?: string | null): string {
  if (!language) return "en";

  const normalized = language.replaceAll("_", "-");
  if (supportedLngs.includes(normalized)) return normalized;

  const exactMatch = supportedLngs.find(
    (supported) => supported.toLowerCase() === normalized.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  const baseLanguage = normalized.split("-")[0];
  return supportedLngs.includes(baseLanguage) ? baseLanguage : "en";
}

const localeBackend: BackendModule = {
  type: "backend",
  init: () => {},
  read: (language, _namespace, callback) => {
    const normalizedLanguage = normalizeLanguageCode(language);

    const loadLocale =
      normalizedLanguage === "en"
        ? undefined
        : localeLoaders[normalizedLanguage];

    if (!loadLocale) {
      ensureFullEnglishCatalog()
        .then((catalog) => callback(null, catalog))
        .catch(() => callback(null, enBootTranslation));
      return;
    }

    loadLocale()
      .then((module) => callback(null, module.default))
      .catch(() =>
        ensureFullEnglishCatalog()
          .then((catalog) => callback(null, catalog))
          .catch(() => callback(null, enBootTranslation)),
      );
  },
};

i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs,
    fallbackLng: "en",
    debug: false,

    detection: {
      order: ["localStorage", "cookie"],
      caches: ["localStorage", "cookie"],
      lookupLocalStorage: "i18nextLng",
      lookupCookie: "i18nextLng",
    },

    resources: {
      en: {
        translation: enBootTranslation,
      },
    },
    partialBundledLanguages: true,

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },
  });

// Pull in the rest of the English catalog once boot is out of the way: it is
// the fallback language, so keys outside the boot subset must resolve by the
// time an authenticated surface renders. A flat delay (rather than an idle
// callback) is deliberate: the main thread idles while the boot requests are
// in flight, so an idle callback would start this download before the first
// meaningful paint and put it back on the critical path.
if (typeof window !== "undefined") {
  window.setTimeout(() => void ensureFullEnglishCatalog(), 1500);
} else {
  void ensureFullEnglishCatalog();
}

export async function changeAppLanguage(language: string): Promise<string> {
  const normalizedLanguage = normalizeLanguageCode(language);
  await i18n.changeLanguage(normalizedLanguage);
  localStorage.setItem("i18nextLng", normalizedLanguage);
  return normalizedLanguage;
}

export function rememberLoginLanguage(language: string): string {
  const normalizedLanguage = normalizeLanguageCode(language);
  sessionStorage.setItem(PENDING_LOGIN_LANGUAGE_KEY, normalizedLanguage);
  return normalizedLanguage;
}

export function consumeLoginLanguage(): string | null {
  const language = sessionStorage.getItem(PENDING_LOGIN_LANGUAGE_KEY);
  sessionStorage.removeItem(PENDING_LOGIN_LANGUAGE_KEY);
  return language ? normalizeLanguageCode(language) : null;
}

export default i18n;
