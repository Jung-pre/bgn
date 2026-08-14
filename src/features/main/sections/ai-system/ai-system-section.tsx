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
 * BGN AI 정밀 검사 시스템 — Figma `2:1088` (1920 × 1007).
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
 * ## 왜 SVG 인가 (R3F 아님)
 * CLAUDE.md 확인 항목 6 "AI 섹션 데이터 비주얼의 3D 여부 — 전부 3D 는 프레임 예산
 * 초과". 4장이 동시에 뷰포트에 들어오므로 캔버스 4개는 불가. 전부 SVG + GSAP 이고,
 * `pathLength="1"` 정규화로 `getTotalLength()` 측정 없이 드로잉한다
 * (레이아웃 읽기 0회 = 스크롤 중 강제 리플로우 없음).
 *
 * ## 왜 이미지가 아니라 추상 도형인가
 * 시안 카드에는 474~508px PNG(홍채 / 큐브 / 안구 와이어프레임)가 들어간다.
 * 저장소 `public/` 이 비어 있어 **에셋을 받을 수 없다**. 같은 자리·같은 크기의
 * SVG 로 대체해 두었으니, PNG 가 오면 `StepArt` 를 <Image /> 로 갈아끼우면 된다.
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
        settleReducedMotion([...wipes, ...decos, ...cards, ...dots, ...badges, ...rows]);
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
      gsap.set(dots, { autoAlpha: 0, scale: 0.35, transformOrigin: "50% 50%" });
      gsap.set(badges, { autoAlpha: 0, y: 10, scale: 0.94, transformOrigin: "50% 50%" });
      gsap.set(rows, { autoAlpha: 0, x: -8 });
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
      )
        // 주석 "함께 꾸밈요소 배치" — 마커 박스도 헤드라인과 같은 좌→우로 열린다.
        // scaleX 로 키우면 안에 든 글자까지 눌려 보이므로 wipe 로 연다.
        .to(decos, { clipPath: "inset(0 0% 0 0)", duration: 0.7, clearProps: "clipPath" }, 0.25);

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
            { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: 0.08 },
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

        const cardRows = pick<HTMLElement>(card, "[data-row]");
        if (cardRows.length > 0) {
          tl.to(
            cardRows,
            { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.08, clearProps: "opacity,transform" },
            at + 0.15,
          );
        }

        const cardBadges = pick<HTMLElement>(card, "[data-badge]");
        if (cardBadges.length > 0) {
          tl.to(
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
        if (counter) tl.add(countUpTween(counter.value, counter.spec), at + 0.2);

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
          {renderWithMark(messages.title, messages.titleMarker)}
        </h2>
        {messages.description ? (
          <p className={clsx("section-desc", styles.wipeLine)} data-wipe>
            {messages.description}
          </p>
        ) : null}
      </header>

      {/* 모바일(≤768)에서만 실제 가로 스크롤 컨테이너가 된다 — Lenis 가 터치를
          가로채면 스와이프가 죽으므로 그때를 위해 붙여 둔다. */}
      <ol className={styles.grid} data-lenis-prevent>
        {messages.steps.map((step, index) => (
          <li key={step.step} className={styles.card} data-ai-card>
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

      {/* 섹션 전환 디바이더 — 히어로와 같은 시그니처 마퀴. 카드 뒤로 흐른다. */}
      <Marquee text={messages.marquee} className={styles.marquee} outline duration={30} />
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
      <span className={styles.titleMark} data-deco>
        {marker}
      </span>
      {rest.join(marker)}
    </>
  );
}

/* ── 카드 배경 오브젝트 ──────────────────────────────────────────────────── */

function StepArt({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <IrisArt />;
    case 1:
      return <CubeArt />;
    case 2:
      return <EyeArt />;
    default:
      // 4번 카드는 시안에도 이미지가 없다 (2:1151 — 패널 + 레이더뿐).
      return null;
  }
}

/** 1. 데이터 수집 — 각막 토포그래피(동심원 + 방사 눈금) + 스캔 라인 */
const IRIS_RINGS = [24, 38, 52, 66, 80, 94];
const IRIS_SPOKES = Array.from({ length: 24 }, (_, i) => {
  const rad = (i / 24) * Math.PI * 2;
  return {
    key: i,
    x1: 100 + Math.cos(rad) * 34,
    y1: 100 + Math.sin(rad) * 34,
    x2: 100 + Math.cos(rad) * 92,
    y2: 100 + Math.sin(rad) * 92,
  };
});

function IrisArt() {
  return (
    <div className={clsx(styles.artFigure, styles.artIris)}>
      <span className={styles.glow} />
      <svg className={styles.artSvg} viewBox="0 0 200 200" aria-hidden focusable="false">
        {IRIS_SPOKES.map((s) => (
          <line
            className={styles.vizLineSoft}
            key={s.key}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
          />
        ))}
        {IRIS_RINGS.map((r) => (
          <circle
            key={r}
            className={styles.vizLine}
            cx="100"
            cy="100"
            r={r}
            pathLength={1}
            strokeDasharray="1 1"
            data-draw="1"
          />
        ))}
        <circle className={styles.vizCore} cx="100" cy="100" r="16" />
        {/* 스캔 라인 — 그룹째 y 이동시킨다(개별 요소 좌표를 건드리지 않음) */}
        <g data-viz-scan>
          <rect className={styles.vizScanGlow} x="8" y="74" width="184" height="20" rx="10" />
          <line className={styles.vizScanLine} x1="8" y1="84" x2="192" y2="84" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 2. AI 빅데이터 분석 — 아이소메트릭 큐브 격자.
 * `Math.random()` 금지(React Compiler·리뷰 재현성) → 전부 인덱스 기반 결정값.
 */
const CUBE_TOP = "100,26 178,65 100,104 22,65";
const CUBE_LEFT = "22,65 100,104 100,179 22,140";
const CUBE_RIGHT = "178,65 100,104 100,179 178,140";

/** 세 면 위에 균등 배치되는 격자 점 — 면마다 3×3 */
const CUBE_DOTS = (() => {
  const faces = [
    // [원점, u 벡터, v 벡터]
    [
      [100, 26],
      [78, 39],
      [-78, 39],
    ],
    [
      [22, 65],
      [78, 39],
      [0, 75],
    ],
    [
      [178, 65],
      [-78, 39],
      [0, 75],
    ],
  ] as const;
  const out: { key: string; cx: number; cy: number; r: number }[] = [];
  faces.forEach(([origin, u, v], f) => {
    for (let i = 1; i <= 3; i += 1) {
      for (let j = 1; j <= 3; j += 1) {
        out.push({
          key: `${f}-${i}-${j}`,
          cx: origin[0] + (u[0] * i) / 4 + (v[0] * j) / 4,
          cy: origin[1] + (u[1] * i) / 4 + (v[1] * j) / 4,
          r: (i + j) % 3 === 0 ? 2.6 : 1.8,
        });
      }
    }
  });
  return out;
})();

/** 큐브 주변에 흩어진 작은 조각 — 시안의 부유하는 미니 큐브 */
const CUBE_CHIPS = [
  { key: "a", x: 4, y: 30, s: 10 },
  { key: "b", x: 184, y: 24, s: 8 },
  { key: "c", x: 186, y: 158, s: 10 },
  { key: "d", x: 6, y: 162, s: 9 },
  { key: "e", x: 96, y: 2, s: 6 },
];

function CubeArt() {
  return (
    <div className={clsx(styles.artFigure, styles.artCube)}>
      <span className={styles.glow} />
      <svg className={styles.artSvg} viewBox="0 0 200 200" aria-hidden focusable="false">
        {CUBE_CHIPS.map((c) => (
          <rect
            className={styles.vizLineSoft}
            key={c.key}
            x={c.x}
            y={c.y}
            width={c.s}
            height={c.s}
            rx="1.5"
          />
        ))}
        <polygon className={styles.vizFace} points={CUBE_TOP} />
        <polygon className={styles.vizLine} points={CUBE_LEFT} />
        <polygon className={styles.vizLine} points={CUBE_RIGHT} />
        {CUBE_DOTS.map((d) => (
          <circle
            className={d.r > 2 ? styles.vizDotStrong : styles.vizDot}
            key={d.key}
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            data-viz-dot
          />
        ))}
      </svg>
    </div>
  );
}

/** 3. AI 시뮬레이션 — 와이어프레임 안구 + 홍채 + 광선 */
const EYE_R = 74;
/** 경선(세로) — rx 는 sin(t) 로 줄인다 */
const EYE_MERIDIANS = [30, 60, 90, 120, 150].map((deg) => ({
  key: deg,
  rx: Math.round(EYE_R * Math.sin((deg * Math.PI) / 180) * 10) / 10,
}));
/** 위선(가로) — y 오프셋마다 반지름이 줄고, 원근으로 납작해진다 */
const EYE_PARALLELS = [-50, -25, 0, 25, 50].map((dy) => {
  const rx = Math.round(Math.sqrt(EYE_R * EYE_R - dy * dy) * 10) / 10;
  return { key: dy, cy: 100 + dy, rx, ry: Math.round(rx * 0.26 * 10) / 10 };
});

function EyeArt() {
  return (
    <div className={clsx(styles.artFigure, styles.artSphere)}>
      <span className={styles.glow} />
      <svg className={styles.artSvg} viewBox="0 0 200 200" aria-hidden focusable="false">
        <circle
          className={styles.vizLine}
          cx="100"
          cy="100"
          r={EYE_R}
          pathLength={1}
          strokeDasharray="1 1"
          data-draw="1"
        />
        {EYE_MERIDIANS.map((m) => (
          <ellipse
            className={styles.vizLineSoft}
            key={m.key}
            cx="100"
            cy="100"
            rx={m.rx}
            ry={EYE_R}
          />
        ))}
        {EYE_PARALLELS.map((p) => (
          <ellipse
            className={styles.vizLineSoft}
            key={p.key}
            cx="100"
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
          />
        ))}
        {/* 홍채 — 시안에서 구체 좌측에 붙어 있고 광선이 들어온다 */}
        <ellipse className={styles.vizFace} cx="62" cy="100" rx="17" ry="26" />
        <circle className={styles.vizCore} cx="62" cy="100" r="8" />
        <line className={styles.vizScanLine} x1="6" y1="100" x2="62" y2="100" />
      </svg>
    </div>
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
