"use client";

import { useEffect } from "react";

/**
 * body 스크롤 락 — **모듈 스코프 reference count** 방식.
 *
 * shin 은 GNB 가 `document.body.style.overflow` 를 직접 만지고 모달은
 * ref count 를 쓰는 두 벌 구현이었다. 모바일 메뉴 위에 모달이 뜨면
 * 먼저 닫히는 쪽이 락을 풀어버려 배경이 스크롤됐다. 여기서는 한 벌만 쓴다.
 *
 * 스크롤바 폭만큼 padding 을 보정하지 않으면 락 순간 레이아웃이 가로로 튄다.
 */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

const apply = () => {
  if (typeof document === "undefined") return;
  const body = document.body;
  if (lockCount === 0) {
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  }
  lockCount += 1;
};

const release = () => {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
};

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    apply();
    return release;
  }, [locked]);
}
