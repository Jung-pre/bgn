"use client";

import { useRef } from "react";
import { MQ } from "@/shared/config/breakpoints";
import { gsap, ScrollTrigger, useGSAP, SCROLL_ENTRANCE, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync, useMediaQuery } from "@/shared/lib/use-media-query";

/**
 * `fromTo` 하나에 stagger + scrollTrigger(once) 를 같이 걸면 GSAP 이
 * 내부 타임라인을 만든 뒤 ScrollTrigger 를 붙인다. 히스토리 **아래**에서
 * 새로고침하면 start 를 이미 지난 상태라 `once` 가 **생성 도중에 kill**하고,
 * 같은 콜스택에서 `undefined.end` 를 읽어 TypeError 가 난다.
 * 트리거는 타임라인에, stagger 는 자식 트윈에 분리한다.
 *
 * 이미 지난 트리거는 아예 ST 를 만들지 않고 최종 상태로만 둔다.
 */
function hasPassedStart(el: Element, viewportPct: number) {
  return el.getBoundingClientRect().top <= window.innerHeight * (viewportPct / 100);
}

function wipeLinesOnce(
  lines: HTMLElement[],
  trigger: Element,
  startPct: number,
  stagger: number,
  duration: number,
) {
  if (lines.length === 0) return;
  if (hasPassedStart(trigger, startPct)) {
    gsap.set(lines, { clearProps: "clipPath" });
    return;
  }
  gsap
    .timeline({
      scrollTrigger: { trigger, start: `top ${startPct}%`, once: true },
    })
    .fromTo(
      lines,
      { clipPath: "inset(0 100% 0 0)" },
      {
        clipPath: "inset(0 0% 0 0)",
        duration,
        ease: "power3.out",
        stagger,
        clearProps: "clipPath",
      },
    );
}

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

/**
 * ## 물레방아 — 사진 5장이 **하나의 원**에 박혀 함께 돈다
 *
 * 레퍼런스(skazy.ai)를 5개 스크롤 지점에서 샘플링해 보니 각 판이 따로 도는 게
 * 아니었다. 판들은 **한 바퀴의 살**이라, 앞 판이 위로 빠지면 뒤 판이 아래에서
 * 따라 올라온다. 그래서 사진을 시대별 `<li>` 에서 빼내 하나의 sticky 컨테이너로
 * 모았다(`history-section.tsx` 의 `.wheelColumn`).
 *
 * 살 i 의 각도는 `(i − a) · 2π/n`, a 는 진행도로 만든 활성 인덱스다.
 * 텍스트 행 수와 살 수가 같아서 a = i 일 때 i 번 사진이 정면(θ=0)에 온다
 * = "해당 시대에서만 제대로 보인다".
 */

export function useHistoryReveal<T extends HTMLElement>() {
  const sectionRef = useRef<T>(null);
  /* gsap.matchMedia 를 쓰지 않는다. add() 가 matchMediaInit 에서
     페이지 전체 ScrollTrigger 를 revert 한 뒤 콜백 안에서 새 트윈을 만들면,
     refresh 루프가 `_triggers[i].end` 를 읽다 없는 인스턴스를 만난다
     (히스토리 아래 새로고침에서 TypeError). 웹블로그와 같이 네이티브 MQ 로 가른다. */
  const isDesktop = useMediaQuery(MQ.desktop);
  const isHistoryWheel = useMediaQuery(MQ.historyWheel);
  const isHistoryStack = useMediaQuery(MQ.historyStack);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      /* 인트로 헤드라인은 **줄 단위** 로 쪼개져 있다(`renderTitleLines`).
         한 덩어리로 클립하면 두 줄이 동시에 열려 커튼처럼 보인다. */
      const introLines = gsap.utils.toArray<HTMLElement>(
        "#history-title [data-history-line]",
        section,
      );
      const axisFill = section.querySelector<HTMLElement>("[data-history-axis-fill]");
      const axisHost = section.querySelector<HTMLElement>("[data-history-axis-host]");
      const sets = gsap.utils.toArray<HTMLElement>("[data-history-set]", section);

      /**
       * 동작 줄이기: early-return 하면 아래 `fromTo` 가 걸어둔 시작값
       * (clip-path 0폭 / autoAlpha 0)이 남아 콘텐츠가 영영 안 보인다.
       * 반드시 최종 상태를 직접 확정하고 인라인 스타일을 지운다.
       */
      if (prefersReducedMotionSync()) {
        gsap.set(introLines, { clearProps: "clipPath" });
        gsap.set(gsap.utils.toArray<HTMLElement>("[data-history-line]", section), {
          clearProps: "clipPath",
        });
        gsap.set(gsap.utils.toArray<HTMLElement>("[data-history-point]", section), {
          clearProps: "opacity,transform",
        });
        if (axisFill) gsap.set(axisFill, { scaleY: 1 });
        settleReducedMotion(sets);
        /* 동작 줄이기: 바퀴를 돌리지 않고 첫 살만 정면에 세운다.
           안 그러면 다섯 장이 한 점에 겹쳐 있는 채로 멈춘다. */
        gsap.utils.toArray<HTMLElement>("[data-history-spoke]", section).forEach((el, i) => {
          gsap.set(el, {
            y: 0,
            z: 0,
            rotationX: 0,
            opacity: i === 0 ? 1 : 0,
            visibility: i === 0 ? "visible" : "hidden",
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-history-copy-pane]", section).forEach((el, i) => {
          gsap.set(el, {
            x: 0,
            opacity: i === 0 ? 1 : 0,
            visibility: i === 0 ? "visible" : "hidden",
          });
        });
        gsap.set(gsap.utils.toArray<HTMLElement>("[data-history-slot]", section), {
          rotation: 0,
          clearProps: "transform",
        });
        // 타임라인 노드는 전부 활성 상태로 확정 (CSS 가 이 속성을 본다)
        gsap.set(sets, { attr: { "data-visible": "true" } });
        return;
      }

      // ── ① 헤드라인: 왼쪽 → 오른쪽으로 "생성" ──────────────────────────
      // Figma 주석(2:1990) "진입시 왼쪽에서 오른쪽 방향으로 텍스트 생성되며
      // 함께 꾸밈요소 배치". 글자를 쪼개는 대신 clip-path 와이프를 쓴다 —
      // 한국어 조합형 글자를 span 으로 쪼개면 줄바꿈·자간이 깨진다.
      //
      // **줄마다 따로** 연다. 두 줄을 한 번에 클립하면 오른쪽 끝까지 같은
      // 속도로 밀려 "생성"이 아니라 커튼이 된다. 0.28s 어긋내면 첫 줄이
      // 거의 다 열린 뒤 둘째 줄이 시작해 글이 이어 써지는 것처럼 읽힌다.
      //
      // 꾸밈요소(선택 커서 마크)는 첫 줄 안에 있으므로 와이프가 지나가면서
      // 그대로 드러난다 = 주석의 "함께 배치". 따로 트윈을 걸면 오히려 두 번
      // 등장하는 것처럼 보인다.
      if (introLines[0]) wipeLinesOnce(introLines, introLines[0], 85, 0.28, 0.9);

      // ── ② 시대 세트: 하단 진입 시 fade-up ─────────────────────────────
      // 이미지와 텍스트가 **같은 li 안**에 있으므로 하나의 트윈으로 함께 움직인다.
      // = 기획안의 "엇갈림 없이 동시에 똑같은 속도로".
      sets.forEach((el) => {
        if (hasPassedStart(el, 88)) {
          gsap.set(el, {
            autoAlpha: 1,
            y: 0,
            attr: { "data-visible": "true" },
            clearProps: "opacity,visibility,transform",
          });
        } else {
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
        }

        /**
         * 세트 안의 카피도 인트로와 **같은 좌→우 생성**으로 맞춘다.
         * 섹션 전체가 하나의 모션 어휘를 쓰게 하려는 것이다 — 인트로만
         * 와이프고 시대는 그냥 페이드면 같은 섹션으로 안 읽힌다.
         *
         * 연도(.period)는 CSS 로 `opacity: .2` 를 갖고 있다. 그래서 여기서
         * **투명도는 절대 건드리지 않고** clip-path 만 쓴다 — autoAlpha 를
         * 걸면 0.2 가 1 로 덮여 연도가 시안보다 5배 진해진다.
         */
        const lines = gsap.utils.toArray<HTMLElement>("[data-history-line]", el);
        wipeLinesOnce(lines, el, 82, 0.12, 0.8);

        /* 성과 항목은 체크가 하나씩 찍히는 리듬이라 와이프보다 낫다 */
        const points = gsap.utils.toArray<HTMLElement>("[data-history-point]", el);
        if (points.length > 0) {
          if (hasPassedStart(el, 82)) {
            gsap.set(points, { autoAlpha: 1, x: 0, clearProps: "opacity,visibility,transform" });
          } else {
            gsap
              .timeline({
                scrollTrigger: { trigger: el, start: "top 82%", once: true },
              })
              .fromTo(
                points,
                { autoAlpha: 0, x: -14 },
                {
                  autoAlpha: 1,
                  x: 0,
                  duration: 0.5,
                  ease: "power2.out",
                  stagger: 0.09,
                  delay: 0.35,
                  clearProps: "opacity,visibility,transform",
                },
              );
          }
        }
      });

      // ── ③ 물레방아 / 책넘김: 뷰포트가 버티는 곳에서만 sticky ─────────────
      // 짧은 모바일·가로는 카드가 본문·하단바를 덮는다 → 펼쳐 둔 슬롯 사진.
      // 쿼리는 breakpoints.ts 의 MQ.historyWheel / historyStack 과 CSS 가 같다.
      const wheel = section.querySelector<HTMLElement>("[data-history-wheel]");
      const spokes = gsap.utils.toArray<HTMLElement>("[data-history-spoke]", section);
      const copyPanes = gsap.utils.toArray<HTMLElement>("[data-history-copy-pane]", section);

      /**
       * PC 물레방아. 진행도 p(0~1) → 활성 인덱스 a(0 ~ n-1).
       * 살 i 의 각도는 `(i − a) · step` 이라 a = i 일 때 정면(θ=0)이 된다.
       */
      const bindDesktopWheel = () => {
        if (!wheel || spokes.length === 0) return undefined;

        const n = spokes.length;
        const step = (Math.PI * 2) / n;

        const place = (p: number) => {
          const a = p * (n - 1);

          /**
           * ## 궤도 — 사용자가 녹화해 준 레퍼런스에서 **원을 직접 역산**했다
           *
           * 영상 프레임(732×760 로 정규화)에서 동시에 보이는 카드 3장의 중심을 찍었다.
           *   지난 살 (527, 130) / 활성 (252, 340) / 다음 살 (262, 710)
           * 세 점의 외심을 풀면 **중심 (605, 516), 반지름 394** — 세 점 모두 오차 1px.
           * 즉 눈대중이 아니라 진짜 정원(正圓)이고, 중요한 건 그 위치다.
           *
           *   · 원의 중심이 활성 카드의 **오른쪽 위**(x 83%, y 68%)에 있다
           *   · 활성은 원의 왼쪽 끝(180°)이 아니라 **206.5°** — 왼쪽 끝보다 26.5° 위
           *
           * 이 26.5° 어긋남이 이 모션의 정체다. 앞 버전은 활성을 정확히 왼쪽 끝에 두어
           * 위·아래 이웃이 **똑같이** 오른쪽으로 물러났는데, 레퍼런스는 좌우가 다르다:
           *   다음 살(아래) → 거의 바로 밑에서 올라온다      (Δx ≈ 0.19R, Δy ≈ 1.16R)
           *   지난 살(위)   → 오른쪽으로 크게 휘며 빠져나간다 (Δx ≈ 1.04R, Δy ≈ −0.54R)
           * 아래에서 곧게 올라와 정면에 섰다가 오른쪽 위로 날아가 사라지는 것 —
           * 이게 "물레방아"로 읽히는 이유다.
           */
          /** 활성 살이 앉는 원 위의 각도(화면 좌표, y 가 아래로 +). 실측 206.5° */
          const PHASE = (206.5 * Math.PI) / 180;
          const P_COS = Math.cos(PHASE);
          const P_SIN = Math.sin(PHASE);
          /* 화면에서 정원이므로 반지름은 축마다 다르지 않다. 세로가 병목이라 vh 기준.
             레퍼런스는 R = 0.52·프레임높이였는데 그 프레임은 세로로 긴 창이었다.
             1440×900 에서 0.5vh 면 이웃이 위 −244 / 아래 +521 로 실측 비율과 같다.
             0.44 로 뒀을 때 전환 중간(a=0.5, 살이 ψ=±36°)에 카드가 89px 겹쳤다. */
          const R = window.innerHeight * 0.5;
          /* z 는 살짝만. 원근 축소가 scale 위에 또 곱해져 이웃이 과하게 작아진다 */
          const DEPTH = window.innerHeight * 0.18;

          spokes.forEach((el, i) => {
            /**
             * ψ = 진행 방향 기준 각도. a 가 커질수록(스크롤이 내려갈수록) 살은
             * 원 위에서 **각도가 커지는 쪽**(아래 → 정면 → 오른쪽 위)으로 흐른다.
             * 그래서 부호가 `(a − i)` 다 — `(i − a)` 로 두면 바퀴가 거꾸로 돈다.
             */
            const psi = (a - i) * step;
            const ang = PHASE + psi;
            /**
             * `lead` 는 그대로 쓰면 ψ=0 근처에서 기울기가 가장 가파르다(sin 의 미분이
             * 0 에서 최대). 그러면 정면을 스쳐 지나갈 뿐 **반듯하게 서 있는 구간**이
             * 생기지 않는다. 지수를 얹어 0 근처를 눌러 두면 활성 살이 직사각형으로
             * 한 박자 머물렀다가, 빠질 때 확 비틀린다 — 이게 "딱 예뻐 보이는" 리듬이다.
             */
            const lead = Math.sin(psi);
            const swing = Math.sign(lead) * Math.abs(lead) ** 1.6;

            /** 0(가장 뒤) ~ 1(정면) */
            const depth = (Math.cos(psi) + 1) / 2;

            /**
             * ## 좌우가 대칭이 아니다 — "비틈이 어설프다"의 정체
             * 레퍼런스에서 **아래에서 올라오는 살은 얌전하고**(거의 정면, 크고 밝다)
             * **위로 빠지는 살만 격하게 비틀린다**(원근 왜곡이 눈에 보일 만큼).
             * 떠나는 카드의 좌우 모서리 높이비를 재보니 285:225 → perspective 900px
             * 에서 rotateY ≈ 39°. 앞 버전의 26° 를 양쪽에 똑같이 준 게 밋밋했던 이유다.
             */
            const leaving = lead > 0;
            const g = leaving ? 1 : 0.45;

            /**
             * ## 화면에는 **최대 3장**만 — 네 번째가 겹침의 원인이었다
             *
             * 램프가 `(depth − 0.22) / 0.34` 일 때 ψ=±108° 짜리 네 번째 살이
             * fade 0.37 로 아직 보였다. 얘가 아래에서 올라오며 활성 카드와 세로로
             * 89px 겹쳤다(1440×900, 전환 중간에서 실측). 눈에 보이는데 자리는
             * 없는 살이라 그냥 지우는 게 맞다.
             *
             * 들어오는 살은 이웃(ψ=−72°)까지 보이고, 떠나는 살은 더 일찍 끈다.
             * 궤도 y 가 −0.54R 뿐이라 지난 장이 활성 카드 윗변을 뚫고 남는다.
             * depth 0.70 에서 fade=0 → 이웃 자리(0.654)에 도착하기 전에 사라진다.
             *
             * 바퀴는 원이라 마지막 시대(a≈n-1)에서 인트로(i=0)가 한 바퀴 돌아
             * 아래에서 다시 올라온다. 다음 섹션을 뚫는 그 장은 시대가 아니라서 끈다.
             * 선형 거리로만 이웃을 인정한다 — 순환 이웃은 없다.
             */
            const wrapped = Math.abs(a - i) > 1.25;
            const fade = wrapped
              ? 0
              : gsap.utils.clamp(0, 1, (depth - (leaving ? 0.7 : 0.45)) / (leaving ? 0.18 : 0.2));

            /**
             * 정원 궤도만으로는 지난 장이 활성과 ~100px 겹친다(카드 반높이 합 > 0.54R).
             * swing 에 비례해 더 위로 밀어, 빠져나가며 화면 밖으로 보낸다.
             * 활성(swing=0)은 그대로다.
             */
            const yOrbit = R * (Math.sin(ang) - P_SIN);
            const lift = leaving ? window.innerHeight * 0.32 * Math.abs(swing) : 0;

            gsap.set(el, {
              x: R * (Math.cos(ang) - P_COS),
              y: yOrbit - lift,
              z: DEPTH * (Math.cos(psi) - 1) * g,
              /**
               * ## 각도는 **여기가 유일한 출처**이고, 활성(ψ=0)에서 정확히 0 이다.
               * `.photoCard` 의 `--tilt-rest*` 는 전부 0 으로 내렸다 — 정지 자세를
               * 주면 지금 읽고 있는 시대의 사진까지 비뚤어져서 "정면에 섰다"가 안 된다.
               *
               * 게인은 레퍼런스 실측에 맞췄다. 떠나는 살의 좌우 모서리 높이비가
               * 285:225 → perspective 700px 에서 **rotateY ≈ 39°**, 윗변 기울기
               * **rotateZ ≈ 12.5°**. swing 이 이웃에서 0.92 이므로 42·13.5 로 역산.
               *
               * ⚠️ rotateZ 를 18~21° 로 키우면 판이 아니라 **마름모**로 보인다.
               * 비틀림은 Y(원근)가 만들고 Z 는 거들기만 해야 고급스럽다.
               */
              rotationY: swing * 42 * g,
              /* X 는 거의 안 쓴다 — 레퍼런스의 왜곡도 대부분 가로(Y)축이었다 */
              rotationX: -swing * 6 * g,
              rotation: swing * 13.5 * g,
              /* 들어오는 살은 거의 안 줄고(0.20), 떠나는 살만 확 줄어든다(0.62) */
              scale: 1 - (1 - depth) * (leaving ? 0.62 : 0.2),
              opacity: fade * (1 - (1 - depth) * (leaving ? 1.6 : 0.35)),
              visibility: fade <= 0.01 ? "hidden" : "visible",
              zIndex: Math.round(depth * 100),
            });
          });
        };

        const state = { p: 0 };
        const tween = gsap.to(state, {
          p: 1,
          ease: "none",
          onUpdate: () => place(state.p),
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            invalidateOnRefresh: true,
            /**
             * 창 높이가 바뀌면 R 이 달라지므로 다시 배치해야 한다.
             * ⚠️ 예전엔 `ScrollTrigger.addEventListener("refresh", …)` 를 썼는데
             * 그건 **전역 리스너라 useGSAP 컨텍스트가 정리하지 못한다** — 라우트를
             * 오갈 때마다 하나씩 쌓여서 refresh 한 번에 place() 가 여러 번 돌았다.
             * 트리거 자체의 콜백으로 옮기면 트윈이 죽을 때 같이 죽는다.
             */
            onRefresh: (self) => place(self.progress),
          },
        });
        place(0);

        return () => {
          tween.kill();
          gsap.set(spokes, {
            clearProps: "x,y,z,rotation,rotationX,rotationY,scale,opacity,visibility,zIndex,transform",
          });
        };
      };

      /**
       * 모바일 책넘김.
       *
       * 사진은 PC 물레방아를 **옆으로 눕힌** 원 궤도(다음 장 오른쪽, 지난 장 왼쪽).
       * 카피는 한 장씩 슬라이드. 스크롤은 장 번호만 고르고, 화면은 짧은 트윈으로 넘긴다.
       */
      const bindBookStage = () => {
        if (!wheel || spokes.length === 0) return undefined;

        const n = spokes.length;
        const steps = Math.max(1, n - 1);

        /**
         * 이전 | 현재 | 다음 을 좌우 대칭으로 둔다.
         * 예전엔 PC 물레방아의 "떠나는 살" 게인을 왼쪽에 그대로 써서
         * 이전 장이 더 비틀리며 overflow 밖으로 잘렸다.
         */
        /**
         * ## 모바일 = PC 물레방아를 **옆으로 눕힌 것**
         *
         * 수정요청: "현재 물레방아를 옆으로 돌리듯이".
         *
         * 앞 구현은 카드를 가로로 나란히 미는 **평면 슬라이드**였다. 바퀴가 아니라
         * 그냥 캐러셀이라 PC 와 언어가 달랐다. 여기서는 PC 와 **같은 원·같은 게인**을
         * 쓰고 위상만 90° 돌린다.
         *
         * PC 는 활성 살이 원의 **왼쪽**(206.5°)에 앉아 접선이 세로 → 세로로 흐른다.
         * 여기서는 원의 **아래쪽**에 앉혀 접선을 가로로 만든다.
         *
         * ## ⚠️ 정원(正圓)이 아니라 **납작한 타원**이다
         *
         * 수정요청: "각도를 낮춰서 사이드에서 나와서 사이드로 가는 느낌".
         * 처음엔 PC 와 같은 정원에 위상만 116.5° 로 돌렸는데, 그러면 빠지는 살의
         * 세로 이동이 −1.04R 이라 **옆으로 가는 게 아니라 위로 날아갔다.**
         *
         * 가로 반지름은 크게, 세로 반지름은 작게 잡아 궤도를 눕힌다. 위상도
         * 26.5° → 10° 로 줄여 좌우 비대칭만 남긴다:
         *   다음 살 → 오른쪽에서 들어온다 (Δx ≈ +1.06Rx, Δy ≈ −0.52Ry)
         *   지난 살 → 왼쪽으로 빠진다     (Δx ≈ −0.82Rx, Δy ≈ −0.85Ry)
         * Ry 가 Rx 의 27% 라 세로 이동은 가로의 1/5 수준 — 완전히 옆으로 흐른다.
         *
         * 반지름 기준축도 바뀐다. PC 는 세로로 흐르니 vh 였지만, 눕히면 가로가
         * 병목이라 **스테이지 폭** 기준이다.
         */
        const PHASE_MO = (100 * Math.PI) / 180;
        const P_COS_MO = Math.cos(PHASE_MO);
        const P_SIN_MO = Math.sin(PHASE_MO);
        const stepAngle = (Math.PI * 2) / n;

        const placeSpokes = (a: number) => {
          const span = wheel.offsetWidth || window.innerWidth;
          /* 가로는 넉넉히(이웃이 화면 밖으로 나가야 "사이드에서" 들어온다),
             세로는 얕게 — 이 비율이 곧 "눕힌 정도"다. */
          const RX = span * 0.95;
          const RY = span * 0.26;
          const DEPTH = span * 0.18;

          spokes.forEach((el, i) => {
            /* 부호는 PC 와 같다 — (a − i) 여야 바퀴가 진행 방향으로 돈다 */
            const psi = (a - i) * stepAngle;
            const ang = PHASE_MO + psi;

            const lead = Math.sin(psi);
            /* 0 근처를 눌러 활성 살이 **반듯하게 한 박자 머문다** (PC 와 같은 이유) */
            const swing = Math.sign(lead) * Math.abs(lead) ** 1.6;
            const depth = (Math.cos(psi) + 1) / 2;

            /* 떠나는 살만 격하게 비틀린다 — 들어오는 살은 얌전해야 "물레방아"가 된다 */
            const leaving = lead > 0;
            const g = leaving ? 1 : 0.45;

            const wrapped = Math.abs(a - i) > 1.25;
            const fade = wrapped
              ? 0
              : gsap.utils.clamp(0, 1, (depth - (leaving ? 0.7 : 0.45)) / (leaving ? 0.18 : 0.2));

            /* 정원 궤도만으로는 지난 장이 활성과 겹친다 — 빠질수록 왼쪽으로 더 민다.
               PC 는 같은 이유로 위(y)로 밀었다. 눕혔으니 여기서는 가로다. */
            const xOrbit = RX * (Math.cos(ang) - P_COS_MO);
            /* 궤도가 눕었으니 밀기도 줄인다 — 예전 0.5 는 정원 기준의 겹침 보정이었다 */
            const push = leaving ? span * 0.18 * Math.abs(swing) : 0;

            gsap.set(el, {
              x: xOrbit - push,
              y: RY * (Math.sin(ang) - P_SIN_MO),
              z: DEPTH * (Math.cos(psi) - 1) * g,
              /**
               * 각도를 낮춘다 (수정요청). PC 값(42/6/13.5)은 세로로 크게 휘어
               * 나가는 궤도에 맞춘 것이라, 옆으로 흐르는 지금은 과하게 비틀린다.
               * 절반 이하로 내려 "판이 살짝 돌아 나간다" 정도만 남긴다.
               */
              rotationY: swing * 20 * g,
              rotationX: -swing * 3 * g,
              rotation: swing * 5 * g,
              scale: 1 - (1 - depth) * (leaving ? 0.62 : 0.2),
              opacity: fade * (1 - (1 - depth) * (leaving ? 1.6 : 0.35)),
              visibility: fade <= 0.01 ? "hidden" : "visible",
              zIndex: Math.round(depth * 100),
            });
          });
        };

        /**
         * ## 카피는 **가로로 밀지 않는다** — 잘려 보이면 안 된다
         *
         * 수정요청: "텍스트는 짤려보이면 안 되고".
         *
         * 예전에는 사진과 같이 화면 폭만큼 밀었다. 그러면 전환 내내 문장이
         * 스테이지 오른쪽 경계에 **반쯤 걸려 잘린 채로** 읽힌다 — 사진은 판이라
         * 잘려도 그림이지만, 글자는 잘리는 순간 그냥 오류로 보인다.
         *
         * 그래서 자리는 그대로 두고 **크로스페이드**만 한다. 살짝만 흘려(24px)
         * 방향감은 남기되 어떤 순간에도 문장이 프레임을 벗어나지 않는다.
         */
        const COPY_DRIFT = 24;

        const placeCopy = (a: number) => {
          copyPanes.forEach((el, i) => {
            const delta = i - a;
            const dist = Math.abs(delta);
            const wrapped = dist > 1.02;
            /* 나가는 장이 먼저 사라져야 두 문장이 겹쳐 읽히지 않는다 */
            const fade = wrapped ? 0 : gsap.utils.clamp(0, 1, 1 - dist * 1.7);

            gsap.set(el, {
              x: delta * COPY_DRIFT,
              y: 0,
              z: 0,
              rotationY: 0,
              rotationX: 0,
              rotation: 0,
              opacity: fade,
              visibility: fade <= 0.01 ? "hidden" : "visible",
              zIndex: Math.round((1 - dist) * 10),
            });
          });
        };

        const place = (a: number) => {
          placeSpokes(a);
          placeCopy(a);
        };

        /**
         * ## 연속 추종이 아니라 **장 단위로 머문다** (수정요청 26.08.28-2)
         *
         * 진행도를 그대로 위치에 물렸더니(scrub) 스크롤 내내 두 장이 반반씩
         * 걸쳐 있어서, **어느 순간에도 완성된 화면이 없었다** — 사진도 글도
         * 늘 좌우가 잘린 중간 상태다.
         *
         * 그래서 임계를 넘을 때만 다음 장으로 넘기고 **거기서 멈춘다.**
         * 넘어가는 0.45초 동안만 물레방아가 돌고, 나머지 구간은 그 장이 반듯하게
         * 서 있는다. 스크롤은 "몇 번째 장인가"만 고르고, 화면은 트윈이 그린다.
         *
         * 임계는 **중간점(±0.5)**. 반올림과 같은 지점이라 왕복해도 히스테리시스가
         * 어긋나지 않는다. 빠르게 굴려 여러 장을 건너뛰면 `Math.round` 가 그만큼
         * 한 번에 따라간다.
         */
        const visual = { a: 0 };
        let page = 0;
        let flip: gsap.core.Tween | undefined;

        const goTo = (target: number) => {
          const next = gsap.utils.clamp(0, steps, target);
          if (next === page) return;
          page = next;
          flip?.kill();
          flip = gsap.to(visual, {
            a: next,
            duration: 0.45,
            ease: "power2.inOut",
            overwrite: true,
            onUpdate: () => place(visual.a),
            onComplete: () => place(next),
          });
        };

        const st = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const t = self.progress * steps;
            if (Math.abs(t - page) > 0.5) goTo(Math.round(t));
          },
          onRefresh: (self) => {
            page = Math.round(self.progress * steps);
            visual.a = page;
            flip?.kill();
            place(page);
          },
        });

        /**
         * ## 손가락 좌우 스와이프
         *
         * 세로 스크롤이 장을 고르는 구조라, 가로로 밀면 **그 장의 스크롤 위치로
         * 페이지를 옮긴다.** 진행도가 유일한 진실이므로 스와이프와 스크롤이
         * 절대 어긋나지 않는다(스와이프가 따로 상태를 들고 있으면 곧 틀어진다).
         *
         * ⚠️ Lenis 를 거쳐야 한다. `window.scrollTo` 를 직접 부르면 Lenis 가
         *    자기 목표값으로 즉시 되돌린다.
         */
        const SWIPE_MIN = 44;
        let sx = 0;
        let sy = 0;
        let tracking = false;
        let horizontal = false;

        const onDown = (e: PointerEvent) => {
          if (e.pointerType === "mouse") return;
          sx = e.clientX;
          sy = e.clientY;
          tracking = true;
          horizontal = false;
        };
        const onMove = (e: PointerEvent) => {
          if (!tracking) return;
          const dx = e.clientX - sx;
          const dy = e.clientY - sy;
          /* 세로 의도가 조금이라도 크면 스크롤에 양보한다 — 가로로 확실할 때만 잡는다 */
          if (!horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            horizontal = true;
          }
        };
        const onUp = (e: PointerEvent) => {
          if (!tracking) return;
          tracking = false;
          if (!horizontal || !st) return;
          const dx = e.clientX - sx;
          if (Math.abs(dx) < SWIPE_MIN) return;
          const cur = Math.round(st.progress * steps);
          const next = gsap.utils.clamp(0, steps, cur + (dx < 0 ? 1 : -1));
          if (next === cur) return;
          const top = st.start + ((st.end - st.start) * next) / steps;
          window.dispatchEvent(
            new CustomEvent("app:scroll-to", { detail: { top, duration: 0.45 } }),
          );
        };

        const stage = section.querySelector<HTMLElement>("[data-history-stage]");
        stage?.addEventListener("pointerdown", onDown, { passive: true });
        stage?.addEventListener("pointermove", onMove, { passive: true });
        stage?.addEventListener("pointerup", onUp, { passive: true });
        stage?.addEventListener("pointercancel", onUp, { passive: true });

        place(0);

        return () => {
          stage?.removeEventListener("pointerdown", onDown);
          stage?.removeEventListener("pointermove", onMove);
          stage?.removeEventListener("pointerup", onUp);
          stage?.removeEventListener("pointercancel", onUp);
          flip?.kill();
          st.kill(true);
          gsap.set(spokes, {
            clearProps: "x,y,z,rotation,rotationX,rotationY,scale,opacity,visibility,zIndex,transform",
          });
          gsap.set(copyPanes, {
            clearProps: "x,y,z,rotation,rotationX,rotationY,opacity,visibility,zIndex,transform",
          });
        };
      };

      const unbindWheel = isDesktop
        ? bindDesktopWheel()
        : isHistoryWheel
          ? bindBookStage()
          : undefined;

      /**
       * ── ③-b 짧은 모바일 슬롯 사진: 들어오며 −8°, 화면 중앙에서 0° ──
       * 트리거는 회전하는 img 가 아니라 부모 칸 — 기울어진 AABB 로
       * start/end 가 밀리면 중앙을 지나도 0 이 안 된다.
       * 끝은 `center center`. 사진 중심이 화면 중앙에 닿는 순간 정면.
       * scrub 은 true(지연 없음). 0.45 + Lenis 라 중앙을 넘어도 따라오지 못했다.
       */
      const slotPhotos = gsap.utils.toArray<HTMLElement>("[data-history-slot]", section);
      if (isHistoryStack && slotPhotos.length > 0) {
        slotPhotos.forEach((photo) => {
          const frame = photo.parentElement ?? photo;
          gsap.set(photo, { rotation: -8, force3D: true });
          gsap.to(photo, {
            rotation: 0,
            ease: "none",
            force3D: true,
            overwrite: "auto",
            scrollTrigger: {
              trigger: frame,
              start: "center 80%",
              end: "center 50%",
              scrub: true,
              invalidateOnRefresh: true,
            },
          });
        });
      }

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

      return () => {
        unbindWheel?.();
      };
    },
    { scope: sectionRef, dependencies: [isDesktop, isHistoryWheel, isHistoryStack] },
  );

  return sectionRef;
}
