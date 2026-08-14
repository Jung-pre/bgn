import { defaultLocale, type Locale } from "@/shared/config/i18n";
import { dictionaries, type Dictionary } from "@/shared/i18n/messages";

/** 동기 조회 — 사전이 정적 객체라 dynamic import 가 필요 없다. */
export const getDictionary = (locale: Locale): Dictionary =>
  dictionaries[locale] ?? dictionaries[defaultLocale];
