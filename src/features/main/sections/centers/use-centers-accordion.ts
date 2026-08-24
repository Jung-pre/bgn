"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

/**
 * 진료센터 아코디언의 상태 기계.
 *
 * 컴포넌트에서 분리한 이유는 규칙이 세 갈래로 얽혀 있어서다:
 *   ① 활성 인덱스(클릭·화살표·도트)
 *   ② 트랙에 실제로 노출되는 창(window) — 시안은 6장을 다 보여주지 않는다
 *   ③ `≡` 그룹 펼침(선택 센터 + 이후 3개)
 * JSX 안에 두면 ②③의 창 계산과 모바일 스크롤 보정이 마크업에 섞인다.
 */

/**
 * Figma 주석: "해당 영역 클릭시 현재 선택된 센터 **이후의 3가지** 영역이 펼쳐짐".
 * 선택된 센터는 이미 펼쳐져 있으므로 그룹 크기는 1(선택) + 3(이후) = 4 다.
 */
export const GROUP_REVEAL_AFTER = 3;
export const GROUP_SPAN = 1 + GROUP_REVEAL_AFTER;

/**
 * 기본 모드에서 트랙에 동시에 보이는 카드 수.
 *
 * Figma `2:1952` 실측이 근거다: 240 + 1120 + 240 + `≡`64 + gap 32×3 = 1760.
 * 즉 시안은 6장을 전부 늘어놓지 않고 **[이전 · 선택 · 다음] 3장 + `≡`** 만
 * 보여주는 캐러셀(cynx.io)이다. 나머지는 폭 0 으로 접힌다.
 */
export const WINDOW_SPAN = 3;

/** cynx.io 와 같이 잡아당기면 한 칸 이동. 의료진 교차 스와이퍼와 같은 임계값. */
const DRAG_COMMIT_RATIO = 0.08;
const DRAG_COMMIT_MIN_PX = 48;
const DRAG_RESISTANCE = 0.6;
const CLICK_SUPPRESS_PX = 6;

export interface CentersAccordionResult {
  activeIndex: number;
  groupOpen: boolean;
  /** 트랙 엘리먼트 — 모바일 스와이퍼에서 활성 카드를 중앙 정렬할 때 쓴다. */
  trackRef: RefObject<HTMLUListElement | null>;
  /** i 번째가 "펼친 상태"인가. 그룹 모드에서는 4장이 동시에 참이다. */
  isExpanded: (index: number) => boolean;
  /** i 번째가 트랙 창 안에 있는가. 창 밖은 폭 0 으로 접힌다. */
  isVisible: (index: number) => boolean;
  select: (index: number) => void;
  /** 좌우 화살표 — 활성 인덱스 ±1 */
  step: (direction: -1 | 1) => void;
  toggleGroup: () => void;
  /** 트랙에 그대로 스프레드. 드래그 중 x 는 ref → CSS 변수, state 금지. */
  dragProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLUListElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLUListElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLUListElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLUListElement>) => void;
    onClickCapture: (e: ReactMouseEvent<HTMLUListElement>) => void;
  };
}

/**
 * 첫 화면의 활성 센터 = **시력교정센터**(목록 2번째).
 *
 * PC `2:1952` / 모바일 `2:4671` 두 시안 모두 트랙이
 * [스마일센터 64 · **시력교정센터** 240 · 백내장센터 64] 로 그려져 있다.
 * 0(스마일센터)으로 시작하면 좌측 프리뷰가 비어 캐러셀로 읽히지 않는다.
 *
 * ⚠️ 시안 도트는 두 화면 다 **1번**이 켜져 있지만, PC 는 도트가 5개인데 센터는
 *    6개다(모바일은 6개). 즉 도트는 정적 목업이지 스펙이 아니다 → 도트는
 *    activeIndex 와 1:1 로 둔다(스와이프하면 위치를 정직하게 따라간다).
 */
const INITIAL_ACTIVE_INDEX = 1;

export function useCentersAccordion(count: number): CentersAccordionResult {
  const [activeIndex, setActiveIndex] = useState(() => Math.min(INITIAL_ACTIVE_INDEX, count - 1));
  const [groupOpen, setGroupOpen] = useState(false);
  const trackRef = useRef<HTMLUListElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, dx: 0, moved: false, raf: 0 });

  const select = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      // 같은 값이면 setState 자체를 건너뛴다. 카드 클릭/포커스/화살표가 모두
      // 이 경로로 들어오기 때문에 가드가 없으면 무의미한 리렌더가 쌓인다.
      setActiveIndex((prev) => (prev === next ? prev : next));
    },
    [count],
  );

  /**
   * 끝에서 순환시킨다. 도트 6칸이 "여기까지 왔다"는 위치 표시일 뿐
   * 진행률(끝점이 있는 값)이 아니라서, 마지막 칸에서 화살표가 죽어 있는 것보다
   * 첫 칸으로 도는 쪽이 캐러셀(cynx.io) 성격에 맞는다.
   */
  const step = useCallback(
    (direction: -1 | 1) => {
      setActiveIndex((prev) => (prev + direction + count) % count);
    },
    [count],
  );

  const toggleGroup = useCallback(() => setGroupOpen((v) => !v), []);

  /**
   * 창의 시작점. 순환(wrap)으로 처리하면 펼친 카드가 트랙 좌우로 쪼개져 보여
   * 아코디언이 깨지므로, 창을 트랙 안쪽으로 밀어 넣는다(clamp).
   *
   *   기본 모드: [활성-1, 활성, 활성+1]   — 시안 2:1952 구성
   *   그룹 모드: [활성 … 활성+3]          — Figma 주석 2:1961
   *
   * 어느 쪽이든 활성 카드는 항상 창 안에 남는다.
   */
  const span = groupOpen ? GROUP_SPAN : WINDOW_SPAN;
  const windowStart = useMemo(() => {
    const desired = groupOpen ? activeIndex : activeIndex - 1;
    return Math.max(0, Math.min(desired, count - span));
  }, [groupOpen, activeIndex, count, span]);

  const isVisible = useCallback(
    (index: number) => index >= windowStart && index < windowStart + span,
    [windowStart, span],
  );

  const isExpanded = useCallback(
    (index: number) =>
      groupOpen ? index >= windowStart && index < windowStart + GROUP_SPAN : index === activeIndex,
    [groupOpen, windowStart, activeIndex],
  );

  /**
   * 모바일 스와이퍼에서만 의미 있는 보정.
   * PC 아코디언은 트랙이 스크롤되지 않으므로(scrollWidth === clientWidth) 즉시 빠진다.
   *
   * `scrollIntoView` 를 쓰지 않는 이유: 중첩 스크롤러에서 조상(문서)까지 함께
   * 스크롤시켜 Lenis 의 스크롤 위치와 싸운다. 트랙 자체의 scrollLeft 만 건드린다.
   */
  useEffect(() => {
    const track = trackRef.current;
    const item = track?.children.item(activeIndex);
    if (!track || !(item instanceof HTMLElement)) return;

    const behavior: ScrollBehavior = prefersReducedMotionSync() ? "auto" : "smooth";
    const center = () => {
      if (track.scrollWidth <= track.clientWidth + 1) return;
      track.scrollTo({
        left: item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2,
        behavior,
      });
    };

    center();
    // 카드 폭이 아직 transition 중이라 위 계산은 '이전' 레이아웃 기준이다.
    // 폭 전환이 끝난 시점에 한 번 더 맞춘다.
    const settle = (event: TransitionEvent) => {
      if (event.propertyName === "width") center();
    };
    item.addEventListener("transitionend", settle);
    return () => item.removeEventListener("transitionend", settle);
  }, [activeIndex]);

  const paintDrag = useCallback(() => {
    drag.current.raf = 0;
    trackRef.current?.style.setProperty("--drag-x", `${drag.current.dx * DRAG_RESISTANCE}px`);
  }, []);

  const finishDrag = useCallback((track: HTMLUListElement, pointerId: number) => {
    if (drag.current.raf) cancelAnimationFrame(drag.current.raf);
    drag.current.raf = 0;
    if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
    delete track.dataset.dragging;
    track.style.setProperty("--drag-x", "0px");
    drag.current.pointerId = -1;
  }, []);

  const dragProps: CentersAccordionResult["dragProps"] = {
    onPointerDown: (e) => {
      if (!e.isPrimary) return;
      Object.assign(drag.current, {
        pointerId: e.pointerId,
        startX: e.clientX,
        dx: 0,
        moved: false,
      });
    },
    onPointerMove: (e) => {
      const state = drag.current;
      if (state.pointerId !== e.pointerId) return;
      state.dx = e.clientX - state.startX;
      if (!state.moved && Math.abs(state.dx) > CLICK_SUPPRESS_PX) {
        state.moved = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.dragging = "true";
      }
      if (!state.raf) state.raf = requestAnimationFrame(paintDrag);
    },
    onPointerUp: (e) => {
      if (drag.current.pointerId !== e.pointerId) return;
      const { dx } = drag.current;
      const threshold = Math.max(
        DRAG_COMMIT_MIN_PX,
        e.currentTarget.clientWidth * DRAG_COMMIT_RATIO,
      );
      finishDrag(e.currentTarget, e.pointerId);
      if (Math.abs(dx) > threshold) step(dx < 0 ? 1 : -1);
    },
    onPointerCancel: (e) => {
      if (drag.current.pointerId !== e.pointerId) return;
      finishDrag(e.currentTarget, e.pointerId);
    },
    onClickCapture: (e) => {
      if (!drag.current.moved) return;
      drag.current.moved = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  useEffect(() => {
    const state = drag.current;
    return () => {
      if (state.raf) cancelAnimationFrame(state.raf);
    };
  }, []);

  return {
    activeIndex,
    groupOpen,
    trackRef,
    isExpanded,
    isVisible,
    select,
    step,
    toggleGroup,
    dragProps,
  };
}
