"use client";

import { useEffect, useRef } from "react";
import styles from "./ai-system-section.module.css";

/**
 * 모바일 가로 캐러셀 하단의 스크롤 인디케이터 — 시안 `68:3850`.
 *
 * ## 왜 필요한가
 * 구현에는 이게 없었고 `.grid` 의 `overflow-x: auto` 가 만드는 네이티브
 * 스크롤바만 있었다. iOS 는 손을 떼면 그마저 사라져서, 카드가 옆으로 더
 * 있다는 걸 알 방법이 없다(클라이언트 피드백: "하단 스크롤 디자인이
 * 디자인과 다르다").
 *
 * ## 시안 실측 (68:3850, 375 폭)
 *   트랙   x20~322 (303px) · 높이 2px · #e4e4e4
 *   썸     x20~230 (211px) · #0072ec        → 트랙의 69.6%
 *   아이콘 x334~351 · y674~697 (24 박스, 우측 거터 20 에 맞춤)
 *   카드 밑변 y646 → 행 윗변 y674 = 28 · 트랙↔아이콘 간격 8
 *   20 + 303 + 8 + 24 + 20 = 375 ✔
 *
 * ## 썸 길이를 비례로 잡지 않는 이유
 * 카드 4장이면 뷰포트/콘텐츠 = 375/1208 = 31% 라 시안(69.6%)의 절반도 안
 * 된다. 시안은 스크롤 0(1번 카드가 거터에 붙어 있다)을 그린 것이므로 이건
 * 비례 썸이 아니라 **길이가 고정된 썸**이다. 시안 비율을 그대로 쓰고 남은
 * 30.4% 만 진행률로 움직인다.
 */
const THUMB_RATIO = 0.696;

export function ScrollHint({ scrollerRef }: { scrollerRef: React.RefObject<HTMLElement | null> }) {
  const thumbRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !thumb) return;

    let frame = 0;
    const paint = () => {
      frame = 0;
      const max = scroller.scrollWidth - scroller.clientWidth;
      const p = max > 1 ? Math.min(1, Math.max(0, scroller.scrollLeft / max)) : 0;
      /* translate 의 % 는 **자기 폭** 기준이라 (1/비율 − 1) 을 곱해야
         트랙에서 남는 칸이 된다. */
      thumb.style.translate = `${p * (100 / THUMB_RATIO - 100)}% 0`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(paint);
    };

    paint();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scrollerRef]);

  return (
    <div className={styles.scrollHint} aria-hidden>
      <span className={styles.hintTrack}>
        <span ref={thumbRef} className={styles.hintThumb} />
      </span>
      {/* 손가락 탭 픽토그램 — 시안은 18×24 아웃라인, 획 2px, #0a2048 */}
      <svg
        className={styles.hintIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <path d="M9.4 11.1V5.6a2 2 0 0 1 4 0v8.1" />
        <path d="M13.4 11.6a1.7 1.7 0 0 1 3.4 0v1.8" />
        <path d="M16.8 12.6a1.7 1.7 0 0 1 3.4 0v3.9a5.5 5.5 0 0 1-5.5 5.5h-1.9a5.6 5.6 0 0 1-4.2-1.9l-3.3-3.8a1.8 1.8 0 0 1 2.6-2.4l1.5 1.4" />
        <path d="M7.6 4.1a4.1 4.1 0 0 1 6.9 1" />
      </svg>
    </div>
  );
}
