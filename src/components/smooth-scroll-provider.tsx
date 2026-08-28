"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/shared/lib/gsap";
import { MQ } from "@/shared/config/breakpoints";
import { SCROLL_LOCK_EVENT, isScrollLocked } from "@/shared/lib/use-scroll-lock";

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
 * ## 내부 스크롤 영역은 `allowNestedScroll` 이 판별한다
 * Lenis 는 기본적으로 wheel 을 `preventDefault` 하고 자기가 스크롤을 그린다.
 * 그래서 페이지 안의 가로 캐러셀·탭 스트립 같은 **내부 스크롤 영역**은 그냥 두면
 * 휠이 도달하지 않는다. 예전에는 그런 요소마다 `data-lenis-prevent` 를 달았는데,
 * 이 속성은 **축을 가리지 않고 그 요소 위의 모든 휠을 네이티브로 넘긴다.**
 * 결과가 두 가지 사고였다.
 *
 *   ① 스크롤 컨테이너가 아닌 요소(데스크톱의 AI 카드 그리드, 탭 스트립)에 붙어 있으면
 *      그 위에서 굴린 세로 휠이 전부 네이티브가 된다 → 페이지가 한 번에 툭 튀고,
 *      스크롤 방향을 보는 GNB 가 깜빡인다.
 *   ② 진짜 가로 스크롤 영역(이벤트 캐러셀)이라도 **세로** 휠까지 네이티브로 새서
 *      캐러셀 위를 지나갈 때마다 스무스 스크롤이 끊긴다.
 *
 * `allowNestedScroll` 은 Lenis 가 직접 판별하게 한다 — 휠 방향을 보고, 그 축으로
 * 실제로 스크롤되는 요소일 때만(그리고 아직 끝에 닿지 않았을 때만) 네이티브에 넘긴다.
 * 즉 가로 캐러셀 위의 가로 휠만 넘어가고 세로 휠은 그대로 Lenis 가 그린다.
 * 그래서 섹션들의 `data-lenis-prevent` 를 전부 걷어냈다.
 * (오버레이인 메가메뉴만 예외 — 거기서는 축과 무관하게 뒤 페이지가 안 움직여야 한다.)
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
      /* 내부 스크롤 영역 자동 판별 — 위 "## 내부 스크롤 영역" 참고.
         이걸 끄면(기본값) 섹션마다 `data-lenis-prevent` 를 다시 달아야 하고,
         그러면 세로 휠까지 같이 새어 나간다. */
      allowNestedScroll: true,
    });
    lenisRef.current = lenis;

    /* 메가메뉴 등이 Lenis 생성 전에 락을 걸었을 수 있다 */
    if (isScrollLocked()) lenis.stop();

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

    /**
     * ## ⚠️ refresh 는 **스크롤 중에 절대 돌리지 않는다**
     *
     * 원래는 이미지가 하나 로드될 때마다 `refresh()` 를 그대로 호출했다.
     * 이 페이지는 lazy 이미지가 수십 장이라, 아래로 내려가는 동안 이미지가
     * 순차로 도착하면서 **하드 refresh 가 연달아 터진다**. refresh 는 모든
     * ScrollTrigger 의 start/end 를 다시 재고 pin 을 원복했다 다시 거는
     * 작업이라, 스크롤 도중에 걸리면 pin 구간에서 스크롤 위치가 튄다.
     * "스크롤이 중간에 튕긴다"가 이거였다.
     *
     * 그래서 두 겹으로 막는다.
     *  ① 200ms 트레일링 디바운스 — 이미지가 우르르 와도 refresh 는 한 번
     *  ② 마지막 스크롤 이벤트로부터 250ms 이 안 지났으면 다시 미룬다
     *     = 손을 뗀 뒤에야 실행된다
     *
     * next/image 는 어차피 aspect-ratio 로 자리를 미리 잡아두기 때문에
     * 늦게 실행돼도 레이아웃이 어긋나지 않는다.
     */
    let lastScrollAt = 0;
    const markScroll = () => {
      lastScrollAt = performance.now();
    };
    window.addEventListener("scroll", markScroll, { passive: true });

    /**
     * ③ 마지막 방어선 — **문서 크기가 그대로면 아예 돌리지 않는다.**
     * next/image 가 aspect-ratio 로 자리를 미리 잡으므로 이미지가 늦게 도착해도
     * 문서 높이는 안 변한다. 즉 이미지 로드발 refresh 는 대부분 **할 일이 없는
     * refresh** 다. 이 비교 하나로 스크롤 중 refresh 가 실질 0 이 된다.
     */
    let lastH = 0;
    let lastVH = 0;

    let idleTimer = 0;
    const scheduleRefresh = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (performance.now() - lastScrollAt < 300) {
          scheduleRefresh(); // 아직 스크롤 중 — 멈출 때까지 미룬다
          return;
        }
        const h = document.documentElement.scrollHeight;
        if (h === lastH && window.innerHeight === lastVH) return;
        lastH = h;
        lastVH = window.innerHeight;
        refresh();
      }, 200);
    };

    // 첫 프레임만 즉시(아직 스크롤이 시작되기 전이다). 나머지는 전부 예약.
    const rafId = requestAnimationFrame(() => {
      lastH = document.documentElement.scrollHeight;
      lastVH = window.innerHeight;
      refresh();
    });
    const timers = [300, 1000, 2500].map((ms) => window.setTimeout(scheduleRefresh, ms));

    // img load 는 버블링하지 않으므로 capture 로 잡는다.
    const onImgLoad = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName === "IMG") scheduleRefresh();
    };
    document.addEventListener("load", onImgLoad, true);

    // 폰트 로드 후 텍스트 높이가 바뀌는 경우도 커버.
    document.fonts?.ready.then(scheduleRefresh).catch(() => {});

    return () => {
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      window.clearTimeout(idleTimer);
      window.removeEventListener("scroll", markScroll);
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

    /**
     * 임의 위치로 스크롤 — `app:scroll-to` (detail: { top, duration }).
     *
     * 히스토리 모바일 스와이프처럼 **콘텐츠가 페이지 스크롤을 움직여야 하는**
     * 경우에 쓴다. `window.scrollTo` 를 직접 부르면 Lenis 가 자기 목표값과
     * 어긋나 곧바로 되돌려 버리므로 반드시 Lenis 를 거쳐야 한다.
     */
    const onScrollTo = (e: Event) => {
      const detail = (e as CustomEvent<{ top?: number; duration?: number }>).detail;
      const top = detail?.top;
      if (typeof top !== "number" || !Number.isFinite(top)) return;
      const duration = detail?.duration ?? 0.5;
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo(top, { duration });
      else window.scrollTo({ top, behavior: "smooth" });
    };
    window.addEventListener("app:scroll-to", onScrollTo);

    return () => {
      window.removeEventListener("app:scroll-to-top", onScrollToTop);
      window.removeEventListener("app:scroll-to", onScrollTo);
    };
  }, []);

  /**
   * 터치 디바이스에서 pin 구간 스크롤 안정화.
   *
   * normalizeScroll 은 브라우저 주소창 show/hide 로 인한 vh 점프를 흡수해
   * 모바일 pin 이 튀는 걸 막는다. 다만 데스크톱에서는 Lenis 와 이중으로
   * 스크롤을 가로채므로 coarse pointer 에서만 켠다.
   *
   * 모달/메가메뉴 락(`app:scroll-lock`) 중에는 반드시 끈다. normalizeScroll 은
   * touch 를 preventDefault 한 뒤 페이지를 직접 움직이므로 body overflow:hidden
   * 만으로는 배경이 계속 스크롤된다.
   */
  useEffect(() => {
    const shouldNormalize =
      window.matchMedia(MQ.coarsePointer).matches || window.matchMedia(MQ.mobile).matches;

    let locked = isScrollLocked();

    const applyNormalize = () => {
      if (shouldNormalize && !locked) {
        ScrollTrigger.normalizeScroll({ allowNestedScroll: true });
        ScrollTrigger.refresh();
      } else {
        ScrollTrigger.normalizeScroll(false);
      }
    };

    if (locked) lenisRef.current?.stop();
    applyNormalize();

    const onLock = (e: Event) => {
      locked = Boolean((e as CustomEvent<{ locked?: boolean }>).detail?.locked);
      const lenis = lenisRef.current;
      if (locked) lenis?.stop();
      else lenis?.start();
      applyNormalize();
    };
    window.addEventListener(SCROLL_LOCK_EVENT, onLock);

    return () => {
      window.removeEventListener(SCROLL_LOCK_EVENT, onLock);
      lenisRef.current?.start();
      ScrollTrigger.normalizeScroll(false);
    };
  }, [pathname]);

  return null;
}
