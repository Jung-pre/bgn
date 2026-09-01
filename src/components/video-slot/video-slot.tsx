"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { isAppleTouchSync } from "@/shared/lib/use-media-query";
import styles from "./video-slot.module.css";

/**
 * 영상 자리 컴포넌트.
 *
 * 시안에서 3곳이 영상이다 — 브랜드 필름(`2:994`), AI 상담 오브젝트(`2:1242`),
 * Web blog 배경(`2:2400`). 전부 이걸 쓴다.
 *
 * ## 왜 컴포넌트로 빼는가
 * 영상이 아직 없다. `src` 없이도 poster 만으로 레이아웃이 완성되게 해두면
 * 영상이 도착했을 때 **prop 하나만 바꾸면 끝**난다. 교체 지점을 여기로 모은다.
 *
 * ## 성능 (이 사이트에서 가장 큰 용량 요인)
 * - `preload="none"` — 스크롤해서 도달하기 전에는 바이트를 안 받는다.
 * - IntersectionObserver 로 **화면 밖이면 pause**. 영상 3개가 동시에 디코딩되면
 *   저사양 모바일에서 그대로 무너진다.
 * - `prefers-reduced-motion` 이면 재생하지 않고 poster 만 보여준다.
 *
 * ## 재생 규칙 — "화면에 오면 **0초부터**, 있는 동안 무한 루프, 나가면 정지"
 * `loop` 만 켜면 화면을 벗어났다 돌아왔을 때 **끊긴 지점부터** 이어진다.
 * 브랜드 필름처럼 도입부가 연출의 전부인 영상은 그러면 매번 다른 장면으로
 * 시작해 첫인상이 무너진다. 그래서 다시 들어올 때 `currentTime = 0` 을 찍는다
 * (`restartOnEnter`). 화면 안에 있는 동안의 반복은 그대로 `loop` 가 맡는다.
 */
export interface VideoSlotProps {
  /** 영상 URL(mp4). 없으면 poster 만 렌더된다 */
  src?: string;
  /**
   * 같은 영상의 WebM(VP9) 판본. 있으면 **먼저** 시도한다.
   * 크롬·엣지·파이어폭스는 이걸 받고(같은 화질에 30~40% 작다), H.264 만 되는
   * 브라우저는 자동으로 `src` 로 떨어진다. 그래서 mp4 는 항상 있어야 한다.
   */
  srcWebm?: string;
  /** 항상 필요. 영상이 없을 때 이게 화면을 채운다 */
  poster?: string;
  /** 장식용이면 true — 스크린리더에서 숨긴다 */
  decorative?: boolean;
  /** 접근성 라벨 (decorative 가 아닐 때) */
  label?: string;
  loop?: boolean;
  muted?: boolean;
  /** 화면에 들어오면 자동 재생. 브랜드 필름·배경 영상은 true */
  autoPlayInView?: boolean;
  /** 화면에 다시 들어올 때 처음(0초)부터 재생. 끊긴 지점부터 잇지 않는다 */
  restartOnEnter?: boolean;
  className?: string;
  /** 화면 밖 판정 여유. 배경 영상은 넉넉히 */
  rootMargin?: string;
  /**
   * `<video>` 인라인 배경. iOS 는 CSS `background` 를 비디오 레이어에
   * 안 그리는 경우가 있어, 흰 바탕 클립은 여기로 넣는다.
   */
  videoBackground?: string;
}

/** `useSyncExternalStore` 용 상수 — 렌더마다 새 함수면 커밋마다 재구독한다 */
const subscribeNever = () => () => {};
const returnFalse = () => false;

export function VideoSlot({
  src,
  srcWebm,
  poster,
  decorative = false,
  label,
  loop = true,
  muted = true,
  autoPlayInView = true,
  restartOnEnter = true,
  className,
  rootMargin = "200px 0px",
  videoBackground,
}: VideoSlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  /**
   * iOS 는 `<source type="video/webm">` 을 고른 뒤 VP9 알파를 검정으로 채운다.
   * 폴백이 안 일어나므로 처음부터 WebM 을 넣지 않는다.
   */
  /* subscribe·서버 스냅샷은 모듈 상수다 — 인라인이면 렌더마다 재구독한다 */
  const allowWebm = useSyncExternalStore(
    subscribeNever,
    () => Boolean(srcWebm) && !isAppleTouchSync(),
    returnFalse,
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), {
      rootMargin,
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src || !autoPlayInView) return;

    /* `{ once: true }` 라도 **메타데이터가 오기 전에 화면 밖으로 나가면**
       리스너가 그대로 남는다. 들락날락할 때마다 한 겹씩 쌓이고, 한참 뒤에
       메타데이터가 도착하면 보고 있던 영상을 0초로 되감아 버린다. */
    let rewindOnMeta: (() => void) | undefined;

    // 동작 줄이기: 재생하지 않는다. poster 가 그대로 남는다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (inView) {
      if (restartOnEnter) {
        /**
         * ⚠️ `preload="none"` 이라 처음 들어올 때는 아직 메타데이터가 없다
         * (`readyState === HAVE_NOTHING`). 그 상태에서 `currentTime` 을 쓰면
         * 브라우저에 따라 무시되거나 InvalidStateError 를 던진다. 어차피
         * 첫 재생은 0초에서 시작하므로, **되감기가 실제로 필요한 경우에만** 쓴다.
         */
        if (v.readyState > 0 && v.currentTime > 0) v.currentTime = 0;
        else if (v.readyState === 0) {
          // 메타데이터가 도착한 뒤 한 번만 0 으로 맞춘다(두 번째 진입 이후 대비)
          rewindOnMeta = () => {
            v.currentTime = 0;
          };
          v.addEventListener("loadedmetadata", rewindOnMeta, { once: true });
        }
      }
      // 자동재생이 막히는 경우가 있다(저전력 모드 등). 실패해도 poster 가 있으니 조용히 넘긴다.
      v.play().catch(() => {});
    } else {
      v.pause();
    }

    return () => {
      if (rewindOnMeta) v.removeEventListener("loadedmetadata", rewindOnMeta);
    };
  }, [inView, src, autoPlayInView, restartOnEnter]);

  return (
    <div
      ref={hostRef}
      className={clsx(styles.root, videoBackground && styles.open, className)}
      aria-hidden={decorative || undefined}
    >
      {src ? (
        <video
          ref={videoRef}
          className={styles.video}
          poster={poster}
          preload="none"
          loop={loop}
          muted={muted}
          playsInline
          aria-label={decorative ? undefined : label}
          style={videoBackground ? { backgroundColor: videoBackground } : undefined}
        >
          {/* 순서가 곧 우선순위다 — 브라우저는 위에서부터 재생 가능한 첫 항목을 고른다 */}
          {allowWebm && srcWebm ? <source src={srcWebm} type="video/webm" /> : null}
          <source src={src} type="video/mp4" />
        </video>
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- 배경 풀블리드라 next/image 최적화 이점이 없다
        <img className={styles.video} src={poster} alt={decorative ? "" : (label ?? "")} />
      ) : (
        /* 영상도 poster 도 없는 현재 상태 — 자리만 잡아둔다.
           에셋이 오면 이 분기는 자연히 사라진다. */
        <div className={styles.placeholder} data-video-placeholder />
      )}
    </div>
  );
}
