"use client";

import { useRef } from "react";
import { gsap, useGSAP, SCROLL_ENTRANCE, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

/**
 * 연혁 전용 등장 모션.
 *
 * ## 왜 `useSectionReveal` 을 그대로 쓰지 않는가
 * `useSectionReveal` 은 **섹션당 ScrollTrigger 1개**다(= `start: "top 82%"` 에서
 * 자식 전체를 stagger). 연혁은 시대 세트가 화면 몇 장에 걸쳐 나열되므로
 * 그 방식이면 아직 화면 아래에 있는 세트까지 한꺼번에 등장이 끝나버린다.
 * 기획안이 요구하는 건 "**새로운 연도 세트가 화면 하단에서 처음 시야에 들어올 때**"
 * 이므로 세트마다 트리거가 하나씩 필요하다. 그 외 파라미터(y/duration/ease)는
 * `SCROLL_ENTRANCE` 를 그대로 써서 페이지 전체 리듬을 맞춘다.
 *
 * ## 담당 범위
 *  ① 인트로 헤드라인 — 좌→우 clip-path 와이프 (Figma 주석 `2:1990`)
 *  ② 시대 세트 — opacity 0→1 + 살짝 위로 (세트마다 개별 트리거)
 *  ③ 이미지 카드 기울기 — 화면을 지나가는 동안 8° → 2° 로 정돈 (scrub)
 *  ④ 중앙 타임라인 축 — 스크롤에 따라 아래로 그려짐 (scrub)
 *
 * ## ③ 은 "엇갈림"이 아니다
 * 기획안은 이미지와 텍스트가 **다른 속도로 흐르는 것**을 금지한다.
 * 회전은 세로 위치를 바꾸지 않고, 카드가 텍스트와 같은 `li` 안에 있으므로
 * 두 요소의 이동 속도는 여전히 동일하다. Figma 주석 `2:2000` 이 지목한
 * skazy.ai 의 카드 거동이 정확히 이 "지나가며 각도가 정돈되는" 회전이고,
 * 시안에서도 같은 카드가 프레임마다 다른 각도로 그려져 있다.
 *
 * scrub 트윈이 CSS transform 을 직접 쓴다. 매 프레임 값이므로
 * state 로 올리지 않는다(리렌더 금지 규칙).
 */

/** 화면 중앙에서의 정지 각도(deg) — 시안 실측 ≈ 4° */
const TILT_REST = 4;
/** 하단 진입 시점에 정지 각도보다 이만큼 더 벌어져 있다(deg) */
const TILT_ENTER_DELTA = 5;

export function useHistoryReveal<T extends HTMLElement>() {
  const sectionRef = useRef<T>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const headline = section.querySelector<HTMLElement>("[data-history-headline]");
      const marker = section.querySelector<HTMLElement>("[data-history-marker]");
      const axisFill = section.querySelector<HTMLElement>("[data-history-axis-fill]");
      const axisHost = section.querySelector<HTMLElement>("[data-history-axis-host]");
      const sets = gsap.utils.toArray<HTMLElement>("[data-history-set]", section);
      const photos = gsap.utils.toArray<HTMLElement>("[data-history-photo]", section);

      /** 정지 각도의 단일 출처는 CSS 의 `--tilt-rest` 다 (인트로 카드만 9°) */
      const restOf = (el: HTMLElement) =>
        Number.parseFloat(getComputedStyle(el).getPropertyValue("--tilt-rest")) || TILT_REST;

      /**
       * 동작 줄이기: early-return 하면 아래 `fromTo` 가 걸어둔 시작값
       * (clip-path 0폭 / autoAlpha 0)이 남아 콘텐츠가 영영 안 보인다.
       * 반드시 최종 상태를 직접 확정하고 인라인 스타일을 지운다.
       */
      if (prefersReducedMotionSync()) {
        if (headline) gsap.set(headline, { autoAlpha: 1, clearProps: "clipPath,opacity" });
        if (marker) gsap.set(marker, { "--marker-wipe": "100%" });
        if (axisFill) gsap.set(axisFill, { scaleY: 1 });
        settleReducedMotion(sets);
        // 회전은 CSS 가 이미 정지 각도를 갖고 있다 — 인라인 값만 지운다
        photos.forEach((el) => gsap.set(el, { clearProps: "rotate,transform" }));
        // 타임라인 노드는 전부 활성 상태로 확정 (CSS 가 이 속성을 본다)
        gsap.set(sets, { attr: { "data-visible": "true" } });
        return;
      }

      // ── ① 헤드라인: 왼쪽 → 오른쪽으로 "생성" ──────────────────────────
      // Figma 주석(2:1990) "진입시 왼쪽에서 오른쪽 방향으로 텍스트 생성되며
      // 함께 꾸밈요소 배치". 글자를 쪼개는 대신 clip-path 와이프를 쓴다 —
      // 한국어 조합형 글자를 span 으로 쪼개면 줄바꿈·자간이 깨진다.
      if (headline) {
        const intro = gsap.timeline({
          scrollTrigger: { trigger: headline, start: "top 85%", once: true },
          defaults: { ease: "power3.out" },
        });

        intro.fromTo(
          headline,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", duration: 1.1 },
          0,
        );

        // 형광 마커도 좌→우 wipe. globals.css 가 권장하는 방식대로
        // background-size 를 CSS 변수로 트윈한다(전역 파일은 건드리지 않는다).
        if (marker) {
          intro.fromTo(
            marker,
            { "--marker-wipe": "0%" },
            { "--marker-wipe": "100%", duration: 0.45, ease: "power2.out" },
            0.7,
          );
        }
      }

      // ── ② 시대 세트: 하단 진입 시 fade-up ─────────────────────────────
      // 이미지와 텍스트가 **같은 li 안**에 있으므로 하나의 트윈으로 함께 움직인다.
      // = 기획안의 "엇갈림 없이 동시에 똑같은 속도로".
      sets.forEach((el) => {
        gsap
          .timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } })
          .fromTo(
            el,
            { autoAlpha: 0, y: SCROLL_ENTRANCE.y },
            {
              autoAlpha: 1,
              y: 0,
              duration: SCROLL_ENTRANCE.duration,
              ease: SCROLL_ENTRANCE.ease,
              // 인라인 transform 이 남으면 카드 회전(③)과 싸운다.
              clearProps: "opacity,visibility,transform",
            },
          )
          // 노드 활성화는 클래스가 아니라 속성으로 — CSS 모듈 해시 이름을
          // JS 로 넘기지 않아도 되고, 리렌더도 없다.
          .set(el, { attr: { "data-visible": "true" } }, 0.2);
      });

      // ── ③ 이미지 카드가 화면을 지나가며 각도를 정돈한다 ───────────────
      photos.forEach((el) => {
        const rest = restOf(el);
        gsap.fromTo(
          el,
          { rotate: rest + TILT_ENTER_DELTA },
          {
            rotate: rest,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "center center",
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
          },
        );
      });

      // ── ④ 중앙 축이 스크롤을 따라 그려진다 ────────────────────────────
      if (axisFill && axisHost) {
        gsap.fromTo(
          axisFill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: axisHost,
              start: "top 75%",
              end: "bottom 65%",
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        );
      }
    },
    { scope: sectionRef },
  );

  return sectionRef;
}
