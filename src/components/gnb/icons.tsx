"use client";

import { useId } from "react";

import type { Locale } from "@/shared/config/i18n";
import type { GnbSnsId } from "./gnb-nav";

/**
 * GNB 전용 인라인 아이콘.
 *
 * ⚠️ 이모지 금지. 국기·SNS 는 전부 벡터로 직접 그린다.
 *    (안내받은 `_figma/svg/` 추출본은 이 저장소에 존재하지 않는다 — 보고서 참고.)
 *
 * 인라인으로 두는 이유: 국기 4개 + SNS 4개를 `<img>` 로 빼면 드롭다운을 여는
 * 순간 8개의 네트워크 요청이 발생해서 첫 프레임에 아이콘이 비어 보인다.
 * 전부 합쳐도 2KB 미만이라 번들에 넣는 쪽이 싸다.
 */

/** 5각별 — 중심 (0,0), 외접원 r=1. 중국 국기용. */
const STAR_POINTS =
  "0,-1 0.2245,-0.309 0.951,-0.309 0.363,0.118 0.588,0.809 0,0.382 -0.588,0.809 -0.363,0.118 -0.951,-0.309 -0.2245,-0.309";

/** 시안 `8:283` 헤더 우측 — 원 + 위도 2줄 + 경도 타원, stroke 1.6 */
export function GlobeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.8 9.2h18.4M2.8 14.8h18.4" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="4.4" ry="9.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** 시안 햄버거는 3줄 / 폭 26 / 간격 8 */
export function BurgerIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} fill="none" aria-hidden focusable="false">
      <path
        d="M2 6h22M2 13h22M2 20h22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} fill="none" aria-hidden focusable="false">
      <path
        d="M4.5 4.5l17 17M21.5 4.5l-17 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── 국기 ────────────────────────────────────────────────────────────────
   시안 `8:367` 언어 드롭다운은 라벨 앞에 원형 국기가 붙는다.
   원형으로 자르면 4개국 모두 같은 실루엣이 되어 리스트가 정렬돼 보인다. */

function KrFlag() {
  return (
    <>
      <circle cx="12" cy="12" r="12" fill="#fff" />
      {/* 태극 — 위 적색 / 아래 청색. 4괘는 24px 에서 뭉개져 생략했다. */}
      <path d="M4 12a8 8 0 0 1 16 0 4 4 0 0 1-8 0 4 4 0 0 0-8 0Z" fill="#cd2e3a" />
      <path d="M4 12a4 4 0 0 1 8 0 4 4 0 0 0 8 0 8 8 0 0 1-16 0Z" fill="#0047a0" />
    </>
  );
}

function UsFlag() {
  return (
    <>
      <rect width="24" height="24" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * 1.846} width="24" height="1.846" fill="#b22234" />
      ))}
      <rect width="11" height="9.23" fill="#3c3b6e" />
      {[
        [2.2, 2],
        [5.5, 2],
        [8.8, 2],
        [3.85, 4.6],
        [7.15, 4.6],
        [2.2, 7.2],
        [5.5, 7.2],
        [8.8, 7.2],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.85" fill="#fff" />
      ))}
    </>
  );
}

function JpFlag() {
  return (
    <>
      <rect width="24" height="24" fill="#fff" />
      <circle cx="12" cy="12" r="7" fill="#bc002d" />
    </>
  );
}

function CnFlag() {
  return (
    <>
      <rect width="24" height="24" fill="#de2910" />
      <polygon points={STAR_POINTS} fill="#ffde00" transform="translate(6.4 7.6) scale(3.4)" />
      {[
        [12.6, 3.6],
        [15, 6.2],
        [15, 9.6],
        [12.6, 12],
      ].map(([x, y]) => (
        <polygon
          key={`${x}-${y}`}
          points={STAR_POINTS}
          fill="#ffde00"
          transform={`translate(${x} ${y}) scale(1.25)`}
        />
      ))}
    </>
  );
}

const FLAG_SHAPES: Record<Locale, () => React.JSX.Element> = {
  ko: KrFlag,
  en: UsFlag,
  ja: JpFlag,
  zh: CnFlag,
};

export function FlagIcon({ locale, size = 22 }: { locale: Locale; size?: number }) {
  const Shape = FLAG_SHAPES[locale];
  /**
   * ⚠️ clipPath id 는 반드시 인스턴스마다 달라야 한다.
   * GNB 헤더와 메가메뉴가 각각 언어 드롭다운을 하나씩 그리는데, id 가 같으면
   * 뒤 인스턴스가 앞(숨겨진) 인스턴스의 clipPath 를 참조해 국기가 통째로 사라진다.
   */
  // React 19 의 useId 는 «r0» 처럼 URL 프래그먼트에 못 쓰는 문자를 포함한다 → 영숫자만 남긴다
  const clipId = `gnb-flag-${locale}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable="false">
      <clipPath id={clipId}>
        <circle cx="12" cy="12" r="12" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <Shape />
      </g>
      {/* 백색 바탕(일본·한국) 국기가 흰 카드 위에서 사라지지 않도록 얇은 테두리 */}
      <circle cx="12" cy="12" r="11.4" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" />
    </svg>
  );
}

/* ── SNS ─────────────────────────────────────────────────────────────────
   시안 `8:540` 좌측 패널 하단: 브랜드 컬러 원형 배지 4개. */

function YoutubeGlyph() {
  return (
    <>
      <circle cx="20" cy="20" r="20" fill="#ff0000" />
      <path d="M16.6 14.6 27 20l-10.4 5.4Z" fill="#fff" />
    </>
  );
}

function InstagramGlyph() {
  const gradientId = `gnb-ig-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <defs>
        <radialGradient id={gradientId} cx="30%" cy="105%" r="130%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="25%" stopColor="#fd5949" />
          <stop offset="55%" stopColor="#d6249f" />
          <stop offset="100%" stopColor="#285aeb" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gradientId})`} />
      <rect
        x="11.5"
        y="11.5"
        width="17"
        height="17"
        rx="5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
      <circle cx="20" cy="20" r="4.4" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="25.4" cy="14.6" r="1.4" fill="#fff" />
    </>
  );
}

function KakaoGlyph() {
  return (
    <>
      <circle cx="20" cy="20" r="20" fill="#fae100" />
      {/* 말풍선 — 카카오 심볼 실루엣 */}
      <path
        d="M20 11c-5.5 0-10 3.4-10 7.6 0 2.7 1.9 5 4.7 6.3l-1 3.7c-.1.4.3.7.6.5l4.4-2.9c.4 0 .8.1 1.3.1 5.5 0 10-3.4 10-7.7S25.5 11 20 11Z"
        fill="#3c1e1e"
      />
    </>
  );
}

function FacebookGlyph() {
  return (
    <>
      <circle cx="20" cy="20" r="20" fill="#1877f2" />
      <path
        d="M22.6 31V21.5h3.2l.5-3.7h-3.7v-2.4c0-1.1.3-1.8 1.8-1.8h2V10.1c-.3 0-1.5-.1-2.9-.1-2.9 0-4.8 1.7-4.8 4.9v2.9h-3.2v3.7h3.2V31Z"
        fill="#fff"
      />
    </>
  );
}

const SNS_GLYPHS: Record<GnbSnsId, () => React.JSX.Element> = {
  youtube: YoutubeGlyph,
  instagram: InstagramGlyph,
  kakao: KakaoGlyph,
  facebook: FacebookGlyph,
};

export function SnsIcon({ id, size = 40 }: { id: GnbSnsId; size?: number }) {
  const Glyph = SNS_GLYPHS[id];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden focusable="false">
      <Glyph />
    </svg>
  );
}
