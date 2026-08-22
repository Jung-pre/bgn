"use client";

import { useRef } from "react";
import { gsap, useGSAP, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import {
  queryTitleMarks,
  settleTitleMarks,
  TITLE_MARK_WIPE,
} from "@/features/main/sections/common/use-section-reveal";

/**
 * 의료진 섹션 등장.
 *
 * `useSectionReveal` 을 쓰지 않는 이유: 이 섹션은 **핀된 히어로(200vh) 바로 다음**이다.
 * 트리거를 섹션 박스(`start: top 82%`)에 걸면, 히어로가 아직 화면을 덮고 있는 동안
 * 등장 트윈이 끝나 버린다. 타이틀이 읽히는 자리에 왔을 때는 이미 `clearProps` 뒤라
 * 모션이 아예 안 보인다.
 *
 * 헤더가 실제로 들어오는 순간을 트리거로 쓰고, 타이틀은 좌→우 wipe,
 * 카드는 가운데부터 스태거로 올린다. 카드 `<li>` 의 transform 은 캐러셀 배치라
 * 건드리지 않고, 안쪽 래퍼(`[data-team-card]`)만 움직인다.
 */
export function useTeamReveal<T extends HTMLElement>() {
  const sectionRef = useRef<T>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const header = section.querySelector<HTMLElement>("[data-team-header]");
      const wipes = gsap.utils.toArray<HTMLElement>("[data-team-wipe]", section);
      const fades = gsap.utils.toArray<HTMLElement>("[data-team-fade]", section);
      const cards = gsap.utils.toArray<HTMLElement>("[data-team-card]", section);
      const controls = section.querySelector<HTMLElement>("[data-team-controls]");
      const marks = queryTitleMarks(section);

      if (prefersReducedMotionSync()) {
        settleReducedMotion([...wipes, ...fades, ...cards, controls].filter(Boolean));
        gsap.set(wipes, { clipPath: "none" });
        settleTitleMarks(marks);
        return;
      }

      gsap.set(wipes, { clipPath: "inset(0 100% 0 0)" });
      if (marks.length > 0) gsap.set(marks, { clipPath: TITLE_MARK_WIPE.from });
      gsap.set(fades, { autoAlpha: 0, y: 16 });
      gsap.set(cards, {
        autoAlpha: 0,
        y: 64,
        scale: 0.96,
        transformOrigin: "50% 80%",
      });
      if (controls) gsap.set(controls, { autoAlpha: 0, y: 12 });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: {
          trigger: header ?? section,
          start: "top 78%",
          once: true,
        },
      });

      if (wipes.length > 0) {
        tl.to(wipes, { clipPath: "inset(0 0% 0 0)", duration: 0.9, stagger: 0.1 }, 0);
      }
      if (marks.length > 0) {
        tl.to(
          marks,
          {
            clipPath: TITLE_MARK_WIPE.to,
            duration: TITLE_MARK_WIPE.duration,
            clearProps: "clipPath",
          },
          TITLE_MARK_WIPE.at,
        );
      }
      if (fades.length > 0) {
        tl.to(
          fades,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.08,
            clearProps: "opacity,visibility,transform",
          },
          0.2,
        );
      }
      if (cards.length > 0) {
        tl.to(
          cards,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.85,
            stagger: { each: 0.06, from: 0 },
            clearProps: "opacity,visibility,transform",
          },
          0.28,
        );
      }
      if (controls) {
        tl.to(
          controls,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            clearProps: "opacity,visibility,transform",
          },
          0.55,
        );
      }
    },
    { scope: sectionRef },
  );

  return sectionRef;
}
