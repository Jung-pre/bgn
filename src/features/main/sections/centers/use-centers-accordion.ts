"use client";

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

/**
 * 진료센터 아코디언의 상태 기계.
 *
 * 컴포넌트에서 분리한 이유는 규칙이 세 갈래로 얽혀 있어서다:
 *   ① 활성 인덱스(클릭·화살표·프로그레스 칸)
 *   ② `≡` 그룹 펼침(선택 센터 + 이후 3개)
 *   ③ 모바일 스와이퍼에서 활성 카드를 가운데로 스크롤
 * JSX 안에 두면 ②의 창(window) 계산과 ③의 레이아웃 타이밍 보정이 마크업에 섞인다.
 */

/**
 * Figma 주석: "해당 영역 클릭시 현재 선택된 센터 **이후의 3가지** 영역이 펼쳐짐".
 * 선택된 센터는 이미 펼쳐져 있으므로 그룹 크기는 1(선택) + 3(이후) = 4 다.
 */
export const GROUP_REVEAL_AFTER = 3;
export const GROUP_SPAN = 1 + GROUP_REVEAL_AFTER;

export interface CentersAccordionResult {
  activeIndex: number;
  groupOpen: boolean;
  /** 트랙 엘리먼트 — 모바일 스와이퍼에서 활성 카드를 중앙 정렬할 때 쓴다. */
  trackRef: RefObject<HTMLUListElement | null>;
  /** i 번째가 "펼친 상태"인가. 그룹 모드에서는 4장이 동시에 참이다. */
  isExpanded: (index: number) => boolean;
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
   * 끝에서 순환시킨다. 프로그레스 6칸이 "여기까지 왔다"는 위치 표시일 뿐
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
   * 그룹 창의 시작점.
   *
   * "이후 3개"를 그대로 쓰면 활성이 뒤쪽일 때 인덱스가 배열 밖으로 나간다.
   * 순환(wrap)으로 처리하면 펼친 카드가 트랙 좌우로 쪼개져 보여 아코디언이
   * 깨지므로, 창을 트랙 안쪽으로 밀어 넣는다(clamp). 활성 카드는 언제나
   * 창 안에 남는다: start ≤ active ≤ start + 3.
   */
  const groupStart = useMemo(
    () => Math.max(0, Math.min(activeIndex, count - GROUP_SPAN)),
    [activeIndex, count],
  );

  const isExpanded = useCallback(
    (index: number) =>
      groupOpen ? index >= groupStart && index < groupStart + GROUP_SPAN : index === activeIndex,
    [groupOpen, groupStart, activeIndex],
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

  return { activeIndex, groupOpen, trackRef, isExpanded, select, step, toggleGroup };
}
