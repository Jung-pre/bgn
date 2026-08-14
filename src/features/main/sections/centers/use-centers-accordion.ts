"use client";

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
}

export function useCentersAccordion(count: number): CentersAccordionResult {
  const [activeIndex, setActiveIndex] = useState(0);
  const [groupOpen, setGroupOpen] = useState(false);
  const trackRef = useRef<HTMLUListElement>(null);

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

  return { activeIndex, groupOpen, trackRef, isExpanded, isVisible, select, step, toggleGroup };
}
