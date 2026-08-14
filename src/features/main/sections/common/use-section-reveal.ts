"use client";

import { useRef } from "react";
import { gsap, useGSAP, SCROLL_ENTRANCE, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

export interface SectionRevealOptions {
  /** ScrollTrigger start. 기본 "top 82%" */
  start?: string;
  /** 자식 stagger 간격. 0 이면 동시 등장 */
  stagger?: number;
  disabled?: boolean;
}

/**
 * 섹션 진입 reveal — 이 프로젝트의 기본 등장 모션.
 *
 * 사용:
 *   const sectionRef = useSectionReveal<HTMLElement>();
 *   <section ref={sectionRef}>
 *     <h2 data-reveal-item>...</h2>
 *     <p  data-reveal-item>...</p>
 *   </section>
 *
 * `[data-reveal-item]` 이 하나도 없으면 섹션 전체를 한 덩어리로 페이드한다.
 *
 * ## blur 를 쓰지 않는 이유
 * `filter: blur(8px) → 0` 페이드가 시각적으로는 예쁘지만, 여러 섹션이 동시에
 * 뷰포트에 들어오면 브라우저가 GPU 레이어를 계속 재합성해서 스크롤이 끊긴다.
 * opacity + translateY + 미세 scale 조합으로 거의 같은 인상을 낸다.
 */
export function useSectionReveal<T extends HTMLElement>(options: SectionRevealOptions = {}) {
  const { start = SCROLL_ENTRANCE.start, stagger = SCROLL_ENTRANCE.stagger, disabled } = options;
  const sectionRef = useRef<T>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || disabled) return;

      const marked = section.querySelectorAll("[data-reveal-item]");
      const targets: ArrayLike<Element> = marked.length > 0 ? marked : [section];

      if (prefersReducedMotionSync()) {
        settleReducedMotion(targets as unknown as gsap.TweenTarget);
        return;
      }

      gsap.set(targets, {
        autoAlpha: 0,
        y: SCROLL_ENTRANCE.y,
        scale: SCROLL_ENTRANCE.scale,
        transformOrigin: "50% 50%",
      });

      gsap.to(targets, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: SCROLL_ENTRANCE.duration,
        ease: SCROLL_ENTRANCE.ease,
        stagger: marked.length > 0 ? stagger : 0,
        // 끝나면 인라인 스타일을 지운다 — 안 지우면 CSS hover/미디어쿼리가
        // GSAP 이 남긴 transform 에 밀려서 안 먹는다.
        clearProps: "opacity,visibility,transform",
        scrollTrigger: { trigger: section, start, once: true },
      });
    },
    { scope: sectionRef, dependencies: [start, stagger, disabled] },
  );

  return sectionRef;
}
