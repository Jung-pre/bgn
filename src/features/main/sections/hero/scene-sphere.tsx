"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CanvasShell, DPR_RANGE } from "@/r3f/canvas-shell";
import { useIsMobileLayout, usePrefersReducedMotion } from "@/shared/lib/use-media-query";
import {
  FOCUS_LAT,
  FOCUS_LON,
  FOCUS_ROTATION_Y,
  GLOBE_RADIUS,
  lonLatToVector,
  makeHaloPoints,
  makeLandPoints,
  makeShellPoints,
  type PointCloud,
} from "./globe-points";

/**
 * 히어로 — 지도 구체(파티클 지구).
 *
 * ## 시안과의 관계
 * Figma `2:416` 의 구체는 **파티클로 대륙 윤곽이 그려진 지구**이고, 한반도 부근에서
 * 파란빛이 새어 나온다. 원본은 사전 렌더 PNG 라 회전이 없다. 그런데 Dev Mode 주석은
 *
 *   "로딩 화면 없이 진입 시 지구형태가 약간 돌면서 등장 후
 *    마우스 포인터에 맞춰 빛 요소가 움직이도록"
 *
 * 이라 **회전이 필수**다. 정지 PNG 로는 이 요구를 못 맞춘다. 그래서 PNG 를 깔지 않고
 * 실시간 파티클로 재현했다 — 대륙 위치는 Natural Earth 육지 폴리곤에서 구운
 * 마스크(`land-mask.generated.ts`)로 정확히 잡는다.
 *
 * ## 레이어 구성 (시안 관찰 결과)
 *   헤일로   구 바깥으로 흩날리는 성긴 입자 — 경계가 딱 떨어지지 않는다
 *   베이스   바다 포함 옅은 구면       — 이게 있어야 "구"로 읽힌다
 *   육지     대륙 위 밝은 밀집 입자     — 지도의 정체
 *   코어     한반도 위치의 파란 발광     — 유일하게 채도 있는 요소
 *
 * ## 블렌딩이 레이어마다 다른 이유
 * 파티클 3종은 **가산(additive)** 이다. 배경이 파스텔이라 가산 흰색이 곧 "빛"이 된다.
 * 반면 코어는 **일반 블렌딩**이다. 가산으로는 R·G 를 낮출 수 없어서 파스텔 배경 위에
 * 파란색을 얹으면 채도가 오르는 게 아니라 하얗게 날아간다. 시안의 코어는 배경보다
 * 진하고 채도가 높으므로 가산이면 절대 안 나온다.
 *
 * ## 성능 규칙
 * - 좌표는 `useMemo` 1회 생성. 매 프레임 재생성하면 GC 가 프레임을 먹는다.
 * - `Math.random()` 금지 → 시드 PRNG. React Compiler 가 불순 함수로 잡고,
 *   렌더마다 분포가 달라져 디자인 리뷰 비교가 안 된다.
 * - lerp 는 delta 기반 지수감쇠. `(b-a)*0.1` 은 120Hz 에서 두 배 빨라진다.
 * - 화면 밖에서는 `CanvasShell` 이 `frameloop="never"` 로 내려준다.
 * - 동작 줄이기면 회전 자체를 멈추고 `demand` 로 내려 GPU 를 0 으로 만든다.
 */

/** 데스크톱 / 모바일 파티클 수. 모바일은 픽셀도 적고 발열이 바로 체감된다. */
const COUNTS = {
  desktop: { land: 42000, shell: 26000, halo: 6000 },
  mobile: { land: 14000, shell: 8500, halo: 2400 },
} as const;

/** 지축 기울기 23.4°(rad). 정확히 기울여야 "지구"로 읽힌다. */
const AXIAL_TILT = 0.409;

/* --- 커서 반발 --------------------------------------------------------------
   Figma 주석: "마우스 포인터에 맞춰 빛 요소가 움직이도록"
   구체 전체 회전(= 시선 추종)만으로는 "빛 요소가 움직인다"가 약해서,
   커서 주변 입자를 실제로 밀어낸다. */

/** 영향 반경 — aspect 보정된 NDC. 0.5 ≈ 화면 높이의 25%. */
const PUSH_RADIUS = 0.5;
/**
 * 중심에서의 최대 밀림량(NDC). 0.06 ≈ 화면 높이의 3%
 * (900px 화면에서 약 27px).
 *
 * 반경은 넓게, 세기는 약하게 — 이 조합이어야 "구멍이 뚫린다"가 아니라
 * "물결이 인다"로 읽힌다. 0.085 까지 올려 보면 커서 자리에 원형 구멍이
 * 또렷하게 생겨서 병원 브랜드 톤과 안 맞는다.
 */
const PUSH_MAX = 0.06;

export interface PointerPush {
  /** NDC x (-1..1) */
  x: number;
  /** NDC y (-1..1) */
  y: number;
  /** 0~1. 캔버스 밖으로 나가면 0 으로 빠진다. */
  strength: number;
}

export interface SphereSceneProps {
  active: boolean;
  /** 히어로 스크롤 진행도(0~1). state 가 아니라 ref 로 받는다 */
  progressRef?: RefObject<number>;
}

export function SphereScene({ active, progressRef }: SphereSceneProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <CanvasShell
      active={active}
      /* 상시 회전이라 always. 동작 줄이기면 정지 이미지로 충분하므로 demand.
         화면 밖에서는 CanvasShell 이 never 로 내린다. */
      activeFrameloop={reduced ? "demand" : "always"}
      dpr={DPR_RANGE}
      camera={{ position: [0, 0, 6], fov: 38 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Globe progressRef={progressRef} reduced={reduced} />
    </CanvasShell>
  );
}

function Globe({ progressRef, reduced }: { progressRef?: RefObject<number>; reduced: boolean }) {
  const isMobile = useIsMobileLayout();
  const counts = isMobile ? COUNTS.mobile : COUNTS.desktop;

  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const eased = useRef({ x: 0, y: 0 });
  /** 진입 회전 진행도 — "지구형태가 약간 돌면서 등장" */
  const intro = useRef(reduced ? 1 : 0);

  const land = useMemo(() => makeLandPoints(counts.land, 0x1a5eed), [counts.land]);
  const shell = useMemo(() => makeShellPoints(counts.shell, 0x2b17e5), [counts.shell]);
  const halo = useMemo(() => makeHaloPoints(counts.halo, 0x3c0ffe), [counts.halo]);

  /** 코어 글로우의 로컬 위치 — 한반도 방향, 껍질 안쪽 */
  const corePosition = useMemo<[number, number, number]>(() => {
    const [x, y, z] = lonLatToVector(FOCUS_LON, FOCUS_LAT);
    // 껍질보다 한참 안쪽. 표면에 붙이면 빛이 구 밖으로 튀어나온 것처럼 보인다.
    const r = GLOBE_RADIUS * 0.28;
    return [x * r, y * r, z * r];
  }, []);

  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  /** 커서 반발 상태. 매 프레임 값이라 state 가 아니라 ref 다. */
  const push = useRef<PointerPush>({ x: 0, y: 0, strength: 0 });
  /** 마지막 커서 위치(뷰포트 좌표). NDC 변환은 프레임 안에서 한다. */
  const client = useRef({ x: 0, y: 0, has: false });

  /**
   * ⚠️ R3F 의 `state.pointer` 를 쓰지 않고 window 에서 직접 받는다.
   *
   * R3F 는 **캔버스 엘리먼트에** 포인터 리스너를 단다. 그런데 이 히어로는
   * 카피 레이어(`.inner`)가 `position: relative` 로 화면 전체를 덮고 있어서
   * 캔버스에는 `pointermove` 가 단 한 번도 도달하지 않는다.
   * 즉 `state.pointer` 는 영원히 (0, 0) 이고, 그 위에 얹힌
   * "마우스 포인터 추종 회전"도 실제로는 죽어 있었다.
   *
   * `.inner` 에 `pointer-events: none` 을 주는 방법도 있지만 그러면 히어로
   * 카피를 드래그 선택할 수 없게 된다. window 에서 받으면 위에 무엇이 덮이든
   * 상관없고, 앞으로 오버레이가 하나 더 생겨도 조용히 깨지지 않는다.
   *
   * 여기서는 좌표만 저장한다 — `getBoundingClientRect()` 는 레이아웃 읽기라
   * pointermove 마다 하면 GSAP 이 레이아웃을 더럽힌 직후 강제 리플로가 난다.
   * 실제 변환은 rAF 안(= `useFrame`)에서 프레임당 한 번만.
   */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      client.current.x = e.clientX;
      client.current.y = e.clientY;
      client.current.has = true;
    };
    // relatedTarget 이 null 이면 창(문서) 밖으로 나간 것
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) client.current.has = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
    };
  }, []);

  /**
   * 세로가 긴 화면에서 구체가 화면 밖으로 넘치지 않게 맞춘다.
   *
   * `GLOBE_RADIUS` 는 **화면 높이** 기준으로 잡혀 있다(fov 는 수직 화각이니까).
   * 375×812 모바일에서는 그 높이의 82% 가 666px 라 가로 375px 를 훌쩍 넘는다.
   * 가로가 세로보다 좁을 때만 그 비율만큼 줄인다. 데스크톱에서는 항상 1 이다.
   */
  const fitScale = Math.min(1, (size.width / size.height) * 1.05);

  /** demand 모드(동작 줄이기)에서는 한 번은 그려야 화면이 빈 채로 남지 않는다 */
  useEffect(() => {
    if (reduced) invalidate();
  }, [reduced, invalidate]);

  useFrame((_state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    if (reduced) {
      // 정지 구도 — 기울기만 유지하고 애니메이션은 전부 건너뛴다.
      g.rotation.set(0, FOCUS_ROTATION_Y, AXIAL_TILT);
      updateCore(coreRef.current, g, camera, 1);
      return;
    }

    // 뷰포트 좌표 → NDC. rect 읽기는 프레임당 한 번뿐이다.
    let nx = 0;
    let ny = 0;
    let inside = false;
    const rect = gl.domElement.getBoundingClientRect();
    if (client.current.has && rect.width > 0 && rect.height > 0) {
      nx = ((client.current.x - rect.left) / rect.width) * 2 - 1;
      ny = -(((client.current.y - rect.top) / rect.height) * 2 - 1);
      inside = nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
    }

    // 프레임레이트 독립 지수감쇠
    const k = 1 - Math.exp(-delta * 2.5);
    eased.current.x += (nx - eased.current.x) * k;
    eased.current.y += (ny - eased.current.y) * k;

    /* 반발용 커서는 회전용(k=2.5)보다 훨씬 빠르게 따라간다.
       회전은 관성이 있어야 자연스럽지만, 밀림은 커서에 붙어 있지 않으면
       "내가 미는 것"이 아니라 "뭔가 뒤늦게 따라오는 것"으로 읽힌다.
       세기는 반대로 천천히 — 커서가 들어오고 나갈 때 툭 끊기지 않게. */
    const kp = 1 - Math.exp(-delta * 16);
    push.current.x += (nx - push.current.x) * kp;
    push.current.y += (ny - push.current.y) * kp;
    const target = inside ? 1 : 0;
    push.current.strength += (target - push.current.strength) * (1 - Math.exp(-delta * 7));

    // 진입 회전: 0 → 1 로 한 번만 차오른다 (약 1.8초)
    if (intro.current < 1) intro.current = Math.min(1, intro.current + delta / 1.8);
    const introEase = 1 - Math.pow(1 - intro.current, 3);

    const scroll = progressRef?.current ?? 0;

    // 정면 경도(FOCUS_ROTATION_Y)를 기준으로 삼고, 인트로는 그 앞에서 살짝 돌다 멈춘다.
    // 인트로가 끝난 뒤에도 아주 느리게 계속 돈다 — 완전히 멈추면 3D 인 걸 못 알아본다.
    g.rotation.y =
      FOCUS_ROTATION_Y +
      (1 - introEase) * 0.55 + // 등장하며 살짝 돌기
      scroll * 0.9 + // 스크롤에 따라 추가 회전
      eased.current.x * 0.3; // 포인터 추종
    // 지축 기울기를 고정으로 주고 그 위에 포인터 반응을 얹는다
    g.rotation.z = AXIAL_TILT;
    g.rotation.x = eased.current.y * 0.16;

    updateCore(coreRef.current, g, camera, introEase);
  });

  return (
    <group ref={groupRef} rotation={[0, FOCUS_ROTATION_Y, AXIAL_TILT]} scale={fitScale}>
      <PointLayer
        cloud={halo}
        color="#ffffff"
        size={0.03}
        opacity={0.45}
        instant={reduced}
        pointerRef={push}
        pushScale={1.2}
      />
      <PointLayer
        cloud={shell}
        color="#eef4ff"
        size={0.024}
        opacity={0.75}
        instant={reduced}
        pointerRef={push}
        pushScale={1}
      />
      <PointLayer
        cloud={land}
        color="#ffffff"
        size={0.03}
        opacity={0.95}
        instant={reduced}
        pointerRef={push}
        pushScale={0.85}
      />

      {/* 코어 글로우 — 매 프레임 카메라를 향하도록 돌린다(빌보드).
          drei `<Billboard>` 를 쓰지 않은 이유: 이건 회전 그룹의 자식이라
          Billboard 가 부모 회전을 상쇄하는 과정에서 quaternion 이 한 프레임 늦는다. */}
      <mesh ref={coreRef} position={corePosition} renderOrder={-1}>
        {/* 시안에서 파란 코어는 구체 지름의 40% 정도다. falloff 여유까지 1.2R. */}
        <planeGeometry args={[GLOBE_RADIUS * 1.2, GLOBE_RADIUS * 1.2]} />
        <CoreGlowMaterial />
      </mesh>
    </group>
  );
}

/**
 * 코어를 카메라 쪽으로 돌리고, 뒤로 넘어가면 흐리게 만든다.
 *
 * 파티클이 `depthWrite: false` 라 코어를 가려 주지 않는다. 그래서 한반도가
 * 지구 반대편으로 돌아가도 빛이 그대로 앞에 떠 보이는 문제가 생긴다.
 * 월드 z 로 직접 페이드하는 게 가장 싸고 확실하다.
 */
function updateCore(
  core: THREE.Mesh | null,
  group: THREE.Group,
  camera: THREE.Camera,
  introEase: number,
) {
  if (!core) return;
  // 빌보드: 부모 회전을 상쇄하고 카메라 방향을 그대로 받는다
  core.quaternion.copy(camera.quaternion);
  group.getWorldQuaternion(TMP_Q).invert();
  core.quaternion.premultiply(TMP_Q);

  core.getWorldPosition(TMP_V);
  // z > 0 이면 카메라 쪽(앞). -0.6 ~ 0.9 구간에서 부드럽게 꺼진다.
  const t = (TMP_V.z + 0.6) / 1.5;
  const front = t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const mat = core.material as THREE.ShaderMaterial;
  const u = mat.uniforms.uOpacity;
  if (u) u.value = front * introEase;
}

const TMP_Q = /* @__PURE__ */ new THREE.Quaternion();
const TMP_V = /* @__PURE__ */ new THREE.Vector3();

/* ==========================================================================
   파티클 레이어
   ========================================================================== */

/**
 * 커서 반발을 **화면 좌표(NDC)에서** 계산하는 이유
 * ---------------------------------------------
 * 3D 공간에서 커서 광선까지의 거리를 재서 밀면 물리적으로는 더 "정확"하지만,
 * 화면에서는 구체 앞면과 뒷면이 서로 다른 세기로 밀려 어긋나 보인다
 * (파티클이 `depthWrite: false` 라 앞뒤가 전부 겹쳐 보이기 때문).
 *
 * NDC 에서 밀면 커서 주변이 화면상 정확한 원으로 비고, 앞뒤 구분 없이
 * 같은 양만큼 비켜난다 — 눈이 기대하는 그림이 정확히 이쪽이다.
 * 게다가 원근 나눗셈 뒤라 멀리 있는 입자도 화면에서 같은 픽셀만큼 밀린다.
 *
 * `uPush` 가 0 이면 분기 전체를 건너뛴다 — 마우스가 없는 모바일에서
 * 정점 셰이더가 공짜가 되도록.
 */
const POINT_VERTEX = /* glsl */ `
  attribute float aScale;
  uniform float uSize;
  uniform float uHeight;
  uniform vec2 uPointer;      // NDC (-1..1), y 위쪽이 +
  uniform float uAspect;      // width / height — 원형 반경을 유지하려면 필요
  uniform float uPush;        // NDC 단위 최대 밀림량. 0 이면 비활성
  uniform float uPushRadius;  // 영향 반경 (aspect 보정된 NDC)
  varying float vScale;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * mv;

    float grow = 0.0;
    if (uPush > 0.0001 && clip.w > 0.0) {
      vec2 ndc = clip.xy / clip.w;
      // aspect 를 곱해 "가로로 늘어난 타원"이 아니라 정원(正圓)으로 만든다
      vec2 d = (ndc - uPointer) * vec2(uAspect, 1.0);
      float dist = length(d);
      float f = 1.0 - smoothstep(0.0, uPushRadius, dist);
      f *= f; // 가장자리를 더 부드럽게, 중심을 더 세게

      // 커서와 정확히 겹친 입자는 방향이 정의되지 않는다. 위쪽으로 흘려보낸다.
      vec2 dir = dist > 1e-4 ? d / dist : vec2(0.0, 1.0);
      ndc += dir * vec2(1.0 / uAspect, 1.0) * f * uPush;
      clip.xy = ndc * clip.w;
      grow = f;
    }

    gl_Position = clip;
    // three 의 sizeAttenuation 과 같은 식. uHeight 는 drawingBuffer 높이.
    // 밀려난 입자를 살짝 키워 "쓸려 나간다"는 인상을 준다.
    gl_PointSize = uSize * (1.0 + grow * 0.5) * (uHeight * 0.5) / max(0.001, -mv.z);
    vScale = aScale;
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vScale;
  void main() {
    // 기본 gl_Point 는 사각형이다. 3px 짜리 사각형 2만 개는 격자무늬로 읽힌다.
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * vScale * uOpacity);
  }
`;

function PointLayer({
  cloud,
  color,
  size,
  opacity,
  instant,
  pointerRef,
  pushScale,
}: {
  cloud: PointCloud;
  color: string;
  /**
   * 파티클 크기 — **월드 단위**다(three 의 `PointsMaterial.size` 와 같은 의미).
   * 픽셀 크기 = size × (drawingBufferHeight / 2) / 카메라거리.
   * 카메라 z=6, 높이 900×dpr1.5 기준 0.028 이면 약 3px.
   */
  size: number;
  opacity: number;
  /** 동작 줄이기 — 페이드인 없이 처음부터 완성된 상태로 그린다 */
  instant: boolean;
  /** 부모가 매 프레임 갱신하는 커서 상태. state 로 두면 60fps 리렌더가 된다. */
  pointerRef: RefObject<PointerPush>;
  /**
   * 레이어별 밀림 배수.
   * 헐거운 입자일수록 많이 밀려야 층이 분리돼 깊이감이 생긴다.
   * 다만 육지와 껍질의 차이를 크게 두면 대륙이 껍질에서 떨어져 나온 것처럼
   * 보이므로 1 을 기준으로 ±20% 안쪽에서만 흔든다.
   */
  pushScale: number;
}) {
  const fade = useRef(instant ? 1 : 0);
  /**
   * 유니폼은 반드시 **ref 를 통해서만** 만진다.
   * `useMemo` 결과를 직접 mutate 하면 React Compiler 의 immutability 규칙에 걸린다
   * (렌더 산출물을 렌더 이후에 바꾸는 셈이라 실제로도 위험한 패턴이다).
   * ref 경유는 컴파일러가 추적하지 않으며, R3F 의 정석이기도 하다.
   */
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: instant ? opacity : 0 },
          uSize: { value: size },
          uHeight: { value: 1000 },
          uPointer: { value: new THREE.Vector2() },
          uAspect: { value: 1 },
          uPush: { value: 0 },
          uPushRadius: { value: PUSH_RADIUS },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color, size, opacity, instant],
  );

  // useMemo 로 만든 객체는 R3F 가 자동 dispose 해 주지 않는다.
  // 언마운트 시 컴파일된 GPU 프로그램을 직접 놓아준다.
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ size: viewSize, viewport }, delta) => {
    const m = matRef.current;
    if (!m) return;
    const h = m.uniforms.uHeight;
    if (h) h.value = viewSize.height * viewport.dpr;

    // ── 커서 반발 ────────────────────────────────────────────────
    const p = pointerRef.current;
    const up = m.uniforms.uPointer;
    if (up) (up.value as THREE.Vector2).set(p.x, p.y);
    const ua = m.uniforms.uAspect;
    if (ua) ua.value = viewSize.height > 0 ? viewSize.width / viewSize.height : 1;
    const upush = m.uniforms.uPush;
    if (upush) upush.value = p.strength * pushScale * PUSH_MAX;

    if (instant) return;
    // 로딩 화면 없이 텍스트가 먼저 뜨고, 3D 는 준비되는 대로 스며든다
    if (fade.current < 1) fade.current = Math.min(1, fade.current + delta / 1.1);
    const o = m.uniforms.uOpacity;
    if (o) o.value = fade.current * opacity;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[cloud.positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[cloud.scales, 1]} />
      </bufferGeometry>
      <primitive ref={matRef} object={material} attach="material" />
    </points>
  );
}

/* ==========================================================================
   코어 글로우
   ========================================================================== */

const CORE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * 이중 반경 falloff.
 * 안쪽은 거의 흰빛으로 타고, 바깥으로 가며 primary-500 파랑으로 넘어간 뒤 사라진다.
 * 시안의 코어가 중심만 밝고 가장자리는 파랗게 번지는 모양이라 단일 gradient 로는 안 나온다.
 */
const CORE_FRAGMENT = /* glsl */ `
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = pow(max(0.0, 1.0 - d * 2.6), 2.0);
    float halo = pow(max(0.0, 1.0 - d), 2.4);
    vec3 c = mix(uOuter, uInner, core);
    float a = (halo * 0.26 + core * 0.55) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(c, a);
  }
`;

function CoreGlowMaterial() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CORE_VERTEX,
        fragmentShader: CORE_FRAGMENT,
        uniforms: {
          // globals.css --primary-300 / --primary-500
          uInner: { value: new THREE.Color("#cfe6ff") },
          uOuter: { value: new THREE.Color("#0072ec") },
          uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        // 가산이 아니다 — 위 파일 상단 주석 "블렌딩이 레이어마다 다른 이유" 참고
        blending: THREE.NormalBlending,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  return <primitive object={material} attach="material" />;
}
