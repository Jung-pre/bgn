"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * 3D 씬을 "화면 근처일 때만" 살려두기 위한 IntersectionObserver 훅.
 *
 * 3D 인터랙션이 많은 랜딩에서 가장 큰 성능 이득은 셰이더 최적화가 아니라
 * **안 보이는 캔버스를 안 그리는 것**이다. 섹션이 5개면 프레임 비용도 5배다.
 *
 * `rootMargin` 을 넉넉히 잡는 이유: 진입 순간에 처음 그리기 시작하면
 * 텍스처 업로드·셰이더 컴파일이 그 프레임에 몰려 스크롤이 한 번 걸린다.
 * 한 화면 정도 미리 워밍업해 둔다.
 */
export function useSceneActive<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = "100% 0px 100% 0px" }: { rootMargin?: string } = {},
): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setActive(true); // 관찰 불가 환경은 그냥 켜둔다
      return;
    }
    /**
     * ⚠️ 반드시 **마지막 엔트리**를 읽어야 한다.
     *
     * IntersectionObserver 는 한 번의 콜백에 같은 타겟의 레코드를 **여러 개**
     * 실어 보낼 수 있다. 한 프레임 안에서 교차 상태가 두 번 바뀌면
     * `entries === [false, true]` 로 들어온다.
     *
     * 실제로 이 사이트에서 그런 일이 난다: GSAP ScrollTrigger 가 pin 을 걸 때
     * pin-spacer 를 만들며 pinShell 의 인라인 height 를 잠깐 비우는데,
     * 그 순간 `inset: 0` 인 캔버스 호스트가 높이 0 으로 접혔다가 곧바로 복구된다.
     *
     * 여기서 `([entry]) => ...` 로 **첫** 엔트리만 읽으면 그 찰나의 false 가
     * 최종 상태로 굳어버린다. → frameloop 이 "never" 로 내려간 채 영원히 안 돌아오고,
     * 3D 가 통째로 안 보인다. (히어로 구체가 안 보이던 원인이 정확히 이거였다)
     */
    const io = new IntersectionObserver(
      (entries) => setActive(Boolean(entries[entries.length - 1]?.isIntersecting)),
      { root: null, rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return active;
}

/**
 * 스크롤 중에는 포인터 추종을 0 으로 되돌리는 가드.
 *
 * GSAP pin/scrub 구간에서 마우스 추종 회전이 같이 살아 있으면 모델이
 * 계속 흔들려서 "스크롤로 조작한다"는 느낌이 깨진다. 스크롤이 멈추면
 * 다시 포인터를 따라간다.
 *
 * 모바일 주의: `touchmove` 를 전부 스크롤로 치면 캔버스 위에서 손가락을
 * 움직여도 회전이 안 된다. 캔버스 내부 터치는 예외 처리한다.
 */
export function useScrollIdleGuard(containerRef: RefObject<HTMLElement | null>) {
  const isScrollingRef = useRef(false);

  useEffect(() => {
    let timer = 0;

    const mark = (event: Event) => {
      if (event.type === "touchmove" && event.target instanceof Node) {
        const el = containerRef.current;
        if (el && el.contains(event.target)) return; // 캔버스 위 드래그는 회전으로
      }
      isScrollingRef.current = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        isScrollingRef.current = false;
      }, 140);
    };

    window.addEventListener("scroll", mark, { passive: true });
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", mark);
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchmove", mark);
    };
  }, [containerRef]);

  return isScrollingRef;
}
