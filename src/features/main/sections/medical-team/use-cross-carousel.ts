"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * 의료진 "교차 스와이퍼"의 상태 + 드래그 + 카드 배치 계산.
 *
 * Figma 주석(`2:1016`) 원문: **"8명 의료진 배치, 스와이퍼 교차하며 카드 이동"**.
 * 트랙이 통째로 평행이동하는 캐러셀이 아니라, 카드들이 서로 **엇갈리며** 지나가야 한다.
 * 아래 `crossLayout()` 이 그 배치를 담당한다.
 */

/** 좌우로 보이는 카드 수. 이보다 멀면 opacity 0 → 루프 이음매가 안 보인다. */
const VISIBLE_DEPTH = 3;
/** 멀어질수록 작아지는 정도 */
const SCALE_STEP = 0.075;
const OPACITY_STEP = 0.24;
/** 부채꼴 기울기(deg/장) — 시안 2:3143 의 겹침 배치가 부채꼴이다 */
const TILT_DEG = 2.2;

/** 드래그 확정 임계값 — 뷰포트 비율과 최소 px 중 큰 쪽 */
const DRAG_COMMIT_RATIO = 0.08;
const DRAG_COMMIT_MIN_PX = 48;
/** 손가락을 그대로 따라가면 8장짜리 덱이 너무 멀리 밀린다 */
const DRAG_RESISTANCE = 0.6;
/** 이만큼 이상 움직였으면 "클릭"이 아니라 "드래그"로 본다 */
const CLICK_SUPPRESS_PX = 6;

export interface CrossCardLayout {
  /** 카드에 그대로 넘길 인라인 스타일(전부 CSS 변수 — 실제 길이는 CSS 토큰이 정한다) */
  style: CSSProperties;
  /** 화면 밖(투명) 카드인가 — a11y 트리와 탭 순서에서 뺀다 */
  hidden: boolean;
}

/**
 * 카드 한 장의 배치.
 *
 * ## "교차"를 만드는 방법 — 왜 홀/짝 레인인가
 * 후보가 둘이었다:
 *   (A) 홀/짝 카드의 y 를 반대로 주기
 *   (B) 활성 기준 좌우가 z·scale·y 로 겹치며 지나가는 코버플로우 변형
 * **둘을 합쳤다.** (B) 만으로는 카드가 결국 한 줄 위를 미끄러져 "교차"로 안 읽히고,
 * (A) 만으로는 겹침(시안 2:3143 의 40px overlap)이 표현되지 않는다.
 *
 * 레인 부호는 **활성 인덱스가 아니라 카드 자신의 인덱스 홀짝**에 묶는다.
 * 그래야 이웃한 두 장이 항상 서로 다른 레인에 있고, 덱이 한 칸 밀릴 때
 * 위·아래 서로 다른 높이로 **엇갈려** 지나간다. offset 홀짝에 묶으면
 * 같은 카드가 이동마다 위아래로 까딱거려 교차가 아니라 진동으로 보인다.
 *
 * 활성 카드(depth 0)만 레인 진폭 0 → 항상 중앙에 정렬된다.
 */
export function crossLayout(index: number, activeIndex: number, count: number): CrossCardLayout {
  const offset = signedOffset(index, activeIndex, count);
  const depth = Math.abs(offset);
  const hidden = depth > VISIBLE_DEPTH;

  // 레인 진폭: 0 → 1 → 1.4 → 1.8. 선형으로 두면 바깥 카드가 너무 내려간다.
  const laneDepth = depth === 0 ? 0 : 0.6 + depth * 0.4;
  const lane = index % 2 === 0 ? 1 : -1;

  return {
    hidden,
    style: {
      "--offset": offset,
      "--lane": lane * laneDepth,
      "--tilt": offset * TILT_DEG,
      "--lift": depth === 0 ? 1 : 0,
      "--scale": (1 - depth * SCALE_STEP).toFixed(3),
      "--opacity": hidden ? 0 : (1 - depth * OPACITY_STEP).toFixed(2),
      // 페이지 레이어(globals.css --z-*)와 무관한 덱 내부 순서다.
      zIndex: count - depth,
    } as CSSProperties,
  };
}

/**
 * 순환 오프셋 — `-count/2 … +count/2`.
 * 8장을 0↔7 로 왕복시키면 마지막에서 처음으로 갈 때 카드가 화면을 가로지른다.
 * 최단 거리로 접으면 덱이 좌우 대칭으로 유지되고, 이음매는 depth > VISIBLE_DEPTH
 * 구간(투명)에서 일어나 눈에 띄지 않는다.
 */
function signedOffset(index: number, activeIndex: number, count: number): number {
  const raw = (((index - activeIndex) % count) + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

export interface CrossCarouselResult {
  activeIndex: number;
  select: (index: number) => void;
  step: (direction: -1 | 1) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  /** 스테이지에 그대로 스프레드하는 포인터 핸들러 묶음 */
  dragProps: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onClickCapture: (e: ReactMouseEvent<HTMLDivElement>) => void;
  };
}

/**
 * 드래그 중의 x 오프셋은 **state 로 두지 않는다.**
 * pointermove 는 120Hz 기기에서 초당 120회 들어온다. 그때마다 setState 하면
 * 8장 카드가 매번 리렌더된다. 값은 ref 에 쌓고 rAF 한 번에 CSS 변수(`--drag-x`)로
 * 흘려보낸다. state 는 "몇 번째 카드인가"가 바뀔 때만 갱신한다.
 */
export function useCrossCarousel(count: number): CrossCarouselResult {
  const [activeIndex, setActiveIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, dx: 0, moved: false, raf: 0 });

  const select = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      setActiveIndex((prev) => (prev === next ? prev : next));
    },
    [count],
  );

  const step = useCallback(
    (direction: -1 | 1) => setActiveIndex((prev) => (prev + direction + count) % count),
    [count],
  );

  const paint = useCallback(() => {
    drag.current.raf = 0;
    stageRef.current?.style.setProperty("--drag-x", `${drag.current.dx * DRAG_RESISTANCE}px`);
  }, []);

  const finish = useCallback((stage: HTMLDivElement, pointerId: number) => {
    if (drag.current.raf) cancelAnimationFrame(drag.current.raf);
    drag.current.raf = 0;
    if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
    // transition 을 다시 켠 뒤 0 으로 되돌려야 손을 뗀 자리에서 부드럽게 복귀한다.
    delete stage.dataset.dragging;
    stage.style.setProperty("--drag-x", "0px");
    drag.current.pointerId = -1;
  }, []);

  const dragProps: CrossCarouselResult["dragProps"] = {
    onPointerDown: (e) => {
      if (!e.isPrimary) return;
      // 객체를 새로 만들지 않고 필드만 갱신한다 — 아래 cleanup 이 이 객체를 캡처한다.
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
        /* 캡처는 "드래그로 확정된 뒤"에만 건다.
           pointerdown 에서 걸면 Pointer Events 스펙상 이어지는 click 이
           캡처 대상(스테이지)으로 리타깃돼 카드 버튼 클릭이 통째로 죽는다. */
        e.currentTarget.setPointerCapture(e.pointerId);
        // 드래그 중에는 스테이지 transition 을 끈다 — 켜둔 채면 손가락보다 늦게 따라온다.
        e.currentTarget.dataset.dragging = "true";
      }
      if (!state.raf) state.raf = requestAnimationFrame(paint);
    },
    onPointerUp: (e) => {
      if (drag.current.pointerId !== e.pointerId) return;
      const { dx } = drag.current;
      const threshold = Math.max(
        DRAG_COMMIT_MIN_PX,
        e.currentTarget.clientWidth * DRAG_COMMIT_RATIO,
      );
      finish(e.currentTarget, e.pointerId);
      if (Math.abs(dx) > threshold) step(dx < 0 ? 1 : -1);
    },
    onPointerCancel: (e) => {
      if (drag.current.pointerId !== e.pointerId) return;
      finish(e.currentTarget, e.pointerId);
    },
    /* 드래그로 끝난 제스처가 카드 버튼의 click 으로 이어지면
       "옆으로 밀었더니 그 카드가 선택됨" 같은 오작동이 된다. */
    onClickCapture: (e) => {
      if (!drag.current.moved) return;
      drag.current.moved = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  useEffect(() => {
    // ref 객체는 마운트 동안 교체되지 않으므로(위 Object.assign) 여기서 캡처해도 안전하다.
    const state = drag.current;
    return () => {
      if (state.raf) cancelAnimationFrame(state.raf);
    };
  }, []);

  return { activeIndex, select, step, stageRef, dragProps };
}
