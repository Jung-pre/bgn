"use client";

import { useEffect } from "react";

/**
 * 페이지 스크롤 락 — **모듈 스코프 reference count** 방식.
 *
 * shin 은 GNB 가 `document.body.style.overflow` 를 직접 만지고 모달은
 * ref count 를 쓰는 두 벌 구현이었다. 모바일 메뉴 위에 모달이 뜨면
 * 먼저 닫히는 쪽이 락을 풀어버려 배경이 스크롤됐다. 여기서는 한 벌만 쓴다.
 *
 * ## 왜 body overflow 만으로는 부족한가
 * 이 사이트는 Lenis + (모바일) ScrollTrigger.normalizeScroll 이 스크롤을 그린다.
 * `body { overflow: hidden }` 은 네이티브 스크롤만 막고, Lenis 휠·normalizeScroll
 * 터치는 그대로 통과한다 → 상담 확대/메가메뉴가 떠도 뒤가 움직인다.
 * 그래서 CSS 락과 함께 `app:scroll-lock` 이벤트로 SmoothScrollProvider 가
 * Lenis.stop / normalizeScroll(false) 를 맞춘다.
 *
 * 스크롤바 폭만큼 padding 을 보정하지 않으면 락 순간 레이아웃이 가로로 튄다.
 */
export const SCROLL_LOCK_EVENT = "app:scroll-lock";

let lockCount = 0;
let savedHtmlOverflow = "";
let savedBodyOverflow = "";
let savedPaddingRight = "";
let savedTouchAction = "";

const notify = (locked: boolean) => {
  window.dispatchEvent(new CustomEvent(SCROLL_LOCK_EVENT, { detail: { locked } }));
};

const apply = () => {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const body = document.body;
  if (lockCount === 0) {
    savedHtmlOverflow = html.style.overflow;
    savedBodyOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    savedTouchAction = body.style.touchAction;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    /* 모바일 네이티브 터치 팬이 overflow:hidden 을 무시하는 기기가 있다 */
    body.style.touchAction = "none";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    notify(true);
  }
  lockCount += 1;
};

const release = () => {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedPaddingRight;
    document.body.style.touchAction = savedTouchAction;
    notify(false);
  }
};

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    apply();
    return release;
  }, [locked]);
}

/** SmoothScrollProvider 가 마운트 시점에 이미 잠겨 있는지 확인용 */
export function isScrollLocked() {
  return lockCount > 0;
}
