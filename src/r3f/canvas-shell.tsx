"use client";

import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree, type CanvasProps } from "@react-three/fiber";
import * as THREE from "three";

/**
 * R3F Canvas 공통 껍데기.
 *
 * shin 프로젝트에서 씬마다 따로 흩어져 있던 성능·안정성 처리를 한 곳으로 모았다.
 * 새 3D 섹션은 이 컴포넌트로 시작할 것.
 *
 * 포함된 것:
 *  - gl 을 factory 가 아닌 **options 객체**로 전달 → renderer 생성/dispose/
 *    context-loss 복구 라이프사이클을 R3F 가 관리
 *  - dpr 상한 클램프 (레티나에서 픽셀 4배는 거의 항상 낭비)
 *  - `frameloop` 3단 전략 (아래 참고)
 *  - WebGL context loss 가드
 *  - Canvas 밖에서 invalidate 를 호출할 수 있는 브리지
 *
 * ## frameloop 고르는 법
 *  - `"demand"`  : 스크롤·마우스 등 **입력이 있을 때만** 그리는 씬. 기본값.
 *                  invalidate 를 직접 호출해야 하므로 손이 좀 더 간다.
 *  - `"always"`  : 자체 애니메이션(회전, 셰이더 시간)이 계속 도는 씬.
 *                  반드시 `active` 로 화면 밖일 때 꺼줄 것.
 *  - `"never"`   : `active=false` 일 때 자동으로 이 값이 된다.
 */

export const GL_DEFAULTS = {
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  powerPreference: "high-performance",
  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: false,
} satisfies NonNullable<CanvasProps["gl"]>;

/** 상한 1.5 — 2.0 대비 픽셀 수 44% 감소, 체감 화질 차이는 거의 없다. */
export const DPR_RANGE: [number, number] = [1, 1.5];
/** 무거운 씬(MeshTransmission, 포스트프로세싱)용 더 낮은 상한 */
export const DPR_RANGE_HEAVY: [number, number] = [1, 1.25];

export interface CanvasShellProps extends Omit<CanvasProps, "frameloop" | "gl" | "dpr"> {
  /** 화면에 보이는가. false 면 frameloop 를 "never" 로 내려 GPU 를 0 으로 만든다. */
  active?: boolean;
  /** active=true 일 때의 frameloop. 기본 "demand". */
  activeFrameloop?: "always" | "demand";
  dpr?: [number, number];
  /**
   * Canvas 바깥(스크롤 핸들러 등)에서 리렌더를 요청할 때 쓰는 브리지.
   * `const invalidateRef = useRef<(() => void) | null>(null)` 를 넘기고
   * `invalidateRef.current?.()` 로 호출한다.
   */
  invalidateRef?: RefObject<(() => void) | null>;
  children: ReactNode;
}

export function CanvasShell({
  active = true,
  activeFrameloop = "demand",
  dpr = DPR_RANGE,
  invalidateRef,
  children,
  ...rest
}: CanvasShellProps) {
  return (
    <Canvas frameloop={active ? activeFrameloop : "never"} gl={GL_DEFAULTS} dpr={dpr} {...rest}>
      <ContextLossGuard />
      {invalidateRef ? <InvalidateBridge bridgeRef={invalidateRef} /> : null}
      {children}
    </Canvas>
  );
}

/**
 * Canvas 밖 → 안 invalidate 브리지.
 *
 * 스크롤 핸들러가 React state 를 건드리면 매 프레임 리렌더가 돈다.
 * ref 로 invalidate 함수만 꺼내 쓰면 리렌더 0회로 프레임만 요청할 수 있다.
 */
export function InvalidateBridge({ bridgeRef }: { bridgeRef: RefObject<(() => void) | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    bridgeRef.current = invalidate;
    return () => {
      if (bridgeRef.current === invalidate) bridgeRef.current = null;
    };
  }, [bridgeRef, invalidate]);
  return null;
}

/**
 * WebGL context loss 가드.
 *
 * `webglcontextlost` 의 기본 동작을 막지 않으면 브라우저가 컨텍스트를
 * 복구해 주지 않는다. 탭을 오래 방치하거나 GPU 메모리가 빠듯할 때 실제로 발생한다.
 */
export function ContextLossGuard() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => invalidate();
    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, invalidate]);

  return null;
}

/**
 * "N 프레임이 실제로 그려졌을 때" 준비 완료 신호.
 *
 * `onCreated` 나 Suspense 해제만으로는 부족하다 — 그 시점엔 HDR PMREM 이
 * 아직 안 구워졌고 텍스처 업로드도 안 끝나서, 그때 페이드인 하면
 * 첫 1~2 프레임이 시커멓거나 반사가 빠진 상태로 보인다.
 *
 * 로딩 스피너 제거 / fallback → 3D 크로스페이드 타이밍에 이걸 쓸 것.
 *
 * @param minFrames  환경맵 없으면 2, HDR·반사 있으면 3 권장
 */
export function FirstFrameReady({
  onReady,
  minFrames = 2,
  enabled = true,
}: {
  onReady?: () => void;
  minFrames?: number;
  enabled?: boolean;
}) {
  const frames = useRef(0);
  const fired = useRef(false);
  const invalidate = useThree((s) => s.invalidate);

  // rAF 가 아니라 useFrame 으로 세는 게 핵심 —
  // "브라우저가 프레임을 줬다"가 아니라 "R3F 가 실제로 draw 했다"를 세야 한다.
  // frameloop="demand" 에서는 이 둘이 전혀 다르다.
  useFrame(() => {
    if (!enabled || fired.current || !onReady) return;
    frames.current += 1;
    if (frames.current < minFrames) {
      invalidate(); // demand 모드에서 다음 프레임을 스스로 예약
      return;
    }
    fired.current = true;
    onReady();
  });

  return null;
}

/**
 * drei `<Bounds fit>` 과 group position 이 충돌하는 문제 우회.
 *
 * Bounds 는 `Box3.setFromObject()` 로 **월드 좌표** bbox 를 잡는다.
 * 바깥 group 에 position 이 걸려 있으면 그 오프셋까지 포함해서 카메라를
 * 옮기므로, position 을 바꿔도 화면상으론 아무 일도 안 일어난다.
 *
 * 해결: 첫 마운트엔 원점에 두고 Bounds fit 이 끝난 뒤(≈2 rAF) 실제 offset 을 적용.
 */
export function DeferredPositionGroup({
  position = [0, 0, 0],
  scale = 1,
  children,
}: {
  position?: [number, number, number];
  scale?: number;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    if (initialized.current) {
      g.position.set(...position);
      g.scale.setScalar(scale);
      return;
    }

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = groupRef.current;
        if (!el) return;
        el.position.set(...position);
        el.scale.setScalar(scale);
        initialized.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [position, scale]);

  return <group ref={groupRef}>{children}</group>;
}
