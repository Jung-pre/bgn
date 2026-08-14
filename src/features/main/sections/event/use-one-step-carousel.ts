"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

/**
 * "버튼 클릭 시 한 장씩" 가로 캐러셀.
 *
 * Figma 주석(2:2852): `카드 최대 8개, 버튼 클릭시 한개씩`.
 * 기존 구현은 `scrollBy(clientWidth * 0.5)` 라 뷰포트 폭에 따라 이동량이
 * 달라졌다(1920 에서 2.1장, 1440 에서 1.4장). 이동 단위를 **카드 1장**으로 고정한다.
 *
 * ## 왜 네이티브 스크롤을 버리지 않는가
 * `transform: translateX` 트랙으로 바꾸면 키보드 포커스 이동(Tab 으로 카드 안
 * 링크에 들어갈 때 브라우저가 자동으로 스크롤해 주는 것)과 터치 관성을 전부
 * 직접 만들어야 한다. 네이티브 스크롤 컨테이너를 유지하고 **이동량만**
 * 제어하는 편이 접근성이 공짜로 따라온다.
 *
 * ## 왜 카드 폭을 JS 상수로 두지 않는가
 * CSS 의 카드 폭·gap 을 JS 에 복제하면 반응형에서 반드시 어긋난다.
 * 이동 단위는 `두 번째 카드 offsetLeft − 첫 번째 카드 offsetLeft` 로 DOM 에서
 * 읽는다. gap 이 포함된 값이라 그대로 한 장 분이다.
 *
 * ## 상태 규칙 (CLAUDE.md)
 * 스크롤은 프레임마다 발생한다 → 프로그레스 바는 **ref 로 DOM 에 직접** 쓰고,
 * state 는 인덱스가 **바뀔 때만** 갱신한다.
 */
export interface OneStepCarousel {
  trackRef: RefObject<HTMLUListElement | null>;
  /** 프로그레스 바 채움 요소. 매 프레임 transform 이 직접 쓰인다. */
  progressRef: RefObject<HTMLSpanElement | null>;
  index: number;
  /** 실제로 도달 가능한 마지막 인덱스 (컨테이너에 몇 장이 보이는지에 따라 달라진다) */
  lastIndex: number;
  /** 화살표 핸들러. `-1` 이전 / `1` 다음 */
  step: (direction: -1 | 1) => void;
  /** 마우스 드래그 스와이프 (선택 기능). 트랙에 스프레드한다. */
  dragProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLUListElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLUListElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLUListElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLUListElement>) => void;
    onClickCapture: (event: ReactMouseEvent<HTMLUListElement>) => void;
  };
}

/** 드래그로 인정하는 최소 이동량(px). 이보다 작으면 그냥 클릭이다. */
const DRAG_THRESHOLD = 5;
/** 드래그 종료 후 이 시간 안에 오는 click 은 삼킨다(ms) */
const CLICK_SUPPRESS_MS = 150;

interface DragState {
  pointerId: number;
  startX: number;
  startScroll: number;
  moved: boolean;
}

export function useOneStepCarousel(itemCount: number): OneStepCarousel {
  const trackRef = useRef<HTMLUListElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);

  /** 카드 1장 이동량(px). 매 프레임 읽으면 강제 리플로우라 측정값을 캐시한다. */
  const stepSizeRef = useRef(0);
  const rafRef = useRef(0);
  const indexRef = useRef(0);
  const lastIndexRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  /**
   * 드래그가 끝난 시각. 플래그(boolean)로 두면 드래그를 카드 밖에서 놓아
   * click 이 안 올 때 플래그가 남아 다음 클릭을 잡아먹는다. 타임스탬프는
   * 저절로 만료돼 그런 상태가 생기지 않는다.
   */
  const dragEndedAtRef = useRef(0);

  const [index, setIndexState] = useState(0);
  const [lastIndex, setLastIndexState] = useState(0);

  const paint = useCallback((track: HTMLUListElement) => {
    const bar = progressRef.current;
    if (!bar) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    // 보이는 비율만큼은 항상 채워 둔다 — 스크롤바 썸과 같은 읽기 방식이라
    // "지금 어디쯤인지"가 도트보다 정확하게 전달된다.
    const visible = track.scrollWidth > 0 ? Math.min(1, track.clientWidth / track.scrollWidth) : 1;
    const fraction = maxScroll > 0 ? track.scrollLeft / maxScroll : 0;
    bar.style.transform = `scaleX(${visible + (1 - visible) * fraction})`;
  }, []);

  const sync = useCallback(
    (track: HTMLUListElement) => {
      paint(track);

      const size = stepSizeRef.current;
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      // 끝까지 밀렸으면 무조건 마지막 인덱스로 본다. 컨테이너 폭이 카드 단위로
      // 딱 떨어지지 않으면 마지막 한 칸은 항상 부분 이동이라, 반올림만으로는
      // "다음" 버튼이 영영 활성인 상태가 된다.
      const atEnd = maxScroll > 0 && track.scrollLeft >= maxScroll - 1;
      const next =
        size > 0
          ? Math.min(
              lastIndexRef.current,
              atEnd ? lastIndexRef.current : Math.round(track.scrollLeft / size),
            )
          : 0;

      if (indexRef.current !== next) {
        indexRef.current = next;
        setIndexState(next);
      }
    },
    [paint],
  );

  const measure = useCallback(
    (track: HTMLUListElement) => {
      const first = track.children[0] as HTMLElement | undefined;
      const second = track.children[1] as HTMLElement | undefined;
      const size =
        first && second ? second.offsetLeft - first.offsetLeft : (first?.offsetWidth ?? 0);
      stepSizeRef.current = size;

      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const last = size > 0 ? Math.max(0, Math.min(itemCount - 1, Math.ceil(maxScroll / size))) : 0;
      if (lastIndexRef.current !== last) {
        lastIndexRef.current = last;
        setLastIndexState(last);
      }
      sync(track);
    },
    [itemCount, sync],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      // 스크롤 이벤트는 프레임보다 자주 온다. rAF 로 한 프레임 1회로 접는다.
      if (rafRef.current !== 0) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        sync(track);
      });
    };

    measure(track);
    track.addEventListener("scroll", onScroll, { passive: true });

    // 뷰포트가 바뀌면 카드 폭(clamp)과 보이는 장수가 같이 바뀐다 → 재측정.
    const observer = new ResizeObserver(() => measure(track));
    observer.observe(track);

    return () => {
      track.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (rafRef.current !== 0) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [measure, sync]);

  const scrollToIndex = useCallback((target: number) => {
    const track = trackRef.current;
    const size = stepSizeRef.current;
    if (!track || size <= 0) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    track.scrollTo({
      left: Math.min(target * size, maxScroll),
      // reduced-motion 에서 smooth 스크롤은 그 자체가 큰 동작이다. 즉시 이동.
      behavior: prefersReducedMotionSync() ? "auto" : "smooth",
    });
  }, []);

  const step = useCallback(
    (direction: -1 | 1) => {
      const target = clamp(indexRef.current + direction, 0, lastIndexRef.current);
      if (target === indexRef.current) return;
      scrollToIndex(target);
    },
    [scrollToIndex],
  );

  /* ── 드래그 스와이프 (선택 기능 — 마우스 전용) ────────────────────────────
     터치/펜은 네이티브 스크롤이 관성까지 처리한다. 마우스에만 붙여야
     모바일에서 스크롤이 두 번 계산되는 사고가 없다. */
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: track.scrollLeft,
      moved: false,
    };
    track.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLUListElement>) => {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) drag.moved = true;
    track.scrollLeft = drag.startScroll - dx;
  }, []);

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLUListElement>) => {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      if (!drag.moved) return;

      dragEndedAtRef.current = event.timeStamp;
      // 놓은 자리에서 가장 가까운 카드에 안착시킨다(마우스 드래그에는 snap 이 안 걸린다).
      const size = stepSizeRef.current;
      if (size > 0) {
        scrollToIndex(clamp(Math.round(track.scrollLeft / size), 0, lastIndexRef.current));
      }
    },
    [scrollToIndex],
  );

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLUListElement>) => {
    // 드래그를 끝낸 커서가 카드 위에 있으면 링크가 열려 버린다.
    if (event.timeStamp - dragEndedAtRef.current > CLICK_SUPPRESS_MS) return;
    dragEndedAtRef.current = 0;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    trackRef,
    progressRef,
    index,
    lastIndex,
    step,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;
