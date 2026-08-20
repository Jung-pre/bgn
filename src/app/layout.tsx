import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/static/pretendard.css";
/* 영문 포인트 폰트는 **자가 호스팅**한다(@fontsource). `next/font/google` 이 아니다.
   ① 빌드 타임에 fonts.googleapis.com 을 때리므로 폐쇄망·CI 에서 빌드가 통째로 깨진다
      (실제로 이 프로젝트 CI 환경에서 그 이유로 빌드가 실패했다)
   ② 런타임 서드파티 요청이 사라져 LCP 와 개인정보 양쪽에 낫다
   ③ 두 폰트 모두 400 단일 웨이트라 서브셋 최적화 이점도 거의 없다 */
import "@fontsource/belleza/400.css";
import "@fontsource/marcellus/400.css";
import "./globals.css";

/**
 * 루트 레이아웃은 **폰트와 metadata 만** 담당한다.
 * Provider 는 전부 `[locale]/layout.tsx` 로 내린다.
 *
 * 폰트는 Figma 변수에서 확정된 것이다(추측 아님):
 *   · 국문·본문      Pretendard   (pc/* , mo/* 전 스타일)
 *   · 영문 포인트     Belleza      (pc/eng - point/*, mo/eng - point/*)
 *     → 섹션 아이브로우, 센터 영문명 등
 *   · 마퀴 전용       Marcellus    (Figma 2:411 — Marcellus Regular 108px)
 *
 * ⚠️ 디스플레이 폰트가 **두 개**다. 마퀴만 Marcellus 이고 나머지 영문 포인트는
 *    Belleza 다. 하나로 통일하지 말 것 — 시안이 실제로 둘을 섞어 쓴다.
 *
 * Belleza 는 Regular 400 단일 웨이트만 존재한다. 볼드가 필요하면
 * 디자이너에게 다른 폰트를 요청할 것 — 합성 볼드는 쓰지 않는다.
 */
export const metadata: Metadata = {
  title: { default: "BGN 밝은눈안과 잠실", template: "%s | BGN 밝은눈안과 잠실" },
  description: "세상을 선명하게 — BGN 밝은눈안과 잠실",
};

/** viewportFit: cover — 모바일 하단 고정 퀵바가 홈 인디케이터를 피하려면 필수 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
