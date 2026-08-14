"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useSceneActive } from "@/r3f/use-scene-active";
import styles from "./closing-sphere-section.module.css";

/**
 * 클로징 파티클 스피어 — 시안 p1_22.
 *
 * 텍스트가 하나도 없는 풀블리드 3D 프레임. 푸터 직전의 전환 씬이다.
 * Figma 주석(`2:2900`)이 재사용을 명시한다:
 *   "광주신세계안과 처럼 지구가 연장선으로 배경요소로 차용되어 한번 더 보여지도록"
 * → 히어로 구체(`scene-sphere`)를 그대로 가져다 쓴다. 배경만 다르다.
 *
 * 순수 장식이므로 aria-hidden. 스크린리더에는 아무것도 노출하지 않는다.
 */
const SphereScene = dynamic(
  () => import("@/features/main/sections/hero/scene-sphere").then((m) => m.SphereScene),
  { ssr: false },
);

export function ClosingSphereSection() {
  const hostRef = useRef<HTMLDivElement>(null);
  const active = useSceneActive(hostRef);

  return (
    <section className={styles.section} aria-hidden>
      <div ref={hostRef} className={styles.canvasHost}>
        <SphereScene active={active} />
      </div>
    </section>
  );
}
