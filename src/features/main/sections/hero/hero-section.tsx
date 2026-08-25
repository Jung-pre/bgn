"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
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
import { getGlobeTune } from "./globe-tune";
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
 *   0.00 ~ fadeStart  구체 유지 (회전 + 포인터 추종)
 *   fadeStart ~ fadeEnd  구체가 확대되며 배경이 되고, 타워·물결이 들어온다
 *   fadeEnd ~ 1.00    타워 유지
 *
 * 매 프레임 값은 `progressRef` 로만 흐른다. state 는 장면 인덱스가 바뀔 때만.
 */

/**
 * 띠(광선/웨이브) WebGL 판. 시안 모션 주석이 요구하는 "휘면서 흐르는" 변형은
 * 래스터 한 장을 미는 DOM 판으로는 안 나온다. 그림은 그대로 텍스처로 쓴다.
 * 구체 씬이 이미 three 를 받아 오므로 청크 추가 비용은 사실상 없다.
 */
const RibbonScene = dynamic(() => import("./scene-ribbons").then((m) => m.RibbonScene), {
  ssr: false,
});

const SphereScene = dynamic(() => import("./scene-sphere").then((m) => m.SphereScene), {
  ssr: false,
});

/**
 * 띠는 **three(WebGL)로 그린다.** 정지 이미지 판은 쓰지 않는다.
 *
 * 이미지 판(`<img>` + transform)은 아직 코드에 남아 있지만 **동작 줄이기 설정과
 * WebGL 미지원 브라우저 전용 폴백**이다. 정상 경로에서는 절대 함께 보이지 않는다
 * (같은 자리에 둘 다 그리면 같은 그림이 두 장 겹친다).
 *
 * 컨텍스트를 잃어도 `RibbonScene` 이 복구 시 텍스처를 다시 올린다(그 처리가 없으면
 * 복구된 컨텍스트에 텍스처가 없어 띠가 빈 채로 남는다).
 */
const USE_GL_RIBBONS = true;

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

/** 구독할 게 없는 정적 값 — useSyncExternalStore 규약상 해제 함수만 돌려준다 */
const subscribeNever = () => () => {};

/** WebGL 지원 프로브 결과 캐시. 캔버스를 만드는 작업이라 한 번만 돌린다. */
let glProbe: boolean | null = null;
function glRibbonsSnapshot() {
  if (glProbe !== null) return glProbe;
  if (!USE_GL_RIBBONS) return (glProbe = false);
  if (prefersReducedMotionSync()) return (glProbe = false); // 동작 줄이기면 정지 DOM 판
  try {
    const probe = document.createElement("canvas");
    glProbe = Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    glProbe = false;
  }
  return glProbe;
}

export function HeroSection({ messages }: HeroSectionProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const sphereLayerRef = useRef<HTMLDivElement>(null);
  const towerLayerRef = useRef<HTMLDivElement>(null);
  /** 타워·하늘만 확대. 띠는 밖에 둬서 전환이 끝나는 순간 스케일이 틱하지 않게 한다. */
  const towerRiseRef = useRef<HTMLDivElement>(null);
  const copySphereRef = useRef<HTMLDivElement>(null);
  const copyTowerRef = useRef<HTMLDivElement>(null);
  /**
   * 마퀴는 **구체 씬에만** 있다. 시안 타워 프레임(8:733)에는 마퀴가 없다.
   * 계속 떠 있으면 타워 카피와 겹쳐서 시안보다 훨씬 시끄럽다.
   */
  const marqueeRef = useRef<HTMLDivElement>(null);

  /**
   * 타워 씬 패럴랙스 래퍼들. 매 프레임 transform 만 쓰므로 전부 ref 다.
   * 뒤판은 한 장이라 깊이감은 띠(가장 가깝다)와만 나눈다.
   */
  const pxBackdropRef = useRef<HTMLDivElement>(null);
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
   * 타워 뒤판은 한 장이지만 2x WebP 라 히어로 첫 화면에서 같이 디코딩하면
   * 구체가 뜨기도 전에 메인 스레드를 잡아먹는다. 크로스페이드(0.45)보다
   * 한참 앞선 0.12 에서 **딱 한 번** state 를 뒤집어 마운트한다.
   * (매 프레임 setState 금지 규칙은 ref 가드로 지킨다)
   */
  const [towerMounted, setTowerMounted] = useState(false);
  const towerMountedRef = useRef(false);

  /**
   * 띠 셰이더에 넘길 진행도. `usePinnedProgress` 의 progressRef 는 섹션 원본
   * 진행도(p)라 크로스페이드 전 구간이 섞여 있다. 띠가 쓰는 건 타워 등장 이후를
   * 다시 0~1 로 편 `u` 이므로 따로 담는다.
   */
  const ribbonProgressRef = useRef(0);

  /**
   * 띠를 WebGL 로 그릴 수 있는가.
   *
   * SSR 스냅샷은 항상 false 다 — 서버에서 컨텍스트를 만들 수 없고, 값이
   * 갈리면 하이드레이션이 깨진다. 타워 레이어 자체가 `towerMounted`(진행도
   * 0.12) 전까지 마운트되지 않으므로, 그 전에 이 효과가 먼저 돌아 깜빡임이 없다.
   */
  /**
   * WebGL 띠를 쓸 수 있는지. **effect 안에서 setState 하지 않는다** —
   * `react-hooks/set-state-in-effect` 가 막고, 실제로도 한 프레임 늦게 뒤집혀
   * DOM 판이 깜빡 보였다 사라진다.
   *
   * 서버 스냅샷은 항상 false 라 하이드레이션 불일치가 없고, 클라이언트 스냅샷은
   * 한 번만 재서 캐시한다(프로브가 캔버스를 만들기 때문에 매 렌더 돌면 안 된다).
   */
  const glRibbons = useSyncExternalStore(subscribeNever, glRibbonsSnapshot, () => false);

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
    /* 인덱스는 JSX 가 안 쓴다. 기본 매핑은 p=0.5 에서 setState 가 떠서
       전환 중 히어로가 리렌더되고 띠 위치가 한 프레임 튄다. */
    mapProgress: () => 0,
    onProgress: (p) => {
      // ⚠️ 매 프레임 호출된다. setState 금지. 스타일만 직접 쓴다.
      if (reducedRef.current === null) reducedRef.current = prefersReducedMotionSync();
      const { fadeStart, fadeEnd } = getGlobeTune();
      const span = Math.max(0.02, fadeEnd - fadeStart);
      const t = clamp01((p - fadeStart) / span);
      const sphere = sphereLayerRef.current;
      const tower = towerLayerRef.current;
      const riseLayer = towerRiseRef.current;
      const host = canvasHostRef.current;
      const reduced = reducedRef.current === true;
      if (reduced) {
        if (sphere) {
          sphere.style.opacity = String(1 - t);
          sphere.style.transform = "none";
        }
        if (host) host.style.transform = "scale(1)";
        if (tower) tower.style.opacity = String(t);
        if (riseLayer) riseLayer.style.transform = "scale(1)";
      } else {
        /* 확대는 캔버스 CSS 가 아니라 3D 그룹이 맡는다(scene-sphere).
           여기서 키우면 픽셀이 늘어나 흐려진다. */
        if (host) host.style.transform = "scale(1)";
        /* 구체가 화면을 채운 뒤에야 투명해진다. 타워와 겹치지 않는다. */
        const dump = clamp01((t - 0.58) / 0.2);
        const dumpEase = dump * dump * (3 - 2 * dump);
        if (sphere) {
          sphere.style.opacity = String(1 - dumpEase);
          sphere.style.transform = "none";
        }
        /* 구체가 거의 사라진 뒤에 타워가 조금 큰 채로 들어와 자리 잡는다.
           스케일은 타워·하늘만. 띠까지 줄이면 전환이 끝나는 순간 한 번 틱한다. */
        const rise = clamp01((t - 0.74) / 0.2);
        const riseEase = rise * rise * (3 - 2 * rise);
        if (tower) tower.style.opacity = String(riseEase);
        if (riseLayer) riseLayer.style.transform = `scale(${1.38 - riseEase * 0.38})`;
      }
      const cs = copySphereRef.current;
      const ct = copyTowerRef.current;
      if (cs) cs.style.opacity = String(1 - clamp01(t * 1.9));
      if (ct) ct.style.opacity = String(clamp01((t - 0.72) * 3.2));
      // 마퀴는 구체 카피와 같은 곡선으로 빠진다(시안 타워 프레임에 마퀴가 없다)
      const mq = marqueeRef.current;
      if (mq) mq.style.opacity = String(1 - clamp01(t * 2.4));

      // 타워 에셋을 미리 마운트해 크로스페이드 때 디코딩이 안 걸리게 한다
      if (!towerMountedRef.current && p > 0.12) {
        towerMountedRef.current = true;
        setTowerMounted(true);
      }

      /**
       * 패럴랙스 — 타워가 등장한 뒤 구간을 다시 0~1 로 편다.
       * 뒤판은 한 장(가장 멀다), 광선만 더 빨리 흘린다.
       */
      /* 물결은 타워가 받기 시작할 때 같이 착지한다 */
      const ribbonIn = fadeStart + span * 0.7;
      const u = reducedRef.current ? 0 : clamp01((p - ribbonIn) / (1 - ribbonIn));
      shift(pxBackdropRef.current, 0.6 * u, -1.1 * u);
      /* 셰이더 판은 그룹 이동까지 캔버스 안에서 처리한다 — 여기서 또 밀면 두 배가 된다 */
      ribbonProgressRef.current = u;
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

          {/* 시그니처 마퀴 — Figma 2:410 : top 583, Marcellus 108px, `*` 구분자.
              ⚠️ 자리가 여기인 게 중요하다: **배경 뒤, 캔버스 앞**.
              수정요청(26.08.24) "지구가 뒤로 가게 … 글자가 보이지 않도록" 대로
              구체가 문구를 가리려면 캔버스가 문구보다 나중에 그려져야 한다.
              래퍼는 opacity 만 맡는다 — 위치는 그대로 `.marquee` 가 갖는다. */}
          <div ref={marqueeRef}>
            {/* 수정요청: 문구가 너무 빨라 읽히지 않는다 → 28s → 46s */}
            <Marquee text={messages.marquee} className={styles.marquee} duration={46} />
          </div>
          <div ref={canvasHostRef} className={styles.canvasHost}>
            {/* ⚠️ 크로스페이드 도중에 이 캔버스를 마운트/언마운트하지 않는다.
                컨텍스트를 만들고 없앨 때마다 브라우저가 GPU 자원을 재배치하는데,
                하필 그 순간이 띠 캔버스가 처음 보여야 할 타이밍이라 띠가 비어
                보인다(전환이 끝나야 나타나던 증상). 두 캔버스를 그냥 계속 둔다. */}
            {/* intensity 는 바디 알파를 건드리므로 1 유지.
               밝기는 헤이즈(가산)만 내려서 구체를 어둡게 한다. */}
            <SphereScene active={sceneActive} progressRef={progressRef} haze={0.32} />
          </div>
        </div>

        {/* 타워 씬 — 뒤판 한 장(`img_01_bg02`) + 그 위 라인 무빙.
            시안에서는 타워/광선이 카피 위에 있지만, 타워가 본문을 덮으면
            가독성이 떨어져서 카피는 그대로 위(z-content)에 둔다. */}
        <div ref={towerLayerRef} className={styles.towerLayer} aria-hidden>
          <div ref={towerRiseRef} className={styles.towerRise}>
          <div className={styles.towerSky} />
          {HERO_ASSETS_READY && towerMounted ? (
            <>
              <div ref={pxBackdropRef} className={styles.px}>
                <picture>
                  <source
                    media="(max-width: 768px)"
                    srcSet={HERO_ASSETS.backdropMo}
                    type="image/webp"
                  />
                  <img
                    className={styles.towerSkyImg}
                    src={HERO_ASSETS.backdrop}
                    alt=""
                    decoding="async"
                    loading="eager"
                  />
                </picture>
              </div>

              <div className={styles.towerStage}>
                {/* 파티클 텍스처 — 8:2880. soft-light 50% 로 하늘 전체에 결을 깐다.
                    블렌드는 반드시 .px(스태킹 컨텍스트) 자신에 건다 — 자식에 걸면
                    투명한 자기 그룹 안에서만 섞여 통째로 죽는다. */}
                <div className={clsx(styles.px, styles.softLight, styles.particlesPx)}>
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

                {/* 상단 구름 — 8:2881 + 평행이동 복사본 8:2892. 타워 첨탑 주변
                    하늘을 뿌옇게 만든다(스프라이트 opacity 40%, 블렌드 없음). */}
                <div className={styles.cloudTop} aria-hidden>
                  {TOWER_CLOUDS_TOP.map((c) => (
                    <TowerSpriteImg key={c.node} sprite={c} />
                  ))}
                  {TOWER_CLOUDS_TOP.map((c) => (
                    <TowerSpriteImg
                      key={`${c.node}-b`}
                      sprite={{
                        ...c,
                        node: `${c.node}-b`,
                        x: c.x + TOWER_CLOUD_TOP_OFFSET.x,
                        y: c.y + TOWER_CLOUD_TOP_OFFSET.y,
                      }}
                    />
                  ))}
                </div>

                {/* BGN 워터마크 — 8:759. **타워 뒤**(상단 구름과 하단 구름 띠 사이) */}
                <TowerSpriteImg sprite={TOWER_WATERMARK} />

                {/* 롯데타워 — 8:2946. 시안(2:493)의 우측 기둥.
                    직전 리팩터링에서 빠져 하늘만 남아 있었다(2차 수정 확인 중 발견).
                    8:2947 `bg` 사각형이 마스크라 그 박스로 먼저 자르고 사진을 넣는다.
                    띠(stageClip·WebGL 캔버스)보다 **앞에 두면 안 된다** — 시안에서
                    띠가 타워를 가로질러 지나간다. */}
                <div className={styles.towerCrop}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.towerPic}
                    src={HERO_ASSETS.tower}
                    alt=""
                    decoding="async"
                    loading="lazy"
                  />
                </div>

                {/* 하단 구름 띠 — 8:2904 세 덩어리, soft-light. 타워 밑동과
                    스카이라인을 안개로 감싼다(시안에서 타워 **앞**이다). */}
                {TOWER_CLOUD_BANDS.map((band, bi) => (
                  <div
                    key={`band-${bi}`}
                    className={clsx(styles.px, styles.cloudBand)}
                    data-band={bi}
                    aria-hidden
                  >
                    {band.map((c) => (
                      <TowerSpriteImg key={c.node} sprite={c} />
                    ))}
                  </div>
                ))}

                {/* 광선/웨이브 — 8:2949. 시안에서 프레임 마스크로 잘려 있다.
                    clip 을 패럴랙스 래퍼 바깥에 둬야 잘리는 사각형이 안 움직인다.

                    여기 있는 건 **이미지 판(폴백)** 이다 — 동작 줄이기 설정이나
                    WebGL 미지원일 때만 그린다. 셰이더 판은 아래쪽에 따로 있다. */}
                <div ref={stageClipRef} className={styles.stageClip}>
                  {glRibbons ? null : (
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
                  )}
                </div>
              </div>
            </>
          ) : null}
          </div>

          {/**
           * 띠 캔버스 — 타워 에셋과 **따로, 더 일찍** 올린다.
           *
           * `towerMounted`(진행도 0.12) 안에 두면 그 React 상태가 뒤집히는 시점이
           * 이미 스크롤이 한참 지난 뒤일 수 있다. 커밋 + WebGL 초기화까지 몇 프레임을
           * 더 먹으므로, 캔버스의 첫 프레임이 **타워 레이어가 이미 반쯤 나타난 뒤**에
           * 도착한다 → 띠가 "띡" 하고 튀어나온다.
           *
           * 이 셰이더는 텍스처를 안 쓴다(절차적 생성). 그래서 일찍 올려도 비용이
           * 컨텍스트 하나뿐이고, 뒤판 한 장은 그대로 0.12 에서 받는다.
           *
           * 위치는 타워 블록 **뒤**다 — 형제 순서가 곧 z 순서라 띠가 타워 위에 온다.
           */}
          {glRibbons ? (
            <div className={styles.stageClip}>
              <RibbonScene progressRef={ribbonProgressRef} active={sceneActive} />
            </div>
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

  /**
   * ⚠️ 애니메이션이 없을 때는 **글자를 쪼개지 않는다.**
   *
   * `.char` 가 `display: inline-block` 이라 글자 하나하나가 원자 단위가 되고,
   * 그러면 `word-break: keep-all` 이 무력해진다(줄바꿈이 인라인 박스 사이에서
   * 일어나므로). 모바일 타워 카피가 시안(`2:3340`)의 `BGN` / `밝은눈안과` 가
   * 아니라 `BGN 밝은` / `눈안과` 로 끊겨 있던 원인이다.
   * 브랜드 글자(BGN)는 글자별 그라디언트 때문에 그대로 span 을 유지한다.
   */
  const plain = !animate;
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
      {plain
        ? before
        : Array.from(before ?? "").map((ch, i) => (
            <span key={`b${i}`} className={styles.char} aria-hidden {...attr}>
              {ch}
            </span>
          ))}
      {/* `data-font="body"` — 시안의 히어로 `BGN` 은 영문이지만 Pretendard 다.
          이게 없으면 globals.css 의 `[lang|="en"]` 규칙이 Belleza 로 바꿔 버린다.

          ⚠️ **글자마다 span 을 따로 낸다.** 시안 8:797 은 B(8:798)/G(8:799)/N(8:800)
          이 각각 독립 텍스트 노드이고 **글자마다 다른 radial 그라디언트**를 갖는다.
          한 span 에 그라디언트 하나를 걸면 세 글자에 하나의 타원이 걸쳐서
          가운데 글자만 하얗고 양끝이 죽는다 — 시안과 다른 그림이 된다.
          `data-letter` 로 글자별 그라디언트를 CSS 가 골라 준다. */}
      {Array.from(brand).map((ch, i) => (
        <span
          key={`brand${i}`}
          className={clsx(styles.char, brandClassName)}
          data-letter={ch}
          aria-hidden
          lang="en"
          data-font="body"
          {...attr}
        >
          {ch}
        </span>
      ))}
      {plain
        ? after
        : Array.from(after).map((ch, i) => (
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
