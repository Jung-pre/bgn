/**
 * 타워 씬 리본 파라미터.
 * 라이브 패널로 맞춘 값을 고정했다. 매 프레임 `useFrame` 에서 읽는다.
 */
export const RIBBON_TUNE = {
  showRibbon: true,
  /**
   * 리본 전체 투명도 배율 — 수정요청 6차 3p "라인 투명도 조금 더 높여주세요".
   * 셰이더 최종 alpha 에 곱한다. 1 이 예전(더 진한) 값.
   * 최신 시안 `124:2780` 의 모바일 씬2 는 리본이 하단에만 아주 옅게 깔린다.
   */
  opacity: 0.95,
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
