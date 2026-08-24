/**
 * 히어로 파티클 지구 — 라이브 튜닝 스토어.
 *
 * 패널이 값을 바꾸고, 히어로 `useFrame` 이 매 프레임 `getGlobeTune()` 으로 읽는다.
 * 캔버스를 state 로 리렌더하지 않으려고 모듈 스토어다.
 *
 * 클로징·푸터 구체는 `interactive={false}` 라 이 값을 읽지 않는다.
 *
 * 기본값은 전부 `scene-sphere.tsx` / `hero-section.tsx` 에 박혀 있던 실측이다.
 * 패널 리셋이 여기로 돌아온다.
 */

export type GlobeTune = {
  /* --- 레이어 on/off ------------------------------------------------------- */
  showBody: boolean;
  showHaze: boolean;
  showHalo: boolean;
  showShell: boolean;
  showLand: boolean;
  showCore: boolean;

  /* --- 전체 ---------------------------------------------------------------- */
  /** fitScale 배수. 화면 높이 대비 구체 크기. */
  size: number;
  /** 파티클 알파 배수. 히어로는 1, 클로징은 prop 0.12. */
  intensity: number;
  /** 헤이즈(가산 산란광) 밝기. 히어로 prop 과 같음. */
  haze: number;
  /** 바디 평판 불투명도. 마퀴 가림. */
  cover: number;

  /* --- 바디 평판 (점 사이 바닥, NormalBlending) ----------------------------- */
  /** 실루엣 알파. 셰이더 `fill * uFill`. */
  bodyFill: number;
  /** 림 라이트 가산. `col += rim * uRim`. */
  bodyRim: number;
  /** 내부 코스틱. `col += cau * uCau`. */
  bodyCau: number;
  /** 두께 진주 산란. `mix(PEARL, thick^2 * uPearl)`. */
  bodyPearl: number;
  /** 가장자리 페이드 시작 반경. `smoothstep(1, uEdge, r)`. */
  bodyEdge: number;

  /* --- 파티클 3장 (가산) --------------------------------------------------- */
  haloOpacity: number;
  shellOpacity: number;
  landOpacity: number;
  haloSize: number;
  shellSize: number;
  landSize: number;
  /** 레이어별 커서 반발 배수. */
  haloPush: number;
  shellPush: number;
  landPush: number;

  /* --- 모션 ---------------------------------------------------------------- */
  /** 히어로 자전. 코드상 기본 0 — 클로징만 0.07 고정. */
  spinRate: number;
  introYaw: number;
  scrollYaw: number;
  pointerYaw: number;
  pointerPitch: number;
  pitchX: number;
  yawTrimDeg: number;

  /* --- 커서 반발 (NDC) ----------------------------------------------------- */
  pushRadius: number;
  pushMax: number;

  /* --- 타워 크로스페이드 (`hero-section` onProgress) ----------------------- */
  fadeStart: number;
  fadeEnd: number;
};

/** 패널에서 확정한 히어로 실측값. */
export const GLOBE_TUNE_DEFAULTS: GlobeTune = {
  showBody: true,
  showHaze: false,
  showHalo: false,
  showShell: true,
  showLand: true,
  showCore: false,

  size: 0.86,
  intensity: 0.73,
  haze: 0.32,
  cover: 1,

  bodyFill: 0.985,
  bodyRim: 0.17,
  bodyCau: 0.02,
  bodyPearl: 0,
  bodyEdge: 0.94,

  haloOpacity: 1,
  shellOpacity: 0.37,
  landOpacity: 0.23,
  haloSize: 0.044,
  shellSize: 0.032,
  landSize: 0.036,
  haloPush: 1.2,
  shellPush: 1,
  landPush: 0.85,

  spinRate: 0,
  introYaw: 0.12,
  scrollYaw: 0.35,
  pointerYaw: 0.3,
  pointerPitch: 0.16,
  pitchX: 0.55,
  yawTrimDeg: -8,

  pushRadius: 0.5,
  pushMax: 0.06,

  fadeStart: 0.16,
  fadeEnd: 0.78,
};

let current: GlobeTune = { ...GLOBE_TUNE_DEFAULTS };
const listeners = new Set<() => void>();

export function getGlobeTune(): GlobeTune {
  return current;
}

export function setGlobeTune(patch: Partial<GlobeTune>) {
  current = { ...current, ...patch };
  for (const fn of listeners) fn();
}

export function resetGlobeTune() {
  current = { ...GLOBE_TUNE_DEFAULTS };
  for (const fn of listeners) fn();
}

export function subscribeGlobeTune(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}
