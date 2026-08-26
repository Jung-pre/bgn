"use client";

import { useRef } from "react";
import { MQ } from "@/shared/config/breakpoints";
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
      if (introLines.length > 0) {
        gsap.fromTo(
          introLines,
          { clipPath: "inset(0 100% 0 0)" },
          {
            clipPath: "inset(0 0% 0 0)",
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.28,
            clearProps: "clipPath",
            scrollTrigger: { trigger: introLines[0], start: "top 85%", once: true },
          },
        );
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
        if (lines.length > 0) {
          gsap.fromTo(
            lines,
            { clipPath: "inset(0 100% 0 0)" },
            {
              clipPath: "inset(0 0% 0 0)",
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.12,
              clearProps: "clipPath",
              scrollTrigger: { trigger: el, start: "top 82%", once: true },
            },
          );
        }

        /* 성과 항목은 체크가 하나씩 찍히는 리듬이라 와이프보다 낫다 */
        const points = gsap.utils.toArray<HTMLElement>("[data-history-point]", el);
        if (points.length > 0) {
          gsap.fromTo(
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
              scrollTrigger: { trigger: el, start: "top 82%", once: true },
            },
          );
        }
      });

      // ── ③ 물레방아: 사진 5장이 하나의 원에 박혀 함께 돈다 ─────────────
      const wheel = section.querySelector<HTMLElement>("[data-history-wheel]");
      const spokes = gsap.utils.toArray<HTMLElement>("[data-history-spoke]", section);

      if (wheel && spokes.length > 0) {
        const n = spokes.length;
        const step = (Math.PI * 2) / n;

        /**
         * 진행도 p(0~1) → 활성 인덱스 a(0 ~ n-1).
         * 살 i 의 각도는 `(i − a) · step` 이라 a = i 일 때 정면(θ=0)이 된다.
         * 텍스트 행 수와 살 수가 같아서 a 가 곧 "지금 읽고 있는 행"이다.
         */
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
        gsap.to(state, {
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
      }

      /**
       * ── ③-b 모바일 슬롯 사진: 들어오며 −8°, 화면 중앙에서 0° ──
       * 트리거는 회전하는 img 가 아니라 부모 칸 — 기울어진 AABB 로
       * start/end 가 밀리면 중앙을 지나도 0 이 안 된다.
       * 끝은 `center center`. 사진 중심이 화면 중앙에 닿는 순간 정면.
       * scrub 은 true(지연 없음). 0.45 + Lenis 라 중앙을 넘어도 따라오지 못했다.
       */
      const slotPhotos = gsap.utils.toArray<HTMLElement>("[data-history-slot]", section);
      if (slotPhotos.length > 0) {
        const mm = gsap.matchMedia();
        mm.add(MQ.mobile, () => {
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
    },
    { scope: sectionRef },
  );

  return sectionRef;
}
