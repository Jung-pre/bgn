"use client";

import { useRef } from "react";
import clsx from "clsx";
import { MQ } from "@/shared/config/breakpoints";
import { gsap, useGSAP, SCROLL_ENTRANCE, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import { Marquee } from "@/components/marquee/marquee";
import type { AiStepMessages, AiSystemSectionMessages } from "@/shared/i18n/messages";
import { renderWithEmphasis } from "@/shared/lib/render-emphasis";
import { countUpTween, formatNumeric, parseNumericLabel } from "./count-up";
import { ScrollHint } from "./scroll-hint";
import styles from "./ai-system-section.module.css";

/**
 * BGN AI 정밀 검사 시스템 — Figma `8:962` (1920 × 1007, 구 `2:1088`).
 *
 * ## 디자이너 주석 (docs/plan/07-interactions.md)
 *   헤드라인 2:1106 — "진입시 왼쪽에서 오른쪽 방향으로 텍스트 생성되며 함께 꾸밈요소 배치"
 *   카드    2:1108 — "시간차를 두고 카드들이 배치되며 각 카드에 어울리는 인터렉션 배치"
 *                    (레퍼: https://ambiq.ai/)
 *
 * ## 시안 재확인으로 바뀐 것 (2026-08 검수)
 * 1. 카드는 흰 카드가 아니라 **반투명 유리 카드**다 (2:1109: 흰색 80% → 하늘색 32%
 *    그라데이션, 흰 1px 보더, blur 6, radius 24, shadow 1px2px8px).
 * 2. 데이터 라벨은 카드 아래 한 줄 텍스트가 아니라 **이미지 위에 뜬 유리 배지**다
 *    (2:1118 SPH / 2:1122 AXIS / 2:1120 OPTICAL MAPPING / 2:1133 / 2:1144 / 2:1176).
 * 3. 4번 카드는 막대 그래프가 아니라 **추천 리스트 패널 + 5각 레이더**다 (2:1156).
 *    수치 98/91/88 은 추정이 아니라 2:1186·2:1194·2:1202 실값으로 확인됐다.
 * 4. 헤드라인은 "BGN AI"(#171717) + **옅은 블루 박스 마커**("정밀 검사 시스템", #0c3ca2).
 *    직전 구현의 그라데이션 룰·눈금은 시안에 없는 요소라 제거했다. 주석의 "꾸밈요소"는
 *    이 마커 박스(2:1105 + 2:1210)다.
 * 5. 마퀴(2:1089)는 카드 아래가 아니라 **카드 뒤로 겹쳐** 지나간다.
 *
 * ## 카드 오브젝트 = 실사 이미지 (2026-08 에셋 입고)
 * 시안 1~3번 카드는 추상 도형이 아니라 **3D 렌더 사진**이다. 에셋이 없던 동안
 * SVG(홍채 동심원 / 아이소메트릭 큐브 / 와이어프레임 안구)로 대체해 두었는데,
 * 원본이 들어와 그대로 교체했다.
 *   1 데이터 수집    → `eye-1.webp`    (레이저가 각막에 닿는 정면 스캔)
 *   2 AI 빅데이터    → `eye-4.webp`    (데이터 큐브 — 파일명과 달리 눈이 아니라 큐브다)
 *   3 AI 시뮬레이션  → `eye-hero.webp` (유리 플랫폼 위 안구 + 데이터 큐브)
 *   4 맞춤형 제안    → 이미지 없음. 시안에도 패널 + 레이더뿐이라 그대로 둔다.
 *
 * ## 배지·레이더는 SVG/DOM 을 유지한다
 * 시안에서 SPH/AXIS/OPTICAL MAPPING/760,000+/ACCURACY 배지와 4번 카드의 추천 패널·
 * 5각 레이더는 **사진 위에 얹힌 UI**다. 사진에 구워져 있지 않으므로 지금 구조가 맞다.
 * 카운트업·스파크라인 드로잉도 그래서 살아 있다.
 *
 * ## 3D(R3F) 가 아닌 이유
 * CLAUDE.md 확인 항목 6 — 4장이 동시에 뷰포트에 들어와 캔버스 4개는 프레임 예산 초과.
 * 남은 SVG(스파크라인·레이더)는 `pathLength="1"` 정규화로 `getTotalLength()` 측정 없이
 * 드로잉한다(레이아웃 읽기 0회 = 스크롤 중 강제 리플로우 없음).
 */
export interface AiSystemSectionProps {
  messages: AiSystemSectionMessages;
}

/** 1번 카드 계측 배지 — Figma 2:1119 / 2:1123 리터럴. 번역 대상이 아닌 계측값이다. */
const SPH_LABEL = "SPH  -3.25";
const AXIS_LABEL = "AXIS  180°";

/** 4번 카드 추천 스코어 — Figma 2:1186 / 2:1194 / 2:1202 실값 */
const RECOMMEND_SCORES = [98, 91, 88] as const;

/** 2:1178. i18n messages 에 없는 문구라 시안 리터럴로 둔다(문구 추가 필요 — 보고 참조). */
const RECOMMEND_HEAD = "추천시력교정술";

/** 카드 스태거(초). 0.13 이면 4장이 겹쳐 '쫘라락'으로 보여 순서가 안 읽힌다.
 *  한 장이 자리를 잡은 뒤 다음이 따라오게 둔다. */
const CARD_STEP = 0.4;
/** 카드 타임라인은 그리드가 뷰포트에 들어올 때 시작하므로 0. */
const CARD_AT = 0;
/** 카드가 안착한 뒤 비주얼이 시작되기까지의 지연 */
const VIZ_DELAY = 0.28;

export function AiSystemSection({ messages }: AiSystemSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const pick = <T extends Element>(root: ParentNode, selector: string) =>
        Array.from(root.querySelectorAll<T>(selector));

      const wipes = pick<HTMLElement>(section, "[data-wipe]");
      const decos = pick<HTMLElement>(section, "[data-deco]");
      const cards = pick<HTMLElement>(section, "[data-ai-card]");
      const draws = pick<SVGGeometryElement>(section, "[data-draw]");
      const arts = pick<HTMLImageElement>(section, "[data-art]");
      const badges = pick<HTMLElement>(section, "[data-badge]");
      const rows = pick<HTMLElement>(section, "[data-row]");

      /** `data-draw` 값 = 그려질 길이 비율(pathLength=1 기준). */
      const drawLength = (el: Element) => Number((el as SVGElement).dataset.draw ?? 1);

      // 라벨 안 숫자 자리 — 시작값 0 으로 눌러 둔다(카드가 아직 안 보이는 동안).
      const counters = cards
        .map((card) => {
          const label = card.querySelector<HTMLElement>("[data-count-label]");
          const value = card.querySelector<HTMLElement>("[data-count-value]");
          const spec = label ? parseNumericLabel(label.dataset.countLabel ?? "") : null;
          return spec && value ? { card, value, spec } : null;
        })
        .filter((entry) => entry !== null);

      if (prefersReducedMotionSync()) {
        // early-return 금지. 최종 상태로 눌러 놓고 인라인 스타일을 지운다.
        settleReducedMotion([...wipes, ...decos, ...cards, ...arts, ...badges, ...rows]);
        // clearProps 가 커버하지 못하는 SVG 프레젠테이션 속성은 직접 확정.
        gsap.set([...wipes, ...decos], { clipPath: "none" });
        gsap.set(draws, { strokeDashoffset: 0 });
        for (const { value, spec } of counters) {
          value.textContent = formatNumeric(spec.value, spec);
        }
        return;
      }

      gsap.set([...wipes, ...decos], { clipPath: "inset(0 100% 0 0)" });
      gsap.set(cards, {
        autoAlpha: 0,
        y: SCROLL_ENTRANCE.y,
        scale: SCROLL_ENTRANCE.scale,
        transformOrigin: "50% 50%",
      });
      gsap.set(draws, { strokeDashoffset: (_i, target: Element) => drawLength(target) });
      // 사진은 카드보다 살짝 늦게, 아주 조금 크게 들어온다 — 카드 등장이 '착' 하고
      // 멈춘 뒤 오브젝트가 뒤따라 앉는 느낌. 크게 움직이면 사진이라 뭉개져 보인다.
      gsap.set(arts, { autoAlpha: 0, scale: 1.06, transformOrigin: "50% 60%" });
      gsap.set(badges, { autoAlpha: 0, y: 10, scale: 0.94, transformOrigin: "50% 50%" });
      gsap.set(rows, { autoAlpha: 0, x: -8 });
      for (const { value, spec } of counters) {
        value.textContent = formatNumeric(0, spec);
      }

      const grid = section.querySelector("[data-ai-grid]");

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: { trigger: section, start: "top 78%", once: true },
      });

      tl.to(
        wipes,
        { clipPath: "inset(0 0% 0 0)", duration: 0.8, stagger: 0.14, clearProps: "clipPath" },
        0,
      )
        // 주석 "함께 꾸밈요소 배치" — 마커 박스도 헤드라인과 같은 좌→우로 열린다.
        // scaleX 로 키우면 안에 든 글자까지 눌려 보이므로 wipe 로 연다.
        .to(decos, { clipPath: "inset(0 0% 0 0)", duration: 0.7, clearProps: "clipPath" }, 0.25);

      /* 카드는 섹션 전체가 아니라 **그리드가 보일 때** 시작한다.
         예전엔 섹션 top 78% 에서 이미 끝나, 카드 구간에 도착하면 4장이 다 떠 있었다. */
      const cardTl = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: { trigger: grid ?? section, start: "top 82%", once: true },
      });

      cardTl.to(
        cards,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: CARD_STEP,
          clearProps: "opacity,visibility,transform",
        },
        CARD_AT,
      );

      cards.forEach((card, index) => {
        const at = CARD_AT + index * CARD_STEP + VIZ_DELAY;

        const cardDraws = pick<SVGGeometryElement>(card, "[data-draw]");
        if (cardDraws.length > 0) {
          cardTl.to(
            cardDraws,
            { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: 0.08 },
            at,
          );
        }

        const cardArts = pick<HTMLImageElement>(card, "[data-art]");
        if (cardArts.length > 0) {
          cardTl.to(
            cardArts,
            {
              autoAlpha: 1,
              scale: 1,
              duration: 0.9,
              ease: "power2.out",
              clearProps: "opacity,visibility,transform",
            },
            at - 0.2,
          );
        }

        const cardRows = pick<HTMLElement>(card, "[data-row]");
        if (cardRows.length > 0) {
          cardTl.to(
            cardRows,
            { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.08, clearProps: "opacity,transform" },
            at + 0.15,
          );
        }

        const cardBadges = pick<HTMLElement>(card, "[data-badge]");
        if (cardBadges.length > 0) {
          cardTl.to(
            cardBadges,
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.55,
              ease: "back.out(1.6)",
              stagger: 0.1,
              clearProps: "opacity,visibility,transform",
            },
            at + 0.1,
          );
        }

        const counter = counters.find((entry) => entry.card === card);
        if (counter) cardTl.add(countUpTween(counter.value, counter.spec), at + 0.2);
      });

      /**
       * 등장 때 쓰던 그래프 드로잉·카운트업을 호버마다 한 번 더 그린다.
       * 카드 이동(translate)은 CSS hover 가 맡고, GSAP 는 stroke/숫자만 건드린다.
       * `MQ.hoverable` — 터치 노트북에서 호버가 눌어붙으면 계속 다시 그려진다.
       */
      const hoverTls = new Map<HTMLElement, gsap.core.Timeline>();
      const hoverable = window.matchMedia(MQ.hoverable);

      const replayViz = (card: HTMLElement) => {
        if (!hoverable.matches || prefersReducedMotionSync()) return;
        if (cardTl.isActive() || cardTl.progress() < 1) return;

        hoverTls.get(card)?.kill();

        const cardDraws = pick<SVGGeometryElement>(card, "[data-draw]");
        const counter = counters.find((entry) => entry.card === card);
        if (cardDraws.length === 0 && !counter) return;

        const hoverTl = gsap.timeline({ defaults: { ease: "power3.out" } });
        hoverTls.set(card, hoverTl);

        if (cardDraws.length > 0) {
          hoverTl.fromTo(
            cardDraws,
            { strokeDashoffset: (_i, target) => drawLength(target as Element) },
            {
              strokeDashoffset: 0,
              duration: 1.05,
              ease: "power2.inOut",
              stagger: 0.08,
            },
            0,
          );
        }

        if (counter) {
          counter.value.textContent = formatNumeric(0, counter.spec);
          hoverTl.add(countUpTween(counter.value, counter.spec, 1.15), 0.06);
        }
      };

      const onPointerEnter = (event: Event) => {
        replayViz(event.currentTarget as HTMLElement);
      };

      for (const card of cards) {
        card.addEventListener("pointerenter", onPointerEnter);
      }

      return () => {
        for (const card of cards) {
          card.removeEventListener("pointerenter", onPointerEnter);
        }
        for (const hoverTl of hoverTls.values()) hoverTl.kill();
        hoverTls.clear();
      };
    },
    { scope: sectionRef, dependencies: [messages.steps.length] },
  );

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="ai-system-title">
      <header className={styles.header}>
        <p className={clsx("eyebrow", styles.wipeLine)} data-wipe lang="en">
          {messages.eyebrow}
        </p>
        <h2 id="ai-system-title" className={clsx("section-title", styles.wipeLine)} data-wipe>
          {renderWithMark(messages.title, messages.titleMarker)}
        </h2>
        {messages.description ? (
          <p className={clsx("section-desc", styles.wipeLine)} data-wipe>
            {renderWithEmphasis(messages.description, messages.descriptionEmphasis)}
          </p>
        ) : null}
      </header>

      {/* 모바일(≤768)에서만 실제 가로 스크롤 컨테이너가 된다.
          ⚠️ 여기에 `data-lenis-prevent` 를 달지 않는다. 데스크톱에서 이 그리드는
          스크롤 컨테이너가 아니면서 뷰포트의 3분의 2를 덮는다. 그 위에서 굴린 세로
          휠이 통째로 네이티브로 새면서 페이지가 한 번에 튀고 GNB 가 깜빡였다.
          내부 스크롤 판별은 Lenis 의 `allowNestedScroll` 이 축까지 보고 처리한다
          (`smooth-scroll-provider.tsx`) — 모바일 가로 스와이프는 그대로 산다. */}
      <ol ref={gridRef} className={styles.grid} data-ai-grid>
        {messages.steps.map((step, index) => (
          <li
            key={step.step}
            className={clsx(styles.card, index === 3 && styles.cardLavender)}
            data-ai-card
          >
            <div className={styles.art} aria-hidden>
              <StepArt index={index} />
            </div>

            <div className={styles.cardHead}>
              <p className={styles.step} lang="en">
                {step.step}.
              </p>
              <h3 className={styles.cardTitle}>{step.title}</h3>
            </div>
            {step.description ? <p className={styles.cardDesc}>{step.description}</p> : null}

            <StepData index={index} step={step} />
          </li>
        ))}
      </ol>

      {/* 시안 68:3850 하단의 스크롤 인디케이터. 모바일에서만 보인다 */}
      <ScrollHint scrollerRef={gridRef} />

      {/* 섹션 전환 디바이더 — 히어로와 같은 시그니처 마퀴. 카드 뒤로 흐른다. */}
      {/* 시안 2:1088 의 고스트 텍스트는 **속 빈 아웃라인이 아니라 채운 글자**다.
          x8~80 열을 이진화해 보면 A 의 꼭짓점 부근(y818~832)이 통째로 채워져 있고
          획 안쪽이 배경색으로 비지 않는다. `outline` 을 주면 시안과 다른 물건이 된다. */}
      <Marquee text={messages.marquee} className={styles.marquee} duration={30} />
    </section>
  );
}

/**
 * 헤드라인 마커. Figma 2:1105 는 형광펜 밑줄(공용 `.marker`)이 아니라
 * 옅은 블루 박스 + 좌우 세로 바다 → 섹션 전용 클래스로 감싼다.
 *
 * `titleMarker` 가 사전에 없으면 마커 없이 통짜로 렌더한다(현재 ko 사전이 그렇다).
 */
function renderWithMark(title: string, marker?: string) {
  if (!marker || !title.includes(marker)) return title;
  const [before, ...rest] = title.split(marker);
  return (
    <>
      {before}
      <span className="title-mark" data-deco>
        {marker}
      </span>
      {rest.join(marker)}
    </>
  );
}

/* ── 카드 배경 오브젝트 (8:962 — 1~3번 카드의 3D 렌더 사진) ──────────────── */

/**
 * 카드별 오브젝트. 에셋은 832×912 @2x 라 카드 폭 100%(1x = 416)로 깐다.
 * 카드가 aspect-ratio 로 줄어드는 구조라 px 로 박으면 1440 에서 어긋난다.
 *
 * 전부 장식이다. 사진이 전하는 정보는 옆의 제목·설명·배지가 이미 글자로 갖고 있어
 * alt 를 채우면 스크린리더에서 같은 말이 두 번 읽힌다 → `alt=""`.
 * (`.art` 래퍼에 `aria-hidden` 이 걸려 있어 이중으로 막힌다.)
 */
const STEP_ART = [
  { src: "/main/img_04_eye01.webp", width: 832, height: 912 },
  { src: "/main/img_04_eye02.webp", width: 832, height: 912 },
  { src: "/main/img_04_eye03.webp", width: 832, height: 912 },
] as const;

function StepArt({ index }: { index: number }) {
  const art = STEP_ART[index];
  // 4번 카드는 시안에도 이미지가 없다 (8:962 — 패널 + 레이더뿐).
  if (!art) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- 카드 폭에 %로 물려 있어 next/image 의 고정 sizes 계산과 맞지 않는다 */
    <img
      className={styles.artImage}
      src={art.src}
      alt=""
      width={art.width}
      height={art.height}
      loading="lazy"
      decoding="async"
      data-art
    />
  );
}

/* ── 카드 데이터 배지 ────────────────────────────────────────────────────── */

function StepData({ index, step }: { index: number; step: AiStepMessages }) {
  switch (index) {
    case 0:
      return (
        <>
          <p className={clsx(styles.badge, styles.badgeSph)} data-badge lang="en">
            <span className={styles.badgeText}>{SPH_LABEL}</span>
          </p>
          <p className={clsx(styles.badge, styles.badgeAxis)} data-badge lang="en">
            <span className={clsx(styles.badgeText, styles.badgeTextDeep)}>{AXIS_LABEL}</span>
          </p>
          {step.dataLabel ? (
            <p className={clsx(styles.badge, styles.badgeOptical)} data-badge lang="en">
              <span className={styles.badgeText}>{step.dataLabel}</span>
            </p>
          ) : null}
        </>
      );
    case 1:
      return <StatBadge className={styles.badgeCases} label={step.dataLabel} />;
    case 2:
      return (
        <StatBadge className={styles.badgeAccuracy} label={step.dataLabel} captionFirst>
          <Sparkline />
        </StatBadge>
      );
    default:
      return <RecommendPanel names={splitNames(step.dataLabel)} />;
  }
}

/**
 * 수치 배지. `760,000+ CLINICAL CASES` / `ACCURACY 99.2%` 처럼 숫자가 i18n 문구
 * 안에 박혀 있어 라벨을 파싱해 **수치 줄 / 캡션 줄**로 나눈다.
 *
 * SSR·JS 실패 시에도 최종 수치가 보이도록 완성값으로 렌더하고,
 * 애니메이션 직전에 GSAP 이 0 으로 눌렀다가 올린다.
 */
function StatBadge({
  className,
  label,
  captionFirst = false,
  children,
}: {
  /** CSS Module 값이라 타입상 undefined 가 될 수 있다 — clsx 가 그대로 흘려보낸다 */
  className?: string;
  label?: string;
  captionFirst?: boolean;
  children?: React.ReactNode;
}) {
  const spec = label ? parseNumericLabel(label) : null;
  if (!label) return null;
  if (!spec) {
    return (
      <p className={clsx(styles.badge, className)} data-badge lang="en">
        <span className={styles.badgeCaption}>{label}</span>
      </p>
    );
  }

  // `ACCURACY 99.2%` → 캡션이 앞. `760,000+ CLINICAL CASES` → 숫자 뒤 접미사만 붙이고
  // 나머지를 캡션으로 내린다.
  const [, suffix = "", trailing = ""] = /^(\S*)\s*(.*)$/.exec(spec.after) ?? [];
  const caption = captionFirst ? spec.before.trim() : trailing;
  const tail = captionFirst ? spec.after : suffix;

  const value = (
    <span className={styles.badgeValue} key="value">
      <span className={styles.dataValue} data-count-value>
        {formatNumeric(spec.value, spec)}
      </span>
      {tail}
    </span>
  );
  const captionNode = (
    <span className={styles.badgeCaption} key="caption">
      {caption}
    </span>
  );

  return (
    <div className={clsx(styles.badge, className)} data-badge data-count-label={label} lang="en">
      {captionFirst ? [captionNode, value] : [value, captionNode]}
      {children}
    </div>
  );
}

/** 2:1147 — ACCURACY 배지 안의 미니 추이선 (102 × 43.76) */
const SPARK_PATH = "M 2 40 L 14 31 L 25 35 L 37 22 L 49 27 L 61 14 L 73 19 L 86 8 L 100 3";

function Sparkline() {
  return (
    <svg
      className={styles.sparkline}
      viewBox="0 0 102 44"
      aria-hidden
      focusable="false"
      role="presentation"
    >
      <path
        className={styles.sparkPath}
        d={SPARK_PATH}
        pathLength={1}
        strokeDasharray="1 1"
        data-draw="1"
      />
    </svg>
  );
}

/** `SMILE PRO / ICL / LASIK` → 3개 항목명 */
function splitNames(label: string | undefined) {
  if (!label) return [];
  return label
    .split("/")
    .map((name) => name.trim())
    .filter(Boolean);
}

/* ── 4. 맞춤형 제안 — 추천 패널(2:1176) + 5각 레이더(2:1157) ─────────────── */

function RecommendPanel({ names }: { names: string[] }) {
  const rows = names.length > 0 ? names : ["-", "-", "-"];
  return (
    <div className={styles.recommendGroup}>
      <ul className={styles.recommend} data-badge>
        <li className={styles.recommendHead}>{RECOMMEND_HEAD}</li>
        {rows.map((name, i) => (
          <li
            key={name}
            className={clsx(styles.recommendRow, i === 0 && styles.recommendRowTop)}
            data-row
          >
            <span className={styles.recommendName} lang="en">
              <span className={styles.radio} aria-hidden>
                <span className={styles.radioRing}>
                  <span className={styles.radioDot} />
                </span>
              </span>
              {name}
            </span>
            <span>{RECOMMEND_SCORES[i] ?? 0}%</span>
          </li>
        ))}
      </ul>
      <RadarChart />
    </div>
  );
}

/**
 * 2:1157 실측 그대로. 중심 (88,68) / 반지름 47 / 5축.
 * 데이터 포인트는 시안의 점 좌표(2:1171~2:1175)를 그대로 옮겼다 — 임의값이 아니다.
 * 라벨(2:1166~2:1170)도 SVG 안에 넣는다. HTML 로 빼면 폰트가 clamp px 라
 * 좁은 화면에서 차트만 줄고 글자는 안 줄어 겹친다.
 */
const RADAR_AXES = [
  { key: "safety", label: "안전성", x: 88, y: 21, lx: 88, ly: 15 },
  { key: "effect", label: "효과", x: 132.7, y: 53.48, lx: 155, ly: 57 },
  { key: "recovery", label: "회복속도", x: 115.62, y: 106.02, lx: 137, ly: 125 },
  { key: "clarity", label: "선명도", x: 60.38, y: 106.02, lx: 49, ly: 125 },
  { key: "accuracy", label: "정확성", x: 43.3, y: 53.48, lx: 21, ly: 57 },
] as const;

const RADAR_VALUE = "88.5,31.5 126.56,55.01 102.54,87.78 69.33,93.6 63.5,60.16";
const RADAR_GRID = RADAR_AXES.map((a) => `${a.x},${a.y}`).join(" ");
/** 안쪽 보조 오각형 — 중심(88,68) 기준으로 축소 */
const RADAR_GRID_INNER = RADAR_AXES.map(
  (a) => `${88 + (a.x - 88) * 0.55},${68 + (a.y - 68) * 0.55}`,
).join(" ");

function RadarChart() {
  return (
    <svg
      className={styles.radar}
      viewBox="0 0 165 131"
      aria-hidden
      focusable="false"
      role="presentation"
    >
      <polygon className={styles.radarGrid} points={RADAR_GRID} />
      <polygon className={styles.radarGrid} points={RADAR_GRID_INNER} />
      {RADAR_AXES.map((a) => (
        <line className={styles.radarGrid} key={a.key} x1="88" y1="68" x2={a.x} y2={a.y} />
      ))}
      <polygon
        className={styles.radarArea}
        points={RADAR_VALUE}
        pathLength={1}
        strokeDasharray="1 1"
        data-draw="1"
      />
      {RADAR_AXES.map((a) => (
        <text className={styles.radarLabel} key={a.key} x={a.lx} y={a.ly} textAnchor="middle">
          {a.label}
        </text>
      ))}
    </svg>
  );
}
