"use client";

import { useRef } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import styles from "./marquee.module.css";

/**
 * 무한 흐르는 대형 텍스트 — 이 사이트의 시그니처 모션.
 *
 * 시안에서 최소 2회 등장한다 (히어로 `BGN Eyeclinic Jamsil`,
 * AI 섹션 `AI Precision System`). 섹션 전환 디바이더 역할이라
 * 두 곳이 같은 속도·같은 타이포여야 한다 → 컴포넌트로 고정.
 *
 * ## 왜 CSS animation 이 아니라 GSAP 인가
 * CSS `@keyframes translateX(-50%)` 로도 되지만, 이 사이트는
 * Lenis + ScrollTrigger 가 `gsap.ticker` 하나로 프레임을 통일해 놨다.
 * 마퀴만 별도 컴포지터 애니메이션으로 돌면 스크롤 중 미세하게 어긋나 보인다.
 * 같은 ticker 에 태우는 편이 체감이 낫다.
 *
 * ## 왜 내용을 2번 렌더하는가
 * `xPercent: -50` 으로 무한 루프하려면 트랙이 정확히 2배여야 한다.
 * 첫 세트만 스크린리더에 노출하고 두 번째는 `aria-hidden`.
 */
export interface MarqueeProps {
  text: string;
  /** 한 바퀴 도는 데 걸리는 초. 클수록 느리다. 기본 24 */
  duration?: number;
  /** -1 이면 오른쪽으로 흐른다 */
  direction?: 1 | -1;
  /** 반복 사이에 넣을 구분자. 시안은 `*` */
  separator?: string;
  className?: string;
  /** 시안의 아웃라인(속 빈) 스타일 */
  outline?: boolean;
}

/** 트랙 한 세트에 넣을 반복 횟수. 화면보다 짧으면 빈틈이 생긴다. */
const REPEAT = 4;

export function Marquee({
  text,
  duration = 24,
  direction = -1,
  separator = "*",
  className,
  outline = false,
}: MarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track) return;
      // 동작 줄이기: 정지한 채로 그대로 둔다. 텍스트는 계속 읽힌다.
      if (prefersReducedMotionSync()) return;

      const tween = gsap.to(track, {
        xPercent: 50 * direction,
        duration,
        ease: "none",
        repeat: -1,
      });
      return () => {
        tween.kill();
      };
    },
    { scope: rootRef, dependencies: [duration, direction] },
  );

  const items = Array.from({ length: REPEAT }, (_, i) => (
    <span key={i} className={styles.item}>
      {text}
      <span className={styles.sep} aria-hidden>
        {separator}
      </span>
    </span>
  ));

  return (
    <div ref={rootRef} className={clsx(styles.root, outline && styles.outline, className)}>
      <div ref={trackRef} className={styles.track}>
        <div className={styles.set} lang="en">
          {items}
        </div>
        <div className={styles.set} aria-hidden lang="en">
          {items}
        </div>
      </div>
    </div>
  );
}
