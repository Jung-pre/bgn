/**
 * 타워 씬 리본 파라미터.
 * 라이브 패널로 맞춘 값을 고정했다. 매 프레임 `useFrame` 에서 읽는다.
 */
export const RIBBON_TUNE = {
  showRibbon: true,
  geometrySpeed: 0.7,
  amplitude: 1,
  depth: 1,
  warpIntensity: 0.8,
  gradientSpeed: 0.2,
  energy: 0.5,
  noiseScaleMul: 1,
  groupScale: 1,
  posX: 0,
  posY: 0,
} as const;
