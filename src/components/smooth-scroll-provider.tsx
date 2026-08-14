"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/shared/lib/gsap";
import { MQ } from "@/shared/config/breakpoints";

/**
 * Lenis 스무스 스크롤 + GSAP ScrollTrigger 통합.
 *
 * ## 왜 scrollerProxy 를 쓰지 않는가
 * Lenis 는 기본 모드에서 실제로 `window.scrollTo` 를 호출해 **네이티브 스크롤
 * 위치를 진짜로 움직인다**. 그래서 `window.scrollY` 를 읽는 코드와
 * `window.addEventListener("scroll")` 구독자가 전부 그대로 동작한다.
 * ScrollTrigger 에 별도 scroller 를 물릴 필요가 없고, 한 번만
 * `ScrollTrigger.update` 를 프레임에 붙여주면 끝이다.
 *
 * ## RAF 루프 단일화
 * Lenis 자체 rAF 와 GSAP ticker 가 따로 돌면 프레임 순서가 매번 뒤바뀌어
 * 1프레임 지터가 생긴다. `gsap.ticker` 하나에 Lenis 를 태워 순서를 고정한다.
 *
 * ## children 을 감싸지 않는다
 * 레이아웃에서 `{children}` 의 형제로 렌더할 것. 서버 컴포넌트 children 이
 * client boundary 안으로 빨려 들어가는 걸 막는다.
 */
export function SmoothScrollProvider() {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // 동작 줄이기 설정이면 Lenis 를 아예 만들지 않는다 — 네이티브 스크롤 유지.
    if (window.matchMedia(MQ.reduceMotion).matches) return;

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // 터치는 네이티브에 맡긴다. syncTouch 를 켜면 모바일 관성과 충돌해
      // 스크롤이 "미끄덩"거린다.
      syncTouch: false,
      autoResize: true,
    });
    lenisRef.current = lenis;

    const handleScroll = () => ScrollTrigger.update();
    lenis.on("scroll", handleScroll);

    const tick = (time: number) => lenis.raf(time * 1000); // gsap ticker 는 초 단위
    gsap.ticker.add(tick);
    // 탭 복귀 시 GSAP 이 delta 를 보정하면서 스크롤이 튀는 걸 막는다.
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", handleScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  /**
   * 라우트 전환: 최상단 리셋 + 계단식 refresh.
   *
   * 이미지·폰트·동적 청크가 순차로 도착하며 문서 높이가 계속 변한다.
   * 한 번만 refresh 하면 늦게 온 이미지 때문에 ScrollTrigger start/end 가
   * 어긋난 채로 남는다.
   */
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);

    const refresh = () => {
      lenisRef.current?.resize();
      ScrollTrigger.refresh(true);
    };

    const rafId = requestAnimationFrame(refresh);
    const timers = [300, 1000, 2500].map((ms) => window.setTimeout(refresh, ms));

    // img load 는 버블링하지 않으므로 capture 로 잡는다.
    const onImgLoad = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === "IMG") refresh();
    };
    document.addEventListener("load", onImgLoad, true);

    // 폰트 로드 후 텍스트 높이가 바뀌는 경우도 커버.
    document.fonts?.ready.then(refresh).catch(() => {});

    return () => {
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      document.removeEventListener("load", onImgLoad, true);
    };
  }, [pathname]);

  /**
   * 전역 스크롤 투 탑.
   * Lenis 인스턴스를 context 로 노출하지 않고 이벤트 버스로 푼다 —
   * 아무 컴포넌트에서나 `window.dispatchEvent(new Event("app:scroll-to-top"))`.
   */
  useEffect(() => {
    const onScrollToTop = () => {
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(0, { duration: 1.1 });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("app:scroll-to-top", onScrollToTop);
    return () => window.removeEventListener("app:scroll-to-top", onScrollToTop);
  }, []);

  /**
   * 터치 디바이스에서 pin 구간 스크롤 안정화.
   *
   * normalizeScroll 은 브라우저 주소창 show/hide 로 인한 vh 점프를 흡수해
   * 모바일 pin 이 튀는 걸 막는다. 다만 데스크톱에서는 Lenis 와 이중으로
   * 스크롤을 가로채므로 coarse pointer 에서만 켠다.
   */
  useEffect(() => {
    const shouldNormalize =
      window.matchMedia(MQ.coarsePointer).matches || window.matchMedia(MQ.mobile).matches;

    if (shouldNormalize) {
      ScrollTrigger.normalizeScroll({ allowNestedScroll: true });
      ScrollTrigger.refresh();
    } else {
      ScrollTrigger.normalizeScroll(false);
    }
    return () => {
      ScrollTrigger.normalizeScroll(false);
    };
  }, [pathname]);

  return null;
}
