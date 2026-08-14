"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
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
 */
export interface VideoSlotProps {
  /** 영상 URL. 없으면 poster 만 렌더된다(= 현재 상태) */
  src?: string;
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
  className?: string;
  /** 화면 밖 판정 여유. 배경 영상은 넉넉히 */
  rootMargin?: string;
}

export function VideoSlot({
  src,
  poster,
  decorative = false,
  label,
  loop = true,
  muted = true,
  autoPlayInView = true,
  className,
  rootMargin = "200px 0px",
}: VideoSlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);

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

    // 동작 줄이기: 재생하지 않는다. poster 가 그대로 남는다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (inView) {
      // 자동재생이 막히는 경우가 있다(저전력 모드 등). 실패해도 poster 가 있으니 조용히 넘긴다.
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [inView, src, autoPlayInView]);

  return (
    <div
      ref={hostRef}
      className={clsx(styles.root, className)}
      aria-hidden={decorative || undefined}
    >
      {src ? (
        <video
          ref={videoRef}
          className={styles.video}
          src={src}
          poster={poster}
          preload="none"
          loop={loop}
          muted={muted}
          playsInline
          aria-label={decorative ? undefined : label}
        />
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
