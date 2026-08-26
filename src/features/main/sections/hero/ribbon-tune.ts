/**
 * 타워 씬 리본 라이브 튜닝.
 *
 * 패널이 값을 바꾸고, `scene-ribbons` `useFrame` 이 매 프레임 `getRibbonTune()` 으로 읽는다.
 * 캔버스를 state 로 리렌더하지 않으려고 모듈 스토어다.
 */

export type RibbonLayerTune = {
  amp: number;
  twAmp: number;
  twFreq: number;
  twistDir: number;
  phase: number;
  speed: number;
  bodyAlpha: number;
  rose: number;
  gold: number;
  blue: number;
  streak: number;
};

export type RibbonTune = {
  showMembrane: boolean;
  /** 구 JSON 호환. 렌더러는 포인트를 그리지 않아 무시한다. */
  showDots: boolean;
  show0: boolean;
  show1: boolean;
  show2: boolean;
  show3: boolean;

  ampMul: number;
  twistMul: number;
  speedMul: number;
  timeScale: number;
  bodyAlphaMul: number;
  roseMul: number;
  goldMul: number;
  blueMul: number;
  iridMul: number;
  grainMul: number;
  /** 구 JSON 호환. 렌더러는 무시한다. */
  dotSizeMul: number;

  groupScale: number;
  posX: number;
  posY: number;
  /** 스크롤 진행도 `u` 에 곱해 그룹을 올린다. 현재 코드 0.04 */
  groupY: number;
  /** 스크롤 진행도 `u` 에 곱해 그룹을 돌린다. 현재 코드 -0.04 */
  groupRot: number;

  r0: RibbonLayerTune;
  r1: RibbonLayerTune;
  r2: RibbonLayerTune;
  r3: RibbonLayerTune;
};

export const RIBBON_LAYER_IDS = ["r0", "r1", "r2", "r3"] as const;
export type RibbonLayerId = (typeof RIBBON_LAYER_IDS)[number];

export const RIBBON_LAYER_LABELS: Record<RibbonLayerId, string> = {
  r0: "띠 1 크림·파랑·핑크",
  r1: "띠 2 파랑·크림·핑크",
  r2: "띠 3 파랑·핑크·크림",
  r3: "띠 4 핑크·파랑·크림",
};

/** `scene-ribbons.tsx` CONFS 와 같은 실측값. 패널 리셋이 여기로 돌아온다. */
export const RIBBON_TUNE_DEFAULTS: RibbonTune = {
  showMembrane: true,
  showDots: true,
  show0: true,
  show1: true,
  show2: true,
  show3: true,

  ampMul: 0.72,
  twistMul: 1.98,
  speedMul: 1.5,
  timeScale: 1,
  bodyAlphaMul: 1,
  roseMul: 1,
  goldMul: 1,
  blueMul: 1,
  iridMul: 1,
  grainMul: 1.11,
  dotSizeMul: 1,

  groupScale: 1,
  posX: 0,
  posY: 0,
  groupY: 0,
  groupRot: 0,

  r0: {
    amp: 0.2,
    twAmp: 1,
    twFreq: 1.5,
    twistDir: 1,
    phase: 0,
    speed: 0.55,
    bodyAlpha: 0.88,
    rose: 0,
    gold: 0,
    blue: 0,
    streak: 0.2,
  },
  r1: {
    amp: 0.15,
    twAmp: 1.3,
    twFreq: 1.75,
    twistDir: 1,
    phase: 2.1,
    speed: 0.62,
    bodyAlpha: 0.92,
    rose: 0,
    gold: 0,
    blue: 0,
    streak: 0.42,
  },
  r2: {
    amp: 0.16,
    twAmp: 2.5,
    twFreq: 0.75,
    twistDir: -1,
    phase: 4.4,
    speed: 0.5,
    bodyAlpha: 0.8,
    rose: 0,
    gold: 0,
    blue: 0,
    streak: 0.55,
  },
  r3: {
    amp: 0.09,
    twAmp: 1.6,
    twFreq: 1.2,
    twistDir: 1,
    phase: 1.3,
    speed: 0.45,
    bodyAlpha: 1,
    rose: 0,
    gold: 0,
    blue: 0,
    streak: 0.22,
  },
};

let current: RibbonTune = structuredClone(RIBBON_TUNE_DEFAULTS);
const listeners = new Set<() => void>();
let appliedGen = 0;
const TUNE_GEN = 9;

export function getRibbonTune(): RibbonTune {
  if (appliedGen !== TUNE_GEN) {
    appliedGen = TUNE_GEN;
    current = structuredClone(RIBBON_TUNE_DEFAULTS);
  }
  return current;
}

export function setRibbonTune(patch: Partial<RibbonTune>) {
  current = { ...current, ...patch };
  for (const fn of listeners) fn();
}

export function setRibbonLayer(id: RibbonLayerId, patch: Partial<RibbonLayerTune>) {
  setRibbonTune({ [id]: { ...current[id], ...patch } });
}

export function resetRibbonTune() {
  current = structuredClone(RIBBON_TUNE_DEFAULTS);
  for (const fn of listeners) fn();
}

export function subscribeRibbonTune(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}
