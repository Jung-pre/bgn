import { notFound } from "next/navigation";
import { isLocale, locales } from "@/shared/config/i18n";
import { getDictionary } from "@/shared/lib/get-dictionary";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import { Gnb } from "@/components/gnb/gnb";
import { FloatingQuick } from "@/components/floating/floating-quick";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * 로케일 레이아웃 — provider 와 전역 UI 는 전부 여기.
 *
 * `SmoothScrollProvider` 가 children 을 **감싸지 않고 형제로** 렌더되는 게 포인트.
 * 감싸면 서버 컴포넌트 children 이 client boundary 안으로 들어가 번들이 커진다.
 *
 * GNB / 플로팅 퀵은 라우트가 바뀌어도 언마운트되지 않아야 스크롤 리스너와
 * 열림 상태가 유지된다 → 페이지가 아니라 레이아웃에 둔다.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <div lang={locale} data-locale={locale} className="locale-root">
      <SmoothScrollProvider />
      <Gnb locale={locale} messages={dict.gnb} />
      {children}
      <FloatingQuick messages={dict.gnb} />
    </div>
  );
}
