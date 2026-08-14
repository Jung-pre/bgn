"use client";

import { type RefObject, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

export interface PinnedProgressOptions {
  /** 슬라이드/스텝 개수 */
  steps: number;
  /**
   * scrub 스무딩. `false` 면 진행도를 바로 쓰고, 숫자면 그만큼 지연 추종.
   * 3D 카메라를 스크롤에 직접 물릴 땐 1 정도가 자연스럽다.
   */
  scrub?: number | false;
  /**
   * progress → step 매핑. 기본은 균등 분할.
   * "한 슬라이드에 오래 머물다 빠르게 전환" 같은 리듬을 주려면 갈아끼운다.
   */
  mapProgress?: (progress: number, steps: number) => number;
  /** 스크롤 진행도를 매 프레임 받아 3D/캔버스로 흘려보내는 콜백 (리렌더 없음) */
  onProgress?: (progress: number) => void;
  dependencies?: unknown[];
}

export interface PinnedProgressResult {
  sectionRef: RefObject<HTMLElement | null>;
  pinRef: RefObject<HTMLDivElement | null>;
  /** 현재 스텝. 값이 바뀔 때만 리렌더된다. */
  activeIndex: number;
  /** 0~1 진행도의 **ref**. 매 프레임 값이라 state 로 두면 안 된다. */
  progressRef: RefObject<number>;
}

/**
 * "긴 섹션 + pin + 진행도 → 인덱스" — 이 프로젝트 스크롤 인터랙션의 기본형.
 *
 * ## 구조
 *   <section ref={sectionRef} style={{ height: `${steps * 100}vh` }}>
 *     <div ref={pinRef} className={styles.pinShell}>  // min-height: 100vh
 *       ...activeIndex 에 따라 바뀌는 콘텐츠
 *     </div>
 *   </section>
 *
 * ## 왜 CSS sticky 가 아니라 GSAP pin 인가
 * sticky 는 조상 중 하나라도 `overflow: hidden|clip` 이면 조용히 죽는다.
 * 섹션이 20개쯤 되면 누군가 반드시 조상에 overflow 를 건다. GSAP pin 은
 * 조상 overflow 와 무관하고 `pinSpacing` 으로 자리도 자동 확보한다.
 *
 * ## 왜 progress 를 state 로 안 두는가
 * 스크롤 프레임마다 setState 하면 60fps 로 React 리렌더가 돈다.
 * 매 프레임 값은 `progressRef` 로 흘리고(→ useFrame 에서 읽음),
 * state 는 "몇 번째 슬라이드인가"가 바뀔 때만 갱신한다.
 */
export function usePinnedProgress({
  steps,
  scrub = false,
  mapProgress,
  onProgress,
  dependencies = [],
}: PinnedProgressOptions): PinnedProgressResult {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const pinEl = pinRef.current;
      if (!section || !pinEl) return;

      const segmentCount = Math.max(1, steps);
      const toIndex =
        mapProgress ?? ((p: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(p * n))));

      const commit = (p: number) => {
        progressRef.current = p;
        onProgress?.(p);
        const next = toIndex(p, segmentCount);
        // 같은 값이면 setState 를 건너뛴다 — 이거 하나로 리렌더가 수십 배 줄어든다.
        setActiveIndex((prev) => (prev === next ? prev : next));
      };

      // scrub 을 쓰더라도 GSAP quickTo 로 한 번 더 스무딩하면
      // 트랙패드의 계단식 델타가 눈에 안 띈다.
      const smoothed = { value: 0 };
      const push =
        scrub === false
          ? commit
          : gsap.quickTo(smoothed, "value", {
              duration: 0.22,
              ease: "power2.out",
              onUpdate: () => commit(smoothed.value),
            });

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        pin: pinEl,
        pinSpacing: true,
        anticipatePin: 1,
        // 리사이즈 시 start/end 를 다시 계산. 없으면 창 크기를 바꾼 뒤
        // pin 구간이 통째로 어긋난다.
        invalidateOnRefresh: true,
        ...(scrub === false ? {} : { scrub }),
        onUpdate: (self) => push(self.progress),
      });

      if (prefersReducedMotionSync()) commit(0);

      return () => {
        /**
         * ⚠️ `kill()` 이 아니라 `kill(true)` 여야 한다.
         *
         * 첫 인자가 `revert` 다. 기본값 false 로 죽이면 ScrollTrigger 가 만든
         * **pin-spacer 가 DOM 에 그대로 남는다.** 이 훅은 `dependencies` 가 바뀌면
         * (예: `isMobile` 이 SSR 스냅샷 false → 클라이언트 true 로 뒤집힐 때)
         * 다시 만들어지므로, 남은 스페이서만큼 섹션이 한 화면씩 밀린다.
         *
         * 실제 증상: 모바일에서 히어로가 통째로 빈 화면으로 보였다.
         * pinShell 이 `position: fixed; top: 812px` 로 뷰포트 아래에 박혀 있었고,
         * 원인이 바로 이 남은 스페이서였다.
         */
        st.kill(true);
      };
    },
    { scope: sectionRef, dependencies: [steps, scrub, ...dependencies] },
  );

  return { sectionRef, pinRef, activeIndex, progressRef };
}

/**
 * "홀드 + 트리거" 스크롤 예산 계산기.
 *
 * 섹션 높이를 `400vh` 같은 매직넘버로 두면 슬라이드를 하나 추가할 때마다
 * 사람이 다시 계산해야 한다. 슬라이드당 "머무는 구간(hold)"과
 * "전환 구간(trigger)"을 상수로 두고 높이를 유도한다.
 *
 * @example
 *   const { sectionVh, snapTo } = holdTriggerBudget(5, 85, 28); // → 537vh
 */
export function holdTriggerBudget(steps: number, holdVh = 85, triggerVh = 28) {
  const sectionVh = (steps - 1) * (holdVh + triggerVh) + holdVh;
  const unit = (holdVh + triggerVh) / sectionVh;
  const holdRatio = holdVh / sectionVh;

  /**
   * 스냅 함수: 홀드 구간 안이면 그대로 두고(사용자가 읽는 중),
   * 전환 구간에 들어왔으면 스크롤 방향 쪽 슬라이드로 확정한다.
   */
  const snapTo = (value: number, direction: 1 | -1) => {
    const i = Math.floor(value / unit);
    const local = value - i * unit;
    if (local <= holdRatio) return i * unit; // 홀드 구간 → 현재 유지
    return (direction > 0 ? i + 1 : i) * unit;
  };

  return { sectionVh, snapTo };
}
