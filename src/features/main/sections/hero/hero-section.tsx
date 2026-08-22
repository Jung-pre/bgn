"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/shared/lib/gsap";
import {
  prefersReducedMotionSync,
  useIsMobileLayout,
  usePrefersReducedMotion,
} from "@/shared/lib/use-media-query";
import { usePinnedProgress } from "@/features/main/sections/common/use-pinned-progress";
import { useSceneActive } from "@/r3f/use-scene-active";
import { Marquee } from "@/components/marquee/marquee";
import type { HeroSectionMessages } from "@/shared/i18n/messages";
import {
  HERO_ASSETS,
  HERO_ASSETS_READY,
  TOWER_CLOUD_BANDS,
  TOWER_CLOUD_TOP_OFFSET,
  TOWER_CLOUDS_TOP,
  TOWER_LINES,
  TOWER_STAGE,
  TOWER_WATERMARK,
  type TowerSprite,
} from "./hero-assets";
import styles from "./hero-section.module.css";

/**
 * 히어로 — 구체 → 타워 스크롤 전환.
 *
 * ## 구조 근거
 * 기획안(`docs/plan/09-brief.md`) 히어로 1안:
 *
 *   첫 화면   구체가 화면 중앙에서 천천히 회전
 *   스크롤    구체가 자연스럽게 사라지고 AI 스타일 롯데월드타워가 등장
 *   타워 연출  빛과 선으로 이루어진 3D 타워 + 데이터 네트워크 효과
 *
 * 즉 시안의 `메인_01-02`(구체)와 `메인_02`(타워)는 **캐러셀이 아니라 한 섹션의
 * 스크롤 전환**이다. 예전에 `brand-slogan` 으로 분리했던 타워를 여기로 흡수했다.
 *
 * ## 모션 규칙 (Figma 주석 원문)
 *   "로딩 화면 없이 진입 시 지구형태가 약간돌면서 등장 후
 *    마우스 포인터에 맞춰 빛 요소가 움직이도록"
 *
 * → **로딩 화면 금지.** 텍스트는 즉시 렌더하고 3D 만 준비되면 페이드인한다.
 *
 * ## 진행도 분배
 *   0.00 ~ 0.45  구체 유지 (회전 + 포인터 추종)
 *   0.45 ~ 0.70  크로스페이드 (구체 out / 타워 in)
 *   0.70 ~ 1.00  타워 유지 (회전)
 *
 * 매 프레임 값은 `progressRef` 로만 흐른다. state 는 장면 인덱스가 바뀔 때만.
 */

const SphereScene = dynamic(() => import("./scene-sphere").then((m) => m.SphereScene), {
  ssr: false,
});

/** 크로스페이드 구간 경계 */
const FADE_START = 0.45;
const FADE_END = 0.7;

/**
 * 광선 스프라이트를 겹침(`repeat`)까지 펼친 평면 목록.
 *
 * 원본 띠와 광택 띠가 **같은 인덱스**를 써야 드리프트·스크롤 오프셋이 어긋나지
 * 않는다. 어긋나면 같은 그림이 두 장 겹쳐 보인다.
 */
const LINE_SPRITES: readonly TowerSprite[] = TOWER_LINES.flatMap((s) =>
  Array.from({ length: s.repeat ?? 1 }, () => s as TowerSprite),
);

/**
 * 띠별 스크롤 패럴랙스 (`[data-line]` 인덱스 순).
 *
 * 그룹 전체(`pxLinesRef`)가 이미 한 덩어리로 흐른다. 여기 값은 그 위에 얹는
 * **띠마다 다른 여벌**이다. 이게 없으면 넷이 판때기처럼 같은 속도로 미끄러져서
 * 시안의 "실크가 서로 스쳐 지나가는" 인상이 안 난다.
 *
 * ⚠️ 단위는 **스프라이트 자기 박스 대비 %** 다. 띠 폭이 스테이지의 1.2~1.9배라
 *    스테이지 % 로 읽으면 실제 이동량이 두 배 가까이 커진다.
 *
 *   0 line-3  가장 크고 멀다              → 느리게
 *   1 line-1  채도 높은 리본              → 반대 방향
 *   2 line-2  파스텔 리본 (2겹 중 1)
 *   3 line-2  파스텔 리본 (2겹 중 2)      → 같은 그림이라 더 벌려 겹침을 푼다
 *   4 line-9  점묘 웨이브, 가장 가깝다    → 가장 빠르게, 반대 방향
 *
 * ⚠️ 2026-08: 띠 전체가 흐르는 방향을 **오른쪽으로 뒤집었다**(그룹 X 부호 포함).
 *    부호를 되돌릴 땐 아래 `shift(pxLinesRef...)` 의 X 도 같이 뒤집어야 한다 —
 *    둘이 어긋나면 띠끼리 서로를 상쇄해 움직임이 거의 안 보인다.
 */
const LINE_SCROLL = [
  { x: -1.2, y: -0.8, r: -0.25 },
  { x: 1.8, y: 1.3, r: 0.4 },
  { x: -1.8, y: -1.5, r: -0.35 },
  { x: -2.6, y: -2.1, r: -0.5 },
  { x: 2.8, y: 1.9, r: 0.55 },
] as const;

export interface HeroSectionProps {
  messages: HeroSectionMessages;
}

export function HeroSection({ messages }: HeroSectionProps) {
  const isMobile = useIsMobileLayout();
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sphereLayerRef = useRef<HTMLDivElement>(null);
  const towerLayerRef = useRef<HTMLDivElement>(null);
  const copySphereRef = useRef<HTMLDivElement>(null);
  const copyTowerRef = useRef<HTMLDivElement>(null);
  /**
   * 마퀴는 **구체 씬에만** 있다. 시안 타워 프레임(8:733)에는 마퀴가 없다.
   * 계속 떠 있으면 타워 카피와 겹쳐서 시안보다 훨씬 시끄럽다.
   */
  const marqueeRef = useRef<HTMLDivElement>(null);

  /**
   * 타워 씬 패럴랙스 래퍼들. 매 프레임 transform 만 쓰므로 전부 ref 다.
   * 배열이 아니라 개별 ref 인 이유는 레이어마다 속도가 달라서다(= 깊이감).
   */
  const pxParticlesRef = useRef<HTMLDivElement>(null);
  const pxCloudTopRef = useRef<HTMLDivElement>(null);
  const pxWatermarkRef = useRef<HTMLDivElement>(null);
  const pxBandRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const pxTowerRef = useRef<HTMLDivElement>(null);
  const pxLinesRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const stageClipRef = useRef<HTMLDivElement>(null);

  /**
   * 띠별 스크롤 오프셋을 쓸 DOM 노드 캐시.
   * `onProgress` 는 매 프레임 돌기 때문에 거기서 `querySelectorAll` 을 하면 안 된다.
   */
  const lineNodesRef = useRef<HTMLElement[] | null>(null);

  /** `prefersReducedMotionSync` 는 SSR 에서 못 부르므로 첫 프레임에 한 번만 캐시한다 */
  const reducedRef = useRef<boolean | null>(null);

  /**
   * 타워 레이어 마운트 게이트.
   *
   * 타워 씬은 20장 넘는 대형 WebP 합성이라 히어로 첫 화면에서 같이 디코딩하면
   * 구체가 뜨기도 전에 메인 스레드를 잡아먹는다. 크로스페이드(0.45)보다
   * 한참 앞선 0.12 에서 **딱 한 번** state 를 뒤집어 마운트한다.
   * (매 프레임 setState 금지 규칙은 ref 가드로 지킨다)
   */
  const [towerMounted, setTowerMounted] = useState(false);
  const towerMountedRef = useRef(false);

  /**
   * 히어로는 첫 화면이라 "보이면 켜기"로 충분해 보이지만, 여유를 준다.
   * 핀 구간 200vh 동안 캔버스 호스트가 뷰포트 경계에 딱 붙어 움직여서
   * margin 0 이면 경계에서 on/off 가 떨리고, 그때마다 셰이더 프로그램이
   * 다시 올라간다. 반 화면이면 떨림이 사라진다.
   */
  const sceneActive = useSceneActive(canvasHostRef, { rootMargin: "50% 0px 50% 0px" });

  /**
   * 스크롤 → 진행도. 인덱스는 0(구체) / 1(타워) 두 단계뿐이라
   * `steps: 2` 로 두고 실제 크로스페이드는 progress 로 직접 그린다.
   */
  const { sectionRef, pinRef, progressRef } = usePinnedProgress({
    steps: 2,
    scrub: 1,
    onProgress: (p) => {
      // ⚠️ 매 프레임 호출된다. setState 금지. 스타일만 직접 쓴다.
      const t = clamp01((p - FADE_START) / (FADE_END - FADE_START));
      const sphere = sphereLayerRef.current;
      const tower = towerLayerRef.current;
      if (sphere) {
        sphere.style.opacity = String(1 - t);
        sphere.style.transform = `scale(${1 + t * 0.12})`;
      }
      if (tower) {
        tower.style.opacity = String(t);
        tower.style.transform = `scale(${1.08 - t * 0.08})`;
      }
      const cs = copySphereRef.current;
      const ct = copyTowerRef.current;
      if (cs) cs.style.opacity = String(1 - clamp01(t * 1.6));
      if (ct) ct.style.opacity = String(clamp01((t - 0.35) * 2));
      // 마퀴는 구체 카피와 같은 곡선으로 빠진다(시안 타워 프레임에 마퀴가 없다)
      const mq = marqueeRef.current;
      if (mq) mq.style.opacity = String(1 - clamp01(t * 1.6));

      // 타워 에셋을 미리 마운트해 크로스페이드 때 디코딩이 안 걸리게 한다
      if (!towerMountedRef.current && p > 0.12) {
        towerMountedRef.current = true;
        setTowerMounted(true);
      }

      /**
       * 패럴랙스 — 타워가 등장한 뒤 구간(0.45~1)을 다시 0~1 로 편다.
       *
       * 값은 스테이지 크기 대비 %다. 시안이 정지 이미지 한 장이라 정답이 없어서,
       * "가까운 것일수록 빨리 / 반대 방향으로도 흐르게" 라는 원칙만 잡았다.
       *   타워(가장 멀다) < 파티클 < 상단 구름 < 하단 구름 띠 < 광선(가장 가깝다)
       * 광선만 X 를 반대로 보내야 서로 스쳐 지나가는 게 눈에 보인다.
       */
      if (reducedRef.current === null) reducedRef.current = prefersReducedMotionSync();
      const u = reducedRef.current ? 0 : clamp01((p - FADE_START) / (1 - FADE_START));
      shift(pxTowerRef.current, 0.6 * u, -1.1 * u);
      shift(pxParticlesRef.current, 0, 1.8 * u);
      shift(pxCloudTopRef.current, -2.4 * u, -1.6 * u);
      /* 워터마크는 타워와 같은 깊이감으로 — 가장 멀리 있는 축에 가깝게 아주 조금만 */
      shift(pxWatermarkRef.current, 0.9 * u, -1.3 * u);
      shift(pxBandRefs[0]?.current ?? null, 3.6 * u, 2.6 * u);
      shift(pxBandRefs[1]?.current ?? null, 2.0 * u, 1.4 * u);
      shift(pxBandRefs[2]?.current ?? null, 2.8 * u, 2.0 * u);
      shift(pxLinesRef.current, 4.5 * u, 1.0 * u);

      /* 띠마다 여벌 오프셋 — 그룹 하나만 흘리면 넷이 한 덩어리로 미끄러진다.
         원본과 광택이 같은 `data-line` 을 쓰므로 둘은 언제나 같이 움직인다. */
      const lineNodes = lineNodesRef.current;
      if (lineNodes) {
        for (const el of lineNodes) {
          const k = LINE_SCROLL[Number(el.dataset.line) % LINE_SCROLL.length];
          if (k) shiftRotate(el, k.x * u, k.y * u, k.r * u);
        }
      }
    },
    /**
     * ⚠️ 여기에 `isMobile` 을 넣으면 안 된다.
     *
     * `useIsMobileLayout` 은 SSR 스냅샷이 false 라서 모바일에서는 하이드레이션 직후
     * false → true 로 한 번 뒤집힌다. 이걸 의존성에 넣으면 그 순간 ScrollTrigger 를
     * 죽였다 다시 만드는데, pin-spacer 가 겹쳐 쌓이면서 섹션이 한 화면 아래로 밀린다.
     * (모바일 히어로가 통째로 빈 화면이던 원인)
     *
     * 위 `onProgress` 는 ref 로만 DOM 스타일을 쓰고 isMobile 을 읽지 않는다.
     * 반응형 차이는 전부 CSS 미디어쿼리가 처리하므로 의존성 자체가 필요 없다.
     */
    dependencies: [],
  });

  /**
   * 띠 노드 수집 — 타워 레이어가 마운트된 뒤 한 번만.
   *
   * `[data-line]` 은 원본 띠와 광택 띠 양쪽에 같은 인덱스로 붙어 있어서 한 번에
   * 모으면 둘이 자동으로 같은 오프셋을 받는다.
   */
  useEffect(() => {
    const root = stageClipRef.current;
    lineNodesRef.current = root
      ? Array.from(root.querySelectorAll<HTMLElement>("[data-line]"))
      : null;
  }, [towerMounted]);

  /** 진입 인트로 — ScrollTrigger 없이 즉시. 로딩 화면을 두지 않는다. */
  useGSAP(
    () => {
      const chars = gsap.utils.toArray<HTMLElement>("[data-hero-char]");
      const fades = gsap.utils.toArray<HTMLElement>("[data-hero-fade]");

      if (prefersReducedMotionSync()) {
        gsap.set([...chars, ...fades], { autoAlpha: 1, y: 0, clearProps: "all" });
        return;
      }

      gsap.set(chars, { autoAlpha: 0, y: 40 });
      gsap.set(fades, { autoAlpha: 0, y: 16 });

      const stagger = 0.075;
      const tl = gsap.timeline({ delay: 0.12, defaults: { ease: "power3.out" } });
      tl.to(chars, { autoAlpha: 1, y: 0, duration: 0.6, stagger }, 0).to(
        fades,
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 },
        stagger * Math.max(0, chars.length - 1) + 0.15,
      );
    },
    { scope: sectionRef },
  );

  /**
   * 실크 띠 아이들 모션.
   *
   * ## 왜 셰이더가 아니라 이미지인가
   * 한동안 이 자리를 R3F 셰이더 리본으로 그렸는데, 시안의 실크가 가진
   * "가닥의 굵기·밀도·색 얼룩"을 절차적으로 재현하는 데 실패했다. 시안 PNG 는
   * 이미 그 정보를 전부 갖고 있다. **그림은 그대로 쓰고 움직임만 붙이는 게**
   * 결과가 낫다.
   *
   * ## 어떻게 움직이나
   * 1. 띠마다 다른 주기로 아주 느리게 떠다닌다(drift). 주기를 서로 나눠떨어지지
   *    않게 잡아야 넷이 한 덩어리로 출렁이지 않는다.
   * 2. 같은 띠를 한 겹 더 얹고 **그라디언트 마스크를 옆으로 흘려** 광택을 만든다.
   *    빛이 실크를 타고 지나가는 인상이 여기서 나온다.
   *
   * 둘 다 GPU 합성만 쓰므로(transform / mask-position) 레이아웃을 건드리지 않는다.
   *
   * ⚠️ **스크롤 연동은 여기가 아니다.** `onProgress` 의 `LINE_SCROLL` 이 맡는다.
   *    같은 요소에 GSAP 과 ref 가 함께 `transform` 을 쓰면 나중 것이 앞을 지운다.
   */
  useGSAP(
    () => {
      if (!towerMounted) return;
      if (prefersReducedMotionSync()) return;

      const drifts = gsap.utils.toArray<HTMLElement>("[data-drift]");
      /* 띠마다 다른 진폭·주기. 소수점을 어긋뜨려 최소공배수를 길게 만든다. */
      const PLAN = [
        { x: 1.1, y: -0.9, r: 0.35, s: 1.012, d: 17.3 },
        { x: -1.4, y: 0.7, r: -0.28, s: 1.016, d: 23.1 },
        { x: 0.9, y: 1.2, r: 0.22, s: 1.01, d: 19.7 },
        { x: -0.8, y: -1.1, r: -0.34, s: 1.014, d: 26.5 },
        { x: 1.3, y: 0.6, r: 0.3, s: 1.011, d: 21.2 },
        { x: -1.0, y: -0.7, r: -0.25, s: 1.013, d: 29.4 },
      ] as const;

      for (const el of drifts) {
        /* 배열 순서가 아니라 `data-drift` 값으로 고른다 — 원본 띠와 광택 띠가
           같은 인덱스를 공유해야 둘이 똑같이 흔들린다. */
        const i = Number(el.dataset.drift ?? 0);
        const k = PLAN[i % PLAN.length];
        if (!k) continue;
        gsap.to(el, {
          /* % 단위 — 뷰포트가 커져도 같은 비율로 흔들린다 */
          xPercent: k.x,
          yPercent: k.y,
          rotation: k.r,
          scale: k.s,
          duration: k.d,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          /* 시작 위상을 어긋뜨린다. 없으면 전부 같은 순간에 방향을 바꾼다. */
          delay: -i * 3.7,
        });
      }

      const sheen = sheenRef.current;
      if (!sheen) return;
      /* 마스크 위치를 CSS 변수로 흘린다. `repeatDelay` 로 뜸을 들여야
         "가끔 빛이 지나간다"가 되지, 계속 돌면 그냥 배경 루프로 보인다. */
      /* 0~100 밖으로 나가면 마스크 박스 모서리가 화면에 들어와 빛줄기가
         직선으로 잘린다 — 근거는 `.lineSheen` 주석 참고. 범위를 넘기지 말 것. */
      gsap.fromTo(
        sheen,
        { "--sheen": 100 },
        {
          "--sheen": 0,
          duration: 4.2,
          ease: "sine.inOut",
          repeat: -1,
          repeatDelay: 3.4,
          delay: 1.2,
        },
      );
    },
    { scope: sectionRef, dependencies: [towerMounted] },
  );

  const sphereSlide = messages.slides[0];
  const towerSlide = messages.slides[1] ?? messages.slides[0];

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      /* 구체 → 타워 전환에 스크롤 2화면을 쓴다 */
      style={{ height: "200vh" }}
      aria-label="Hero"
    >
      <div ref={pinRef} className={styles.pinShell}>
        {/* ── 배경 레이어 ─────────────────────────────────────────────── */}
        <div ref={sphereLayerRef} className={styles.sphereLayer} aria-hidden>
          <div className={styles.sphereBg} />
          <div ref={canvasHostRef} className={styles.canvasHost}>
            <SphereScene active={sceneActive} progressRef={progressRef} />
          </div>
        </div>

        {/* 타워 씬 — Figma 메인_02(8:2877) 1920×920 합성 재현.
            아래에서 위로: 하늘 → 파티클 텍스처 → 상단 구름 → 하단 구름 띠 → 타워 → 광선.
            시안에서는 타워/광선이 카피 위에 있지만, 65% 타워가 본문을 덮으면
            가독성이 떨어져서 카피는 그대로 위(z-content)에 둔다. */}
        <div ref={towerLayerRef} className={styles.towerLayer} aria-hidden>
          <div className={styles.towerSky} />
          {HERO_ASSETS_READY && towerMounted ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.towerSkyImg}
                src={HERO_ASSETS.sky}
                alt=""
                decoding="async"
                loading="eager"
              />

              <div className={styles.towerStage}>
                {/* 파티클 텍스처 — 8:2880 */}
                <div
                  ref={pxParticlesRef}
                  className={clsx(styles.px, styles.softLight, styles.particlesPx)}
                >
                  <div className={styles.particlesBox}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.particlesImg}
                      src={HERO_ASSETS.particles}
                      alt=""
                      decoding="async"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* 상단 구름 — 8:2881 과 그 평행이동 복사본 8:2892 */}
                <div ref={pxCloudTopRef} className={clsx(styles.px, styles.cloudTop)}>
                  {TOWER_CLOUDS_TOP.map((s) => (
                    <TowerSpriteImg key={s.node} sprite={s} />
                  ))}
                  {TOWER_CLOUDS_TOP.map((s) => (
                    <TowerSpriteImg
                      key={`dup-${s.node}`}
                      sprite={{
                        ...s,
                        x: s.x + TOWER_CLOUD_TOP_OFFSET.x,
                        y: s.y + TOWER_CLOUD_TOP_OFFSET.y,
                      }}
                    />
                  ))}
                </div>

                {/* `BGn` 워터마크 — 8:759. 시안 z-순서가 상단 구름과 하단 구름 띠
                 **사이**라 여기 놓는다. 타워보다 뒤이므로 첨탑에 가려진다. */}
                <div ref={pxWatermarkRef} className={styles.px}>
                  <TowerSpriteImg sprite={TOWER_WATERMARK} />
                </div>

                {/* 하단 구름 띠 — 8:2904 의 세 덩어리. 각각 다른 속도로 흐른다 */}
                {TOWER_CLOUD_BANDS.map((band, i) => (
                  <div
                    key={band[0]?.node ?? i}
                    ref={pxBandRefs[i]}
                    className={clsx(styles.px, styles.cloudBand)}
                    data-band={i}
                  >
                    {band.map((s) => (
                      <TowerSpriteImg key={s.node} sprite={s} />
                    ))}
                  </div>
                ))}

                {/* 타워 — 8:2946 */}
                <div ref={pxTowerRef} className={styles.px}>
                  <div className={styles.towerCrop}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.towerPic}
                      src={HERO_ASSETS.tower}
                      alt=""
                      decoding="async"
                      loading="eager"
                    />
                  </div>
                </div>

                {/* 광선/웨이브 — 8:2949. 시안에서 프레임 마스크로 잘려 있다.
                    clip 을 패럴랙스 래퍼 바깥에 둬야 잘리는 사각형이 안 움직인다.

                    셰이더 리본을 쓸 수 있으면 정지 PNG 대신 캔버스를 올린다.
                    둘을 겹치면 같은 그림이 두 장 보이므로 **배타적으로** 렌더한다. */}
                <div ref={stageClipRef} className={styles.stageClip}>
                  <div ref={pxLinesRef} className={styles.px}>
                    {LINE_SPRITES.map((s, i) => (
                      <TowerSpriteImg key={`${s.node}-${i}`} sprite={s} drift={i} />
                    ))}

                    {/* 광택 — 같은 띠를 한 겹 더 얹고 **움직이는 그라디언트 마스크**로
                        가늘게 오려낸다. 빛이 실크를 타고 지나가는 것처럼 보인다.

                        ⚠️ 원본과 **같은 패럴랙스 래퍼 안**에 둔다. 밖에 두면 스크롤이
                        진행될수록 원본만 흘러가고 광택은 제자리에 남아서, 같은 띠가
                        두 장 겹쳐 보이는 유령이 생긴다. */}
                    <div ref={sheenRef} className={styles.lineSheen} aria-hidden>
                      {LINE_SPRITES.map((s, i) => (
                        <TowerSpriteImg key={`sheen-${s.node}-${i}`} sprite={s} drift={i} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* ── 카피 ───────────────────────────────────────────────────── */}
        <div className={styles.inner}>
          {/* 장면 1 — 세계를 향한 BGN의 도약
              Figma 2:475 : left 80 / top 160, ExtraBold 96px, BGN 만 120px 그라데이션 */}
          <div ref={copySphereRef} className={clsx(styles.copy, styles.copySphere)}>
            <p className={styles.line1} data-hero-fade>
              {sphereSlide?.eyebrow}
            </p>
            <h1
              className={styles.line2}
              aria-label={`${sphereSlide?.eyebrow} ${sphereSlide?.title}`}
            >
              <SplitBrandTitle
                title={sphereSlide?.title ?? ""}
                brand={sphereSlide?.brandToken ?? ""}
                brandClassName={styles.brandSphere}
              />
            </h1>
          </div>

          {/* 장면 2 — 세상을 선명하게 BGN 밝은눈안과
              Figma 2:3069 : BGN 160px / 밝은눈안과 138px */}
          <div ref={copyTowerRef} className={clsx(styles.copy, styles.copyTower)} aria-hidden>
            <p className={styles.towerEyebrow}>{towerSlide?.eyebrow}</p>
            <p className={styles.towerTitle}>
              <SplitBrandTitle
                title={towerSlide?.title ?? ""}
                brand={towerSlide?.brandToken ?? ""}
                brandClassName={styles.brandTower}
                animate={false}
              />
            </p>
          </div>
        </div>

        {/* 시그니처 마퀴 — Figma 2:410 : top 583, Marcellus 108px, `*` 구분자.
            래퍼는 opacity 만 맡는다 — 위치는 그대로 `.marquee` 가 갖는다
            (래퍼에 position 을 주면 absolute 기준이 바뀐다). */}
        <div ref={marqueeRef}>
          <Marquee text={messages.marquee} className={styles.marquee} outline duration={28} />
        </div>

        {/* 스크롤 인디케이터 — Figma 2:471 : left 80 / top 760, 2×128 바 + 40 흰 채움 */}
        <div className={styles.scrollHint} data-hero-fade>
          <span className={styles.scrollBar} aria-hidden>
            <span className={styles.scrollBarFill} />
          </span>
          <span className={styles.scrollLabel} lang="en">
            {messages.scrollLabel}
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * 브랜드 토큰(BGN)만 떼어내고 나머지는 글자 단위로 쪼갠다.
 *
 * Figma 에서 `B`(2:3073) / `G`(2:3074) / `N`(2:3075) 이 개별 텍스트 노드로
 * 분리돼 있다 — 글자 단위 stagger 가 디자인 의도라는 뜻이다.
 * h1 자체에는 transform 을 걸지 않는다(3D 정렬 기준이 될 수 있음).
 */
function SplitBrandTitle({
  title,
  brand,
  brandClassName,
  animate = true,
}: {
  title: string;
  brand: string;
  /** CSS 모듈 인덱스 접근은 noUncheckedIndexedAccess 에서 undefined 가 섞인다 */
  brandClassName: string | undefined;
  animate?: boolean;
}) {
  const attr = animate ? { "data-hero-char": "" } : {};
  if (!brand || !title.includes(brand)) {
    return (
      <>
        {Array.from(title).map((ch, i) => (
          <span key={i} className={styles.char} aria-hidden {...attr}>
            {ch}
          </span>
        ))}
      </>
    );
  }
  const [before, ...rest] = title.split(brand);
  /* 시안은 BGN 과 뒤 문구 사이가 ~7px 다. 공백 한 칸은 너무 넓어서 그룹 마진으로 둔다. */
  const after = rest.join(brand).replace(/^\s+/, "");
  return (
    <>
      {Array.from(before ?? "").map((ch, i) => (
        <span key={`b${i}`} className={styles.char} aria-hidden {...attr}>
          {ch}
        </span>
      ))}
      <span className={styles.brandGroup} lang="en" data-font="body">
        {Array.from(brand).map((ch, i) => (
          <span key={`br${i}`} className={clsx(styles.char, brandClassName)} aria-hidden {...attr}>
            {ch}
          </span>
        ))}
      </span>
      {Array.from(after).map((ch, i) => (
        <span key={`a${i}`} className={styles.char} aria-hidden {...attr}>
          {ch}
        </span>
      ))}
    </>
  );
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 스테이지 대비 % 로 평행이동. 매 프레임 호출되므로 문자열 조립만 한다. */
function shift(el: HTMLElement | null, x: number, y: number) {
  if (el) el.style.transform = `translate3d(${x}%, ${y}%, 0)`;
}

/**
 * 평행이동 + 미세 회전. 띠 전용이다.
 *
 * 회전이 없으면 띠가 "미끄러지는 판"으로 보인다. 1도 미만이라 눈으로는
 * 각도가 아니라 **휘어짐**으로 읽힌다. 요소 중심 기준이라 시안 배치와
 * 회전 중심이 같다.
 */
function shiftRotate(el: HTMLElement | null, x: number, y: number, r: number) {
  if (el) el.style.transform = `translate3d(${x}%, ${y}%, 0) rotate(${r}deg)`;
}

/** 시안 px → 스테이지 대비 %. 스테이지가 1920×920 비율이라 X/Y 가 같은 배율로 줄어든다. */
const pct = (value: number, base: number) => `${((value / base) * 100).toFixed(4)}%`;

/**
 * 타워 씬 스프라이트 한 장.
 *
 * 회전은 요소 중심 기준이고, 시안의 컨테이너 박스 중심과 회전 전 박스 중심이
 * 같으므로 "회전 전 박스 + rotate" 로 그대로 옮겨진다.
 * 플립은 Figma 가 내준 순서(rotate → scale)를 그대로 유지해야 부호가 맞다.
 */
function TowerSpriteImg({ sprite, drift }: { sprite: TowerSprite; drift?: number }) {
  const transform = [
    sprite.rotate ? `rotate(${sprite.rotate}deg)` : "",
    sprite.flipX ? "scaleX(-1)" : "",
    sprite.flipY ? "scaleY(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const box = {
    left: pct(sprite.x, TOWER_STAGE.width),
    top: pct(sprite.y, TOWER_STAGE.height),
    width: pct(sprite.w, TOWER_STAGE.width),
    height: pct(sprite.h, TOWER_STAGE.height),
  };

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.sprite}
      src={sprite.src}
      alt=""
      decoding="async"
      loading="lazy"
      data-node={sprite.node}
      style={{
        ...(drift === undefined ? box : { inset: 0, width: "100%", height: "100%" }),
        ...(transform ? { transform } : null),
        ...(sprite.opacity === undefined ? null : { opacity: sprite.opacity }),
        ...(sprite.fit ? { objectFit: sprite.fit } : null),
        ...(sprite.objectPosition ? { objectPosition: sprite.objectPosition } : null),
      }}
    />
  );

  if (drift === undefined) return img;

  /**
   * 래퍼 두 겹.
   *
   * 스프라이트 자신의 `transform` 에는 시안의 rotate/flip 이 이미 들어 있어서
   * 애니메이션을 덧쓰면 배치가 깨진다. 그래서 바깥에 래퍼를 두는데, **한 겹으로는
   * 부족하다** — 스크롤 오프셋과 아이들 드리프트가 같은 요소의 `transform` 을
   * 서로 지우기 때문이다(CLAUDE.md 역할 경계).
   *
   *   .lineScroll  스크롤 진행도 → 매 프레임 ref 로 직접
   *   .lineDrift   GSAP 무한 yoyo 드리프트
   *   img          시안의 rotate/flip 고정값
   *
   * 세 박스의 중심이 모두 같아서 회전 부호는 어긋나지 않는다.
   */
  return (
    <div className={styles.lineScroll} data-line={drift} style={box}>
      <div className={styles.lineDrift} data-drift={drift}>
        {img}
      </div>
    </div>
  );
}
