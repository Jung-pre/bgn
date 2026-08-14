"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync, useIsMobileLayout } from "@/shared/lib/use-media-query";
import { usePinnedProgress } from "@/features/main/sections/common/use-pinned-progress";
import { useSceneActive } from "@/r3f/use-scene-active";
import { Marquee } from "@/components/marquee/marquee";
import type { HeroSectionMessages } from "@/shared/i18n/messages";
import { HERO_ASSETS, HERO_ASSETS_READY } from "./hero-assets";
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

        <div ref={towerLayerRef} className={styles.towerLayer} aria-hidden>
          <div className={styles.towerSky} />
          {HERO_ASSETS_READY ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.towerImg} src={HERO_ASSETS.tower} alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.towerTexture} src={HERO_ASSETS.texture} alt="" />
            </>
          ) : (
            <div className={styles.towerPlaceholder} data-asset-placeholder />
          )}
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

        {/* 시그니처 마퀴 — Figma 2:410 : top 583, Marcellus 108px, `*` 구분자 */}
        <Marquee text={messages.marquee} className={styles.marquee} outline duration={28} />

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
  const after = rest.join(brand);
  return (
    <>
      {Array.from(before ?? "").map((ch, i) => (
        <span key={`b${i}`} className={styles.char} aria-hidden {...attr}>
          {ch}
        </span>
      ))}
      <span className={clsx(styles.char, brandClassName)} aria-hidden lang="en" {...attr}>
        {brand}
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
