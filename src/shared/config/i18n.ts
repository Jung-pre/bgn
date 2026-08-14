/**
 * 시안의 언어 드롭다운이 4개국어(한국어 / English / 日本語 / 中文)다.
 * 라우트 프리픽스도 4개로 간다.
 *
 * ⚠️ 국문 전용으로 확정되면 지금 걷어내는 게 훨씬 싸다.
 *    (middleware, [locale] 라우트, messages 사전, locale-switcher 4곳)
 */
export const locales = ["ko", "en", "ja", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/** 언어 드롭다운 표기 — 각 언어의 자국어 표기를 쓴다 */
export const localeLabels: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};
