/**
 * 브레이크포인트 단일 소스.
 *
 * 값의 근거는 시안(docs/design/2026_BGN 잠실.pdf) 실측:
 *   · PC   기준폭 1920, 콘텐츠 1640 (좌우 여백 140)
 *   · 모바일 기준폭 375, 콘텐츠 335 (거터 20)
 *   · 태블릿 시안은 **없다** → 1024~1439 구간은 PC 레이아웃의 유동 축소로 처리
 *
 * shin 프로젝트에서 `1023 / 1024 / 1025 / 1026` 이 JS·CSS 에 흩어져
 * off-by-one 버그가 났던 걸 막기 위해 여기서만 정의한다.
 * `globals.css` 의 미디어쿼리도 이 값과 일치시킬 것.
 */
export const BREAKPOINT = {
  /** 소형폰 — 거터 20→16 축소 */
  sm: 480,
  /** ★ 주 레이아웃 분기점. 이 이하에서 모바일 시안(375)을 채택한다 */
  md: 768,
  /** 인라인 GNB 유지 한계. 이 이하에서 rem 스케일링 해제 */
  lg: 1024,
  /** 콘텐츠 여백 축소 시작 */
  xl: 1440,
  /** 시안 원본 폭 — 이 이상에서는 콘텐츠 1640 고정 */
  xxl: 1920,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINT;

/** `(max-width: 768px)` — 이 값 "이하" */
export const mqDown = (key: BreakpointKey) => `(max-width: ${BREAKPOINT[key]}px)`;
/** `(min-width: 769px)` — mqDown 과 정확히 상보. 경계가 겹치지 않는다. */
export const mqUp = (key: BreakpointKey) => `(min-width: ${BREAKPOINT[key] + 1}px)`;

export const MQ = {
  /**
   * ★ 768 이하 = 모바일 레이아웃.
   * 이 경계에서 한꺼번에 전환되는 것들:
   *   ① 인라인 GNB → 햄버거 전용
   *   ② 하단 고정 퀵바 노출 (PC 는 우하단 팬아웃 FAB)
   *   ③ 진료센터 hover 아코디언 → 센터모드 스와이퍼
   *   ④ 히스토리 좌우분할 → 세로 스택
   */
  mobile: mqDown("md"),
  desktop: mqUp("md"),

  /** rem 스케일링이 해제되는 지점 */
  remFixed: mqDown("lg"),

  /** 소형폰 — 거터 축소 */
  phoneSmall: mqDown("sm"),

  /**
   * ★ hover 의존 컴포넌트(진료센터 아코디언, GNB 드롭다운)의 진짜 가드.
   * 폭이 아니라 입력 장치로 나눠야 정확하다 — 1100px 터치 노트북이 있다.
   */
  hoverable: "(hover: hover) and (pointer: fine)",
  coarsePointer: "(pointer: coarse)",

  reduceMotion: "(prefers-reduced-motion: reduce)",
} as const;
