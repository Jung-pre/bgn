"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import styles from "./scroll-hint.module.css";

/**
 * 모바일 가로 스크롤 인디케이터 — 시안 `124:3420`.
 *
 * ## 왜 필요한가
 * `overflow-x: auto` 가 만드는 네이티브 스크롤바만 있었는데, iOS 는 손을 떼면
 * 그마저 사라져서 옆에 더 있다는 걸 알 방법이 없다.
 *
 * ## 어디에 쓰나 (둘 다 최신 시안에 있다)
 *   · AI 정밀검사 시스템 카드 4장  — `124:3160` 하단
 *   · AI 브랜드 스토리 탭 3개      — `124:3418` 상단 (탭 폭 합 560 > 375)
 *
 * ## 썸 길이를 비례로 잡지 않는 이유
 * 카드 4장이면 뷰포트/콘텐츠 = 375/1208 = 31% 라 시안(69.6%)의 절반도 안 된다.
 * 시안은 스크롤 0 을 그린 것이므로 비례 썸이 아니라 **길이가 고정된 썸**이다.
 * 시안 비율을 그대로 쓰고 남은 만큼만 진행률로 움직인다.
 * 트랙 길이가 달라 시안 비율도 다르다 — 카드 211/303 = 0.696, 탭 209/240 = 0.871.
 *
 * ## 문구
 * 수정요청 6차 7p "옆으로 스와이프하는거는 방향이랑 글 써주세요".
 * 시안 문구는 한글이 아니라 **`SCROLL`** 이고 오른쪽에 손가락 픽토그램이 온다.
 * 사전에 넣지 않는 이유: 4개 로케일 모두 같은 영문 디자인 요소다(마퀴와 같은 취급).
 */
export interface ScrollHintProps {
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** 트랙 대비 썸 길이. 시안 실측값을 그대로 넘긴다. */
  thumbRatio?: number;
  className?: string;
}

export function ScrollHint({ scrollerRef, thumbRatio = 0.696, className }: ScrollHintProps) {
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
      thumb.style.translate = `${p * (100 / thumbRatio - 100)}% 0`;
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
  }, [scrollerRef, thumbRatio]);

  return (
    <div className={clsx(styles.root, className)} aria-hidden>
      <span className={styles.track}>
        <span
          ref={thumbRef}
          className={styles.thumb}
          style={{ width: `${thumbRatio * 100}%` }}
        />
      </span>
      <span className={styles.label}>
        <span className={styles.text} lang="en">
          SCROLL
        </span>
        {/* 손가락 픽토그램 — 시안 `124:3425` (24 박스 안 14.93×22.13 글리프) */}
        <svg
          className={styles.icon}
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
      </span>
    </div>
  );
}
