"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { gsap, useGSAP } from "@/shared/lib/gsap";
import { useSceneActive } from "@/r3f/use-scene-active";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import styles from "./closing-sphere-section.module.css";

/**
 * 클로징 파티클 스피어 — 시안 PC `2:2893`.
 *
 * 텍스트가 하나도 없는 풀블리드 3D 프레임. 푸터 직전의 전환 씬이다.
 * Figma 주석(`2:2900`)이 재사용을 명시한다:
 *   "광주신세계안과 처럼 지구가 연장선으로 배경요소로 차용되어 한번 더 보여지도록"
 * → 히어로 구체(`scene-sphere`)를 그대로 가져다 쓴다. 배경과 세기만 다르다.
 *
 * 순수 장식이므로 aria-hidden. 스크린리더에는 아무것도 노출하지 않는다.
 */
const SphereScene = dynamic(
  () => import("@/features/main/sections/hero/scene-sphere").then((m) => m.SphereScene),
  { ssr: false },
);

export function ClosingSphereSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const active = useSceneActive(hostRef);
  const isMobile = useIsMobileLayout();

  /**
   * pin 하지 않는다. 섹션이 뷰포트를 스쳐 지나가는 동안의 진행도만 구체에 넘긴다.
   * 히어로는 pin + progressRef 로 도는데, 여긴 그걸 안 줘서 인트로 뒤 멈춰 있었다.
   */
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const state = { p: 0 };
      gsap.to(state, {
        p: 1,
        ease: "none",
        onUpdate: () => {
          progressRef.current = state.p;
        },
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
    },
    { scope: sectionRef },
  );

  /**
   * 모바일 시안에는 이 섹션이 **없다**. 모바일 프레임 순서가
   * 이벤트(`2:5180`) → 푸터(`2:5207`) 로 곧장 이어진다.
   * CSS 로 숨기면 WebGL 컨텍스트는 그대로 생성되므로 아예 렌더하지 않는다.
   */
  if (isMobile) return null;

  return (
    <section ref={sectionRef} className={styles.section} aria-hidden>
      <div ref={hostRef} className={styles.canvasHost}>
        {/* 히어로 지구와 같은 점·대륙 밝기. 코어만 빼서 브랜드 포커스를 한 번만 둔다.
            튜닝 스토어는 읽지 않고 GLOBE_TUNE_DEFAULTS 스냅샷을 쓴다. */}
        <SphereScene
          active={active}
          progressRef={progressRef}
          intensity={0.8}
          haze={0.32}
          showCore={false}
          interactive={false}
          pointerFollow
        />
      </div>
    </section>
  );
}
