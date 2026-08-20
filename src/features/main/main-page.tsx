"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/shared/config/i18n";
import type { Dictionary } from "@/shared/i18n/messages";
import { HeroSection } from "@/features/main/sections/hero/hero-section";
import styles from "./main-page.module.css";

/**
 * 메인 랜딩 — 시안 1페이지(1920×21975, 24프레임)를 13개 섹션으로 매핑한 결과.
 *
 * ## 섹션 순서 (시안 스크롤 순)
 *   1  히어로            구체 → 타워 스크롤 전환      3D + 이미지 레이어
 *   2  브랜드 필름        **영상** (1920×1080)         GNB 숨김
 *   3  의료진            교차 이동 캐러셀(8인)
 *   4  AI 정밀검사 시스템  4스텝 + 데이터 비주얼 + 마퀴
 *   5  AI 상담 신청       폼 + **영상** 762×762       유일한 중간톤 블록
 *   6  AI 브랜드 스토리    탭 3 + 비디오
 *   7  진료 센터          가로 아코디언 6종
 *   8  히스토리           연혁 5스텝
 *   9  Web blog          pinned 가로 스크롤 + **영상 배경**
 *  10  이벤트            최대 8장, 버튼당 1장
 *  11  클로징 스피어       히어로 구체 재사용
 *  12  컨택트 + 푸터      지점 탭 + 진료시간
 *
 * ## dynamic import 경계
 * 히어로와 브랜드 슬로건만 static. 나머지는 전부 dynamic 이다.
 * `ssr` 은 끄지 않는다(기본 true) — HTML 은 서버에서 나오므로 SEO·레이아웃
 * 시프트 문제가 없고 클라이언트 JS 만 청크로 빠진다.
 * R3F Canvas 를 포함한 모듈만 각 섹션 파일 안에서 `ssr: false` 로 감싼다.
 *
 * 빌드 후 `npm run analyze:chunk` 로 three 가 진입 청크로 새지 않았는지 확인할 것.
 */

const BrandFilmSection = dynamic(() =>
  import("@/features/main/sections/brand-film/brand-film-section").then((m) => m.BrandFilmSection),
);
const MedicalTeamSection = dynamic(() =>
  import("@/features/main/sections/medical-team/medical-team-section").then(
    (m) => m.MedicalTeamSection,
  ),
);
const AiSystemSection = dynamic(() =>
  import("@/features/main/sections/ai-system/ai-system-section").then((m) => m.AiSystemSection),
);
const AiConsultSection = dynamic(() =>
  import("@/features/main/sections/ai-consult/ai-consult-section").then((m) => m.AiConsultSection),
);
const AiStorySection = dynamic(() =>
  import("@/features/main/sections/ai-story/ai-story-section").then((m) => m.AiStorySection),
);
const CentersSection = dynamic(() =>
  import("@/features/main/sections/centers/centers-section").then((m) => m.CentersSection),
);
const HistorySection = dynamic(() =>
  import("@/features/main/sections/history/history-section").then((m) => m.HistorySection),
);
const WebBlogSection = dynamic(() =>
  import("@/features/main/sections/web-blog/web-blog-section").then((m) => m.WebBlogSection),
);
const EventSection = dynamic(() =>
  import("@/features/main/sections/event/event-section").then((m) => m.EventSection),
);
const ClosingSphereSection = dynamic(() =>
  import("@/features/main/sections/closing-sphere/closing-sphere-section").then(
    (m) => m.ClosingSphereSection,
  ),
);
const FooterContactSection = dynamic(() =>
  import("@/features/main/sections/footer-contact/footer-contact-section").then(
    (m) => m.FooterContactSection,
  ),
);

export interface MainPageProps {
  locale: Locale;
  dict: Dictionary;
}

export function MainPage({ dict }: MainPageProps) {
  return (
    <main className={styles.root}>
      <HeroSection messages={dict.heroSection} />
      {/* 시안 PC 플로우(8:282) 의 y 좌표 순서를 그대로 따른다.
          8:868 BGN 의료진(y=3680) → 8:961 브랜드 영상(y=4649) → 8:962 AI 시스템(y=5729).
          한동안 영상이 의료진 앞에 있었는데 시안과 뒤바뀐 것이었다. */}
      <MedicalTeamSection messages={dict.medicalTeamSection} />
      <BrandFilmSection />
      <AiSystemSection messages={dict.aiSystemSection} />
      <AiConsultSection messages={dict.aiConsultSection} />
      <AiStorySection messages={dict.aiStorySection} />
      <CentersSection messages={dict.centersSection} />
      <HistorySection messages={dict.historySection} />
      <WebBlogSection messages={dict.blogSection} />
      <EventSection messages={dict.eventSection} />
      <ClosingSphereSection />
      <FooterContactSection messages={dict.footer} />
    </main>
  );
}
