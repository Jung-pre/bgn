"use client";

import { useRef } from "react";
import clsx from "clsx";
import { gsap, useGSAP, SCROLL_ENTRANCE, settleReducedMotion } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import { Marquee } from "@/components/marquee/marquee";
import type { AiStepMessages, AiSystemSectionMessages } from "@/shared/i18n/messages";
import { countUpTween, formatNumeric, parseNumericLabel } from "./count-up";
import styles from "./ai-system-section.module.css";

/**
 * BGN AI 정밀 검사 시스템 — 시안 p1_06 하단 ~ p1_07 상단 / p4_06.
 *
 * ## 디자이너 주석 (docs/plan/07-interactions.md)
 *   헤드라인 2:1106 — "진입시 왼쪽에서 오른쪽 방향으로 텍스트 생성되며 함께 꾸밈요소 배치"
 *   카드    2:1108 — "시간차를 두고 카드들이 배치되며 각 카드에 어울리는 인터렉션 배치"
 *                    (레퍼: https://ambiq.ai/)
 * 기획안(09-brief) — "짧은 시차를 두고 '쫘라라락' 순서대로 떠오르며 배치 /
 *                    투명 → 선명, 살짝 아래에서 위로"
 *
 * ## 왜 `useSectionReveal` 이 아니라 자체 타임라인인가
 * 요구가 "헤드라인 wipe → 꾸밈요소 → 카드 스태거 → **각 카드의 데이터 비주얼**"
 * 이라는 4단 시퀀스다. 카드 비주얼은 그 카드가 안착한 다음에 시작해야
 * '쫘라라락' 이 읽힌다. 공용 훅은 스크롤트리거를 자기 안에 갖고 있어
 * 뒤에 이어 붙일 수가 없다 → 섹션 하나짜리 타임라인으로 순서를 직접 잡는다.
 *
 * ## 왜 글자 단위 stagger 가 아니라 clip-path wipe 인가
 * "왼쪽에서 오른쪽으로 텍스트 생성"의 구현은 두 가지다.
 *   (A) 글자를 `<span>` 으로 쪼개 stagger  (B) clip-path 좌→우 wipe
 * 히어로(`hero-section.tsx`)는 (A)다 — Figma 에서 B/G/N 이 개별 텍스트 노드로
 * 분리돼 있어 글자 단위가 디자인 의도인 게 확실했기 때문이다.
 * 여기 헤드라인은 통짜 한글 문장이다. (A)로 가면
 *   · `word-break: keep-all` 한글 줄바꿈 규칙이 span 경계에서 깨지고
 *   · 노드가 수십 개 늘어 리플로우 비용이 붙고
 *   · 스크린리더가 자모를 하나씩 읽는다(aria 로 덮어야 함)
 * 반면 (B)는 텍스트 노드를 그대로 두고 합성만 바꾼다. "생성되는" 인상도
 * 커서가 지나가듯 드러나는 wipe 쪽이 더 가깝다. → (B) 채택.
 * 끝나면 `clearProps: "clipPath"` 로 지운다(clip-path 가 남으면 containing
 * block 이 생겨 나중에 자식 팝오버가 잘린다).
 *
 * ## 왜 SVG 인가 (R3F 아님)
 * CLAUDE.md 확인 항목 6 "AI 섹션 4개 데이터 비주얼의 3D 여부 — 전부 3D 는
 * 프레임 예산 초과". 4장이 동시에 뷰포트에 들어오므로 캔버스 4개는 불가.
 * 전부 SVG + GSAP 이고, `pathLength="1"` 정규화로 `getTotalLength()` 측정
 * 없이 드로잉한다(레이아웃 읽기 0회 = 스크롤 중 강제 리플로우 없음).
 */
export interface AiSystemSectionProps {
  messages: AiSystemSectionMessages;
}

/**
 * 4번 카드 추천 스코어. 시안 라벨(`SMILE PRO / ICL / LASIK`)에는 수치가 없고
 * 기획 지정값이라 여기에 둔다. 라벨 이름은 i18n 에서 갈라 쓴다.
 */
const RECOMMEND_SCORES = [98, 91, 88] as const;

/** 게이지가 채워지는 비율. 라벨(`ACCURACY 99.2%`)에서 읽어 SSR·모션이 같은 값을 쓴다. */
const GAUGE_FALLBACK = 0.99;

/** 카드 스태거 간격(초). 기획안의 "짧은 시차" — 0.13 이 4장에서 '쫘라라락'으로 읽힌다. */
const CARD_STEP = 0.13;
/** 카드 등장이 시작되는 타임라인 위치 — 헤드라인 wipe 와 살짝 겹친다. */
const CARD_AT = 0.35;
/** 카드가 안착한 뒤 비주얼이 시작되기까지의 지연 */
const VIZ_DELAY = 0.35;

export function AiSystemSection({ messages }: AiSystemSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

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
      const dots = pick<SVGElement>(section, "[data-viz-dot]");
      const bars = pick<SVGElement>(section, "[data-viz-bar]");

      /** `data-draw` 값 = 그려질 길이 비율(pathLength=1 기준). 게이지만 1 미만. */
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
        settleReducedMotion([...wipes, ...decos, ...cards, ...dots, ...bars]);
        // clearProps 가 커버하지 못하는 SVG 프레젠테이션 속성은 직접 확정.
        gsap.set(wipes, { clipPath: "none" });
        gsap.set(draws, { strokeDashoffset: 0 });
        for (const { value, spec } of counters) {
          value.textContent = formatNumeric(spec.value, spec);
        }
        return;
      }

      gsap.set(wipes, { clipPath: "inset(0 100% 0 0)" });
      gsap.set(decos, { autoAlpha: 0, scaleX: 0, transformOrigin: "0% 50%" });
      gsap.set(cards, {
        autoAlpha: 0,
        y: SCROLL_ENTRANCE.y,
        scale: SCROLL_ENTRANCE.scale,
        transformOrigin: "50% 50%",
      });
      gsap.set(draws, { strokeDashoffset: (_i, target: Element) => drawLength(target) });
      gsap.set(dots, { autoAlpha: 0, scale: 0.35, transformOrigin: "50% 50%" });
      gsap.set(bars, { scaleX: 0, transformOrigin: "0% 50%" });
      for (const { value, spec } of counters) {
        value.textContent = formatNumeric(0, spec);
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        // 카드 4장이 다 보이기 전에 터지면 마지막 장이 화면 밖에서 끝난다 → 조금 늦게.
        scrollTrigger: { trigger: section, start: "top 78%", once: true },
      });

      tl.to(
        wipes,
        { clipPath: "inset(0 0% 0 0)", duration: 0.8, stagger: 0.14, clearProps: "clipPath" },
        0,
      ).to(decos, { autoAlpha: 1, scaleX: 1, duration: 0.7, stagger: 0.08 }, 0.2);

      tl.to(
        cards,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          stagger: CARD_STEP,
          clearProps: "opacity,visibility,transform",
        },
        CARD_AT,
      );

      cards.forEach((card, index) => {
        const at = CARD_AT + index * CARD_STEP + VIZ_DELAY;

        const cardDraws = pick<SVGGeometryElement>(card, "[data-draw]");
        if (cardDraws.length > 0) {
          tl.to(
            cardDraws,
            { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: 0.12 },
            at,
          );
        }

        const cardDots = pick<SVGElement>(card, "[data-viz-dot]");
        if (cardDots.length > 0) {
          // 격자 좌상 → 우하로 번지게. 데이터가 채워지는 인상.
          tl.to(
            cardDots,
            { autoAlpha: 1, scale: 1, duration: 0.45, stagger: { each: 0.018, from: "start" } },
            at,
          );
        }

        const cardBars = pick<SVGElement>(card, "[data-viz-bar]");
        if (cardBars.length > 0) {
          tl.to(
            cardBars,
            { scaleX: 1, duration: 0.9, ease: "power2.out", stagger: 0.1 },
            at + 0.05,
          );
        }

        const counter = counters.find((entry) => entry.card === card);
        if (counter) tl.add(countUpTween(counter.value, counter.spec), at);

        const scan = card.querySelector<SVGElement>("[data-viz-scan]");
        if (scan) {
          // 무한 반복 트윈을 타임라인에 직접 넣으면 타임라인 duration 이 무한이 된다.
          // 별도 트윈을 만들어 두고 제 순서에 재생만 시킨다.
          const scanLoop = gsap.to(scan, {
            y: 52,
            duration: 1.9,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            paused: true,
          });
          tl.call(
            () => {
              scanLoop.play();
            },
            undefined,
            at,
          );
        }
      });
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
          {messages.title}
        </h2>
        {messages.description ? (
          <p className={clsx("section-desc", styles.wipeLine)} data-wipe>
            {messages.description}
          </p>
        ) : null}

        {/* 주석의 "함께 꾸밈요소 배치" — 헤드라인과 같은 방향(좌→우)으로 자라는
            그라데이션 룰 + 눈금. 텍스트 wipe 와 방향이 같아야 한 동작으로 읽힌다. */}
        <div className={styles.deco} aria-hidden>
          <span className={styles.decoRule} data-deco />
          <span className={styles.decoTicks}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={styles.decoTick} data-deco />
            ))}
          </span>
        </div>
      </header>

      <ol className={styles.grid} data-lenis-prevent>
        {messages.steps.map((step, index) => (
          <li key={step.step} className={styles.card} data-ai-card>
            <p className={styles.step} lang="en">
              {step.step}.
            </p>
            <h3 className={styles.cardTitle}>{step.title}</h3>
            {step.description ? <p className={styles.cardDesc}>{step.description}</p> : null}

            <div className={styles.visual}>
              <StepVisual index={index} step={step} />
            </div>

            {step.dataLabel ? <DataLabel label={step.dataLabel} /> : null}
          </li>
        ))}
      </ol>

      {/* 섹션 전환 디바이더 — 히어로와 같은 시그니처 마퀴 */}
      <Marquee text={messages.marquee} className={styles.marquee} outline duration={30} />
    </section>
  );
}

/**
 * 데이터 라벨. 숫자 토큰이 있으면 그 자리만 카운트업 대상으로 분리한다.
 *
 * SSR/JS 실패 시에도 최종 수치가 보이도록 **완성값으로 렌더**하고,
 * 애니메이션 시작 직전에 GSAP 이 0 으로 눌렀다가 올린다.
 */
function DataLabel({ label }: { label: string }) {
  const spec = parseNumericLabel(label);
  if (!spec) {
    return (
      <p className={styles.dataLabel} lang="en">
        {label}
      </p>
    );
  }
  return (
    <p className={styles.dataLabel} lang="en" data-count-label={label}>
      {spec.before}
      <span className={styles.dataValue} data-count-value>
        {formatNumeric(spec.value, spec)}
      </span>
      {spec.after}
    </p>
  );
}

/** 카드별 데이터 비주얼 — 주석의 "각 카드에 어울리는 인터렉션". */
function StepVisual({ index, step }: { index: number; step: AiStepMessages }) {
  switch (index) {
    case 0:
      return <ScanVisual />;
    case 1:
      return <MatrixVisual />;
    case 2:
      return <GaugeVisual ratio={ratioFromLabel(step.dataLabel)} />;
    default:
      return <BarsVisual names={splitNames(step.dataLabel)} />;
  }
}

/** `ACCURACY 99.2%` → 0.992. 라벨이 바뀌면 게이지도 따라간다. */
function ratioFromLabel(label: string | undefined) {
  const spec = label ? parseNumericLabel(label) : null;
  if (!spec) return GAUGE_FALLBACK;
  return Math.min(1, Math.max(0, spec.value / 100));
}

/** `SMILE PRO / ICL / LASIK` → 3개 항목명 */
function splitNames(label: string | undefined) {
  if (!label) return [];
  return label
    .split("/")
    .map((name) => name.trim())
    .filter(Boolean);
}

/* ── 1. 데이터 수집 — OPTICAL MAPPING ────────────────────────────────────
   동심원(홍채/각막 맵)이 안에서 밖으로 그려지고, 스캔 라인이 위아래로 훑는다. */
function ScanVisual() {
  return (
    <svg className={styles.viz} viewBox="0 0 200 200" aria-hidden focusable="false">
      <g className={styles.vizGrid}>
        {[36, 68, 100, 132, 164].map((v) => (
          <line key={`h${v}`} x1="18" y1={v} x2="182" y2={v} />
        ))}
        {[36, 68, 100, 132, 164].map((v) => (
          <line key={`v${v}`} x1={v} y1="18" x2={v} y2="182" />
        ))}
      </g>
      {[70, 46, 24].map((r) => (
        <circle
          key={r}
          className={styles.vizRing}
          cx="100"
          cy="100"
          r={r}
          pathLength={1}
          strokeDasharray="1 1"
          data-draw="1"
        />
      ))}
      <circle className={styles.vizCore} cx="100" cy="100" r="7" />
      {/* 스캔 라인 — 그룹째 y 이동시킨다(개별 요소 좌표를 건드리지 않음) */}
      <g data-viz-scan>
        <rect className={styles.vizScanGlow} x="18" y="88" width="164" height="24" rx="12" />
        <line className={styles.vizScanLine} x1="18" y1="100" x2="182" y2="100" />
      </g>
    </svg>
  );
}

/* ── 2. AI 빅데이터 분석 — 760,000+ CLINICAL CASES ───────────────────────
   임상 케이스 격자가 좌상→우하로 번지며 채워진다. 숫자는 라벨에서 카운트업. */
const MATRIX_CELLS = Array.from({ length: 36 }, (_, i) => ({
  key: i,
  cx: 24 + (i % 6) * 30.4,
  cy: 24 + Math.floor(i / 6) * 30.4,
  // Math.random() 금지(React Compiler·리뷰 재현성). 인덱스 기반 결정적 변주.
  r: (i * 7) % 5 > 2 ? 6.5 : 4,
  strong: (i * 5) % 7 === 0,
}));

function MatrixVisual() {
  return (
    <svg className={styles.viz} viewBox="0 0 200 200" aria-hidden focusable="false">
      {MATRIX_CELLS.map((cell) => (
        <circle
          key={cell.key}
          className={cell.strong ? styles.vizDotStrong : styles.vizDot}
          cx={cell.cx}
          cy={cell.cy}
          r={cell.r}
          data-viz-dot
        />
      ))}
    </svg>
  );
}

/* ── 3. AI 시뮬레이션 — ACCURACY 99.2% ───────────────────────────────────
   반원 게이지가 99.2% 까지 차오르고, 아래 라인 차트가 좌→우로 그려진다. */
const GAUGE_ARC = "M 24 150 A 76 76 0 0 1 176 150";
const TREND_LINE = "M 16 190 L 52 178 L 88 183 L 124 164 L 160 170 L 190 148";

function GaugeVisual({ ratio }: { ratio: number }) {
  return (
    <svg className={styles.viz} viewBox="0 0 200 200" aria-hidden focusable="false">
      <path className={styles.vizGaugeTrack} d={GAUGE_ARC} />
      {/*
        pathLength=1 로 정규화하면 dasharray 를 비율로 쓸 수 있다.
        `${ratio} 1` → 길이 ratio 짜리 대시 하나 + 나머지 여백.
        dashoffset ratio → 0 이면 시작점부터 ratio 만큼 그려진다.
      */}
      <path
        className={styles.vizGaugeValue}
        d={GAUGE_ARC}
        pathLength={1}
        strokeDasharray={`${ratio} 1`}
        data-draw={ratio}
      />
      {/* 눈금 — 게이지 양 끝 기준점 */}
      <circle className={styles.vizCore} cx="24" cy="150" r="4" />
      <circle className={styles.vizCore} cx="176" cy="150" r="4" />
      <path
        className={styles.vizTrend}
        d={TREND_LINE}
        pathLength={1}
        strokeDasharray="1 1"
        data-draw="1"
      />
    </svg>
  );
}

/* ── 4. 맞춤형 제안 — SMILE PRO / ICL / LASIK ────────────────────────────
   추천 적합도 바가 좌→우로 채워진다. */
const BAR_TRACK_X = 4;
const BAR_TRACK_W = 160;

function BarsVisual({ names }: { names: string[] }) {
  const rows = names.length > 0 ? names : ["-", "-", "-"];
  return (
    <svg className={styles.viz} viewBox="0 0 200 200" aria-hidden focusable="false">
      {rows.map((name, i) => {
        const score = RECOMMEND_SCORES[i] ?? 0;
        const y = 42 + i * 56;
        return (
          <g key={name}>
            <text className={styles.vizBarName} x={BAR_TRACK_X} y={y - 10}>
              {name}
            </text>
            <text className={styles.vizBarScore} x={196} y={y - 10} textAnchor="end">
              {score}%
            </text>
            <rect
              className={styles.vizBarTrack}
              x={BAR_TRACK_X}
              y={y}
              width={BAR_TRACK_W + 32}
              height="12"
              rx="6"
            />
            {/* 최종 폭을 속성으로 확정하고 scaleX 0→1 로만 채운다.
                → reduced-motion 최종 상태가 곧 'transform 없음' 이라 clearProps 로 정리된다. */}
            <rect
              className={styles.vizBarValue}
              x={BAR_TRACK_X}
              y={y}
              width={((BAR_TRACK_W + 32) * score) / 100}
              height="12"
              rx="6"
              data-viz-bar
            />
          </g>
        );
      })}
    </svg>
  );
}
