"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";

/**
 * 의료진 "교차 스와이퍼"의 상태 + 드래그 + 카드 배치 계산.
 *
 * Figma 주석(`2:1016`) 원문: **"8명 의료진 배치, 스와이퍼 교차하며 카드 이동"**.
 * 트랙이 통째로 평행이동하는 캐러셀이 아니라, 카드들이 서로 **엇갈리며** 지나가야 한다.
 * 아래 `crossLayout()` 이 그 배치를 담당한다.
 */

/**
 * 좌우로 보이는 카드 수.
 * 시안 2:995 에서 화면에 걸리는 카드가 활성 기준 ±3 이다(±3 은 양끝에서 잘려 나간다).
 * 8장이면 ±4 짜리 한 장만 남는데, 그건 이미 뷰포트 밖이라 여기서 투명 처리해
 * 루프 이음매를 감춘다.
 */
const VISIBLE_DEPTH = 3;

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
 * 카드 한 장의 배치. `--offset` 은 훅이 칸 단위로 들고 있고, 여기는 그리기만 한다.
 *
 * ## 시안이 말하는 "교차"
 * 시안 2:995 는 **겹치지 않는 한 줄**이다. 카드 320, gap 32 로 나란히 놓이고
 * 홀/짝이 42px 위아래로 엇갈린 지그재그다. 회전·축소·투명도 감쇠가 전혀 없다.
 * (이전 구현의 부채꼴 코버플로우는 시안에 근거가 없어 걷어냈다. 근거로 삼았던
 *  2:3143 은 히어로 2안 잔재인 의료진 컷아웃 띠였고, 이 섹션 프레임이 아니다.)
 *
 * ## 레인은 오프셋 홀짝에 묶는다
 * 검수: "위 아래 위치 고정하지 않고 교차하며". 한 칸 밀릴 때마다 카드가
 * 옆 자리 높이로 부드럽게 바뀐다. 활성(offset 0)은 항상 위 레인.
 */
export function crossLayout(offset: number, count: number): CrossCardLayout {
  const depth = Math.abs(offset);
  const hidden = depth > VISIBLE_DEPTH;

  return {
    hidden,
    style: {
      "--offset": offset,
      // 0 = 위 레인, 1 = 아래 레인. 실제 간격은 CSS `--lane-y` 가 정한다.
      "--lane": Math.abs(offset) % 2 === 0 ? 0 : 1,
      "--opacity": hidden ? 0 : 1,
      // 페이지 레이어(globals.css --z-*)와 무관한 덱 내부 순서다.
      zIndex: count - depth,
    } as CSSProperties,
  };
}

/**
 * 순환 오프셋 — `-count/2 … +count/2`.
 * 8장이면 슬롯이 -3…+4 (또는 한 칸 이동 후 -4…+3). 가운데 이음매 한 장은
 * 화면 밖(`VISIBLE_DEPTH` 너머)에 두고, 그 자리에서만 반대편으로 점프한다.
 */
function signedOffset(index: number, activeIndex: number, count: number): number {
  const raw = (((index - activeIndex) % count) + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

function initialOffsets(count: number): number[] {
  return Array.from({ length: count }, (_, i) => signedOffset(i, 0, count));
}

/** 화면 밖 한 칸 — 여기서 루프 이음매가 일어난다. */
const EXIT_SLOT = VISIBLE_DEPTH + 1;

/** 자동 롤링 간격. 카드 transition(0.62s) 이 끝난 뒤 읽을 시간을 남긴다. */
const AUTO_MS = 3200;

export interface CrossCarouselResult {
  activeIndex: number;
  /** 카드별 칸 오프셋. 레이아웃은 이 값으로만 그린다(최단거리 재계산 금지). */
  offsets: number[];
  select: (index: number) => void;
  step: (direction: -1 | 1) => void;
  pause: () => void;
  resume: () => void;
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
  const [offsets, setOffsets] = useState(() => initialOffsets(count));
  const [paused, setPaused] = useState(false);
  /** 화면 밖에서는 롤링하지 않는다. 히어로를 지나는 동안 2번으로 넘어가는 걸 막는다. */
  const [inView, setInView] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, dx: 0, moved: false, raf: 0 });
  const offsetsRef = useRef(offsets);
  const activeRef = useRef(activeIndex);
  const pendingRef = useRef(0);
  const wrappingRef = useRef(false);
  const wrapRafRef = useRef(0);
  const flushRef = useRef<() => void>(() => {});

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  const commitShift = useCallback(
    (dir: -1 | 1, from: number[]) => {
      const shifted = from.map((o) => o - dir);
      offsetsRef.current = shifted;
      setOffsets(shifted);
      const next = (activeRef.current + dir + count) % count;
      activeRef.current = next;
      setActiveIndex(next);
    },
    [count],
  );

  /**
   * 한 칸 이동.
   *
   * 최단거리 `signedOffset` 으로 매 프레임 다시 그리면, 왼쪽 끝(-3)에 있던 카드가
   * 다음 칸에서 오른쪽(+4)으로 **화면을 가로질러** 날아간다. 사용자는 무한
   * 롤링인데 뒤에서 한 장이 지나가는 걸로 읽힌다.
   *
   * 빠져나가는 칸(`-4`/`+4`, 이미 투명)에 있는 카드만 반대편 같은 칸으로
   * 순간이동한 다음, 전체가 한 칸 미끄러지게 한다.
   */
  const runStep = useCallback(
    (dir: -1 | 1) => {
      const current = offsetsRef.current;
      const teleported = current.map((o) => {
        if (dir === 1 && o === -EXIT_SLOT) return o + count;
        if (dir === -1 && o === EXIT_SLOT) return o - count;
        return o;
      });
      const didTeleport = teleported.some((o, i) => o !== current[i]);

      if (!didTeleport) {
        commitShift(dir, current);
        wrappingRef.current = false;
        flushRef.current();
        return;
      }

      wrappingRef.current = true;
      const stage = stageRef.current;
      if (stage) stage.dataset.snap = "true";
      offsetsRef.current = teleported;
      setOffsets(teleported);

      const paintShift = () => {
        wrapRafRef.current = 0;
        if (stage) delete stage.dataset.snap;
        commitShift(dir, teleported);
        wrappingRef.current = false;
        flushRef.current();
      };

      /* 텔레포트가 페인트된 뒤에 transition 을 다시 켠다.
         rAF 하나로는 스타일이 커밋되기 전에 shift 가 붙어 이음매가 다시 보인다. */
      wrapRafRef.current = requestAnimationFrame(() => {
        wrapRafRef.current = requestAnimationFrame(paintShift);
      });
    },
    [count, commitShift],
  );

  const flush = useCallback(() => {
    if (wrappingRef.current || count < 2) return;
    const pending = pendingRef.current;
    if (pending === 0) return;
    const dir: -1 | 1 = pending > 0 ? 1 : -1;
    pendingRef.current -= dir;
    runStep(dir);
  }, [count, runStep]);

  useLayoutEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const step = useCallback(
    (direction: -1 | 1) => {
      if (count < 2) return;
      pendingRef.current += direction;
      flush();
    },
    [count, flush],
  );

  const select = useCallback(
    (index: number) => {
      if (count < 2) return;
      const next = ((index % count) + count) % count;
      const delta = offsetsRef.current[next] ?? 0;
      if (delta === 0) return;
      const dir: -1 | 1 = delta > 0 ? 1 : -1;
      pendingRef.current += dir * Math.abs(delta);
      flush();
    },
    [count, flush],
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
      if (wrapRafRef.current) cancelAnimationFrame(wrapRafRef.current);
    };
  }, []);

  /**
   * 롤링은 의료진이 **화면의 주인공이 된 뒤**에만 시작한다.
   * 마운트와 동시에 interval 을 켜면 히어로 pin(200vh) 을 지나오는 동안
   * 이미 한 칸 이상 넘어, 도착했을 때 2번 카드가 켜져 있다.
   * 등장 트윈(`top 50%`)과 맞춰 스테이지가 반 이상 보인 뒤에만 켠다.
   */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (count < 2 || paused || !inView || prefersReducedMotionSync()) return;

    const tick = () => {
      if (document.hidden || drag.current.pointerId !== -1) return;
      pendingRef.current += 1;
      flushRef.current();
    };
    const id = window.setInterval(tick, AUTO_MS);
    return () => window.clearInterval(id);
  }, [count, paused, inView]);

  return { activeIndex, offsets, select, step, pause, resume, stageRef, dragProps };
}
