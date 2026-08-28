"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, SCROLL_ENTRANCE, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

export interface SectionRevealOptions {
  /** ScrollTrigger start. 기본 "top 82%" */
  start?: string;
  /** 자식 stagger 간격. 0 이면 동시 등장 */
  stagger?: number;
  disabled?: boolean;
}

/**
 * `.title-mark`(파란 박스 + 좌우 바) 좌→우 wipe.
 * scaleX 로 키우면 글자까지 눌리므로 clip-path 만 쓴다. 의료진·AI 시스템·상담 신청이 같다.
 */
export const TITLE_MARK_WIPE = {
  from: "inset(0 100% 0 0)",
  to: "inset(0 0% 0 0)",
  duration: 0.7,
  at: 0.25,
} as const;

export function queryTitleMarks(root: ParentNode) {
  return gsap.utils.toArray<HTMLElement>(".title-mark", root);
}

export function settleTitleMarks(marks: HTMLElement[]) {
  if (marks.length === 0) return;
  gsap.set(marks, { clipPath: "none", clearProps: "clipPath" });
}

/** `start: "top 82%"` 형태에서 뷰포트 % 를 뽑아 이미 지났는지 본다. */
function hasPassedStart(el: Element, start: string) {
  const match = /top\s+(\d+(?:\.\d+)?)%/.exec(start);
  const pct = match ? Number(match[1]) : 82;
  return el.getBoundingClientRect().top <= window.innerHeight * (pct / 100) + 2;
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
 *
 * ## 중간 새로고침과 ScrollTrigger
 * `timeline({ scrollTrigger })` 를 빈 채로 만들면 ST 가 start/end=0 으로
 * delayed refresh 에 들어가고, 아래 섹션(웹블로그 등)이 같은 틱에 ST 를
 * 만들다 `undefined.end` TypeError 가 난다. 트윈을 채운 뒤 create 하고,
 * 이미 지난 구간은 ST 없이 최종 상태만 둔다.
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
      const marks = queryTitleMarks(section);

      if (prefersReducedMotionSync()) {
        settleReducedMotion(targets as unknown as gsap.TweenTarget);
        settleTitleMarks(marks);
        return;
      }

      if (hasPassedStart(section, start)) {
        settleReducedMotion(targets as unknown as gsap.TweenTarget);
        settleTitleMarks(marks);
        return;
      }

      gsap.set(targets, {
        autoAlpha: 0,
        y: SCROLL_ENTRANCE.y,
        scale: SCROLL_ENTRANCE.scale,
        transformOrigin: "50% 50%",
      });
      if (marks.length > 0) gsap.set(marks, { clipPath: TITLE_MARK_WIPE.from });

      const tl = gsap.timeline();

      tl.to(targets, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: SCROLL_ENTRANCE.duration,
        ease: SCROLL_ENTRANCE.ease,
        stagger: marked.length > 0 ? stagger : 0,
        // 끝나면 인라인 스타일을 지운다 — 안 지우면 CSS hover/미디어쿼리가
        // GSAP 이 남긴 transform 에 밀려서 안 먹는다.
        clearProps: "opacity,visibility,transform",
      });

      if (marks.length > 0) {
        tl.to(
          marks,
          {
            clipPath: TITLE_MARK_WIPE.to,
            duration: TITLE_MARK_WIPE.duration,
            ease: SCROLL_ENTRANCE.ease,
            stagger: 0.08,
            clearProps: "clipPath",
          },
          TITLE_MARK_WIPE.at,
        );
      }

      ScrollTrigger.create({
        trigger: section,
        start,
        once: true,
        animation: tl,
      });
    },
    { scope: sectionRef, dependencies: [start, stagger, disabled] },
  );

  return sectionRef;
}
