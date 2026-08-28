"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import {
  queryTitleMarks,
  settleTitleMarks,
  TITLE_MARK_WIPE,
} from "@/features/main/sections/common/use-section-reveal";

/**
 * 의료진 섹션 등장.
 *
 * `useSectionReveal` 기본값(`top 82%`)을 쓰지 않는다. 이 섹션은 핀된 히어로
 * (200vh) 바로 다음이라, 섹션 상단이 뷰포트 하단에 걸리는 순간(= 타워가 아직
 * 화면을 차지하는 때)에 트윈이 시작해 버린다. 의료진이 **화면의 주인공이 된
 * 뒤**에 등장해야 하므로 섹션 top 이 뷰포트 한가운데에 왔을 때 건다.
 *
 * 타이틀은 좌→우 wipe, 카드는 **화면 왼쪽부터** 스태거. DOM 순서는 활성 카드가
 * 0번이라 가운데부터 튀어 보인다. `--offset` 오름차순이 화면 좌→우다.
 * 카드 `<li>` 의 transform 은 캐러셀 배치라 건드리지 않고, 안쪽 래퍼만 움직인다.
 */
export function useTeamReveal<T extends HTMLElement>() {
  const sectionRef = useRef<T>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

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

      /* 히스토리·웹블로그 중간 새로고침: 이미 지난 once ST 를 빈 tl 에 붙이면
         refresh 레이스로 `undefined.end` 가 난다. 지난 구간은 최종 상태만. */
      if (section.getBoundingClientRect().top <= window.innerHeight * 0.7 + 2) {
        settleReducedMotion([...wipes, ...fades, ...cards, controls].filter(Boolean));
        gsap.set(wipes, { clipPath: "none" });
        settleTitleMarks(marks);
        return;
      }

      gsap.set(wipes, { clipPath: "inset(0 100% 0 0)" });
      if (marks.length > 0) gsap.set(marks, { clipPath: TITLE_MARK_WIPE.from });
      gsap.set(fades, { autoAlpha: 0, y: 16 });
      /* 3차 수정요청 "내려갔을 때 하나씩 나타나는 인터랙션" — 폭을 키우고
         간격을 벌려 '하나씩'이 읽히게 한다(0.09 는 한 덩어리로 보였다). */
      gsap.set(cards, {
        autoAlpha: 0,
        y: 76,
        scale: 0.94,
        transformOrigin: "50% 80%",
      });
      if (controls) gsap.set(controls, { autoAlpha: 0, y: 12 });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
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
        const ranked = cards.map((el) => {
          const li = el.closest("li");
          const offset = Number(li?.style.getPropertyValue("--offset") || 0);
          return { el, offset, hidden: li?.getAttribute("aria-hidden") === "true" };
        });
        const visible = ranked
          .filter((card) => !card.hidden)
          .sort((a, b) => a.offset - b.offset)
          .map((card) => card.el);
        const offstage = ranked.filter((card) => card.hidden).map((card) => card.el);

        /* 화면 밖 카드는 스태거에 넣지 않는다. 넣으면 왼쪽 투명 장이 먼저
           시간을 잡아먹고, 나중에 스와이프했을 때 y/alpha 가 0 으로 남아 있다. */
        if (offstage.length > 0) {
          gsap.set(offstage, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            clearProps: "opacity,visibility,transform",
          });
        }

        tl.to(
          visible,
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.85,
            ease: "power4.out",
            stagger: 0.16,
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

      ScrollTrigger.create({
        trigger: section,
        /**
         * 히어로 pin 이 풀린 뒤에 걸리도록 기본(82%)보다는 늦게 — 단, 50% 는
         * 너무 늦었다. pin 해제(스크롤 920)부터 발화(1380)까지 뷰포트 절반이
         * 빈 섹션으로 지나가서 "칸이 안 나타난다"로 읽혔다(2차 수정 5p).
         * 70% 면 헤더가 갓 들어온 시점(스크롤 1196)에 시작해 카드 스태거가
         * 화면 안에서 **보이면서** 진행된다. 접근 캡처로 확인.
         */
        start: "top 70%",
        once: true,
        invalidateOnRefresh: true,
        animation: tl,
      });
    },
    { scope: sectionRef },
  );

  return sectionRef;
}
