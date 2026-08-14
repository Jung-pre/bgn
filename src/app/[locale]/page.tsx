import { notFound } from "next/navigation";
import { isLocale } from "@/shared/config/i18n";
import { getDictionary } from "@/shared/lib/get-dictionary";
import { MainPage } from "@/features/main/main-page";

/**
 * 라우트 파일은 **사전 조회 + feature import 만** 한다. 로직 0줄.
 *
 * 섹션이 13개라 shin 처럼 섹션별 messages 를 1:1 로 나열하면
 * 이 파일이 프롭 나열로만 30줄이 된다. 여기서는 dict 를 통째로 넘기고
 * 분배는 `MainPage` 가 한다.
 */
export default async function HomeRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <MainPage locale={locale} dict={getDictionary(locale)} />;
}
