"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
import { VideoSlot } from "@/components/video-slot/video-slot";
import styles from "./brand-film-section.module.css";

/**
 * 브랜드 필름 — Figma `2:994` "BGN잠실 메인페이지 영상_2차본 1" (1920×1080).
 *
 * ⚠️ 3D 가 아니다. Figma 주석이 `영상` 이고, 기획안 히어로 3안이 이 영상이다:
 *   "부산에서 시작해 강남, 잠실을 거쳐 세계를 향한 BGN의 도약 /
 *    '150년을 내다보는 안과'"
 *
 * 프레임 높이가 유일하게 1080 이다(나머지는 920) — 16:9 풀블리드.
 *
 * ## UI 전체 숨김
 * 시안에서 이 프레임만 GNB·퀵바가 전부 없다. 섹션이 뷰포트를 채우는 동안
 * `<body data-gnb-hide="true">` 를 세운다. GNB 쪽은 이 속성을 CSS 로 받는다
 * (컴포넌트 간 결합을 만들지 않으려고 context 대신 data 속성을 쓴다).
 */
const VIDEO_SRC = undefined; // TODO: 영상 도착 시 "/main/brand-film/film.mp4"
/**
 * 시안 `8:961` 그 프레임이다 — 한강 야경 위에 빛으로 그린 `BGn` 글씨가 떠 있는 컷.
 * (같은 폴더의 `poster.webp` 는 글씨 없는 클린 플레이트라 시안과 다르다.)
 * 영상이 오면 `VIDEO_SRC` 만 채우면 되고 이 값은 그대로 poster 로 남는다.
 */
const VIDEO_POSTER = "/main/brand-film/poster-2.webp";

export function BrandFilmSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top 20%",
        end: "bottom 30%",
        onToggle: (self) => {
          document.body.dataset.gnbHide = self.isActive ? "true" : "false";
        },
      });

      return () => {
        // revert 까지 해야 ScrollTrigger 가 만든 DOM/스타일이 남지 않는다.
        st.kill(true);
        delete document.body.dataset.gnbHide;
      };
    },
    { scope: sectionRef },
  );

  // 언마운트 시 속성이 남지 않도록 이중 안전장치
  useEffect(
    () => () => {
      delete document.body.dataset.gnbHide;
    },
    [],
  );

  return (
    <section ref={sectionRef} className={styles.section} aria-label="BGN 브랜드 필름">
      <VideoSlot
        src={VIDEO_SRC}
        poster={VIDEO_POSTER}
        decorative
        className={styles.video}
        rootMargin="400px 0px"
      />
    </section>
  );
}
