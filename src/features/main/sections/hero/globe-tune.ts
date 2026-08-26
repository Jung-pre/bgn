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
  /** 유리 반사. 크고 작은 하이라이트 여러 개의 세기. */
  bodySpec: number;
  /** 반사 이동 속도 배수. 1 ≈ 큰 빛 18초 주기. */
  bodySpecSpeed: number;
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

  /* --- 축소 배율·라인 페이드 ----------------------------------------------
   * 파티클 은하수(구체→밴드)는 쓰지 않는다. gxShrink 만 확대 후 축소량이고,
   * gxCross* 는 축소된 구체가 빠진 뒤 2번 섹션 실크 라인이 들어오는 구간이다.
   */
  gxTiltDeg: number;
  /** 깊이 회전. 0 이면 완전한 평면이라 벽에 붙은 그림이 된다 */
  gxYawDeg: number;
  /** 가로 위치 */
  gxX: number;
  /** 세로 위치 */
  gxY: number;
  /** 좌우 길이. 화면 밖까지 나가려면 5 이상 */
  gxLength: number;
  /** 밴드 두께 */
  gxThick: number;
  /** 파형 진폭 */
  gxAmp: number;
  /** 밴드 사이 세로 간격 */
  gxGap: number;
  /** 밴드 개수 1~3 */
  gxBands: number;
  /** 은하수일 때 배율(축소량). 클수록 작아진다 */
  gxShrink: number;
  /** 형성 구간 — 전환 진행도 t(0~1) */
  gxStart: number;
  gxEnd: number;
  /** 은하수 → 라인 크로스페이드 구간 */
  gxCrossStart: number;
  gxCrossEnd: number;
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
  /* 이전 가산 도트 스택 기준값 — "흰색에 빛나는" 그 밀도 */
  intensity: 0.82,
  haze: 0.32,
  cover: 1,

  /* 3차 피드백 "뒤가 안 보여야" — 심 알파 1.0, 잔여 투과 0 */
  bodyFill: 1,
  bodyRim: 0.125,
  bodySpec: 0.5,
  bodySpecSpeed: 1,
  bodyCau: 0.02,
  bodyPearl: 0,
  /* 판 반경 1.02R 기준 0.98 = 파티클 구 실루엣(1.0R). 페이드가 전부
     실루엣 **밖**에서 일어나 공 안쪽 투과가 0 이 된다. */
  bodyEdge: 0.98,

  haloOpacity: 1,
  shellOpacity: 0.52,
  landOpacity: 0.43,
  haloSize: 0.044,
  shellSize: 0.029,
  landSize: 0.037,
  haloPush: 1.2,
  shellPush: 1,
  landPush: 0.85,

  /* 수정요청(3차) "호버 안 해도 천천히 지구가 돌도록"(시작은 한국 정면).
     0.025 rad/s ≈ 4분에 한 바퀴 — 눈에 띄되 어지럽지 않은 속도. */
  spinRate: 0.025,
  introYaw: 0,
  scrollYaw: 0.35,
  pointerYaw: 0.3,
  pointerPitch: 0.16,
  pitchX: 0.655,
  yawTrimDeg: 0,

  pushRadius: 0.5,
  pushMax: 0.06,

  fadeStart: 0.16,
  fadeEnd: 0.78,

  gxTiltDeg: 15,
  gxYawDeg: 15,
  gxX: 0.08,
  gxY: -1.2,
  gxLength: 5.4,
  gxThick: 1.45,
  gxAmp: 0.62,
  gxGap: 0.14,
  gxBands: 3,
  /** 끝까지 되돌리지 않는다. 4.45 → 약 2.4 에서 멈춘 뒤 페이드. */
  gxShrink: 2.05,
  gxStart: 0.29,
  gxEnd: 0.64,
  /** 타워가 자리 잡은 직후 — 더 줄어들기 전에 파티클을 걷는다 */
  gxCrossStart: 0.66,
  gxCrossEnd: 0.84,
};

let current: GlobeTune = { ...GLOBE_TUNE_DEFAULTS };
const listeners = new Set<() => void>();
let appliedGen = 0;
const TUNE_GEN = 6;

export function getGlobeTune(): GlobeTune {
  if (appliedGen !== TUNE_GEN) {
    appliedGen = TUNE_GEN;
    current = { ...GLOBE_TUNE_DEFAULTS };
  }
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
