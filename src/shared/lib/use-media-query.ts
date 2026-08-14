"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MQ } from "@/shared/config/breakpoints";

/**
 * SSR-safe matchMedia 훅.
 *
 * `useEffect + setState` 방식은 hydration 직후 1프레임 잘못된 레이아웃이
 * 그려진다. `useSyncExternalStore` 는 첫 렌더에서 바로 클라이언트 스냅샷을
 * 읽으므로 그 깜빡임이 없다.
 *
 * shin 에서는 이 패턴이 4개 파일에 복붙돼 있었고, 그 과정에서
 * `(max-width: 1023px)` 과 `(max-width: 1024px)` 이 섞여버렸다.
 * 여기서 제네릭으로 한 번만 정의한다.
 *
 * @param query   미디어쿼리 문자열. `MQ` 프리셋 사용 권장.
 * @param serverFallback  SSR 스냅샷. 기본 false(= 데스크톱 가정).
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return serverFallback;
    return window.matchMedia(query).matches;
  }, [query, serverFallback]);

  const getServerSnapshot = useCallback(() => serverFallback, [serverFallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `<= 1024px` — DOM 구조를 바꾸는 기준 */
export const useIsMobileLayout = () => useMediaQuery(MQ.mobile);

/**
 * OS 의 "동작 줄이기" 설정.
 *
 * GSAP 콜백 안에서는 훅을 못 쓰므로 그쪽은 `matchMedia` 를 직접 읽는다
 * (`prefersReducedMotionSync`). 렌더 분기용은 이 훅.
 */
export const usePrefersReducedMotion = () => useMediaQuery(MQ.reduceMotion);

/** GSAP 콜백·이벤트 핸들러 등 훅을 쓸 수 없는 곳에서의 동기 조회 */
export function prefersReducedMotionSync(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MQ.reduceMotion).matches;
}
