"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * WebGL 을 쓸 수 있는가.
 *
 * ## 왜 `useEffect + setState` 가 아닌가
 * 서버는 WebGL 지원 여부를 알 수 없으므로 첫 렌더는 반드시 `false` 여야 한다.
 * 그렇다고 effect 안에서 `setState` 를 부르면 React Compiler 의
 * `set-state-in-effect` 규칙에 걸린다(연쇄 렌더를 유발하는 패턴이라 맞는 지적이다).
 * `useSyncExternalStore` 는 **서버 스냅샷과 클라이언트 스냅샷을 따로** 주는 게
 * 원래 용도라 이 상황에 정확히 들어맞는다 — 프로젝트의 `useMediaQuery` 와 같은 패턴.
 *
 * ## 왜 모듈 캐시가 필요한가
 * `getSnapshot` 은 렌더마다 불린다. 매번 캔버스를 만들어 컨텍스트를 얻으면
 * 그 자체로 GPU 리소스를 낭비하고, 무엇보다 **매번 다른 값이 나올 수 있어**
 * React 가 "무한 렌더" 로 판단한다. 한 번 조사하고 그 결과를 얼린다.
 */
let cached: boolean | null = null;

function probe(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    cached = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

/** 구독할 외부 소스가 없다. 값이 한 번 정해지면 끝이라 빈 해제 함수만 돌려준다. */
const subscribe = () => () => {};

export function useWebglSupported(): boolean {
  const getSnapshot = useCallback(() => probe(), []);
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
