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
  makeOrbitPoints,
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
/**
 * 파티클 수.
 *
 * 시안 구체는 **개별 점이 안 보이는 고운 가루**처럼 읽힌다. 4만 개로는 점 하나하나가
 * 분간돼 "점 구름"이 되고 시안의 진주빛 막이 안 나온다. 개수를 3배로 올리는 대신
 * 점 크기를 절반으로 줄여야 한다 — 크기를 그대로 두고 개수만 늘리면 흰 덩어리가 된다.
 *
 * 12만 점이라도 셰이더가 단순해서(정점 15줄 / 프래그먼트 12줄) 레이어당 드로우콜 1회다.
 * 모바일은 픽셀도 적고 발열이 바로 체감되므로 1/4 로 내린다.
 */
const COUNTS = {
  /**
   * 한때 여기에 결(flow — 벡터장을 따라 걷는 지문 무늬)을 넣었다가 뺐다.
   * 무늬 자체는 만들어졌지만 **구체의 성격이 바뀌었다** — 균등한 빛 구름이던 게
   * 빗질된 실타래가 되면서 원래의 정갈함을 잃었다. 화려함은 무늬가 아니라
   * **색과 빛**으로 올리는 쪽이 맞다(아래 POINT_FRAGMENT 의 팔레트).
   * 궤도 고리(orbit)만 남긴다 — 이건 구체를 안 건드리고 바깥에 장식만 더한다.
   */
  desktop: { land: 120000, shell: 78000, halo: 16000, orbit: 5200 },
  mobile: { land: 26000, shell: 16000, halo: 4500, orbit: 1600 },
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
  /**
   * 파티클 밝기 배수. 클로징 섹션(`2:2893`)은 같은 구체를 **배경 요소**로 다시
   * 쓰는데, 시안에서 그쪽은 대륙이 거의 안 읽히는 안개 덩어리다.
   * CSS `opacity` 로 눌러도 되지만 그러면 캔버스 전체가 반투명해져 뒤 배경이
   * 비쳐 색이 탁해진다. 셰이더 단계에서 줄이는 게 맞다.
   */
  intensity?: number;
  /**
   * 껍질 산란광(`GlobeHaze`) 밝기 배수. 기본은 `intensity` 를 따라간다.
   *
   * 클로징(`2:2893`)만 이걸 따로 준다. 시안을 스캔해 보면 그쪽 구체는
   * 테두리 대비가 배경 대비 **+24 정도**밖에 안 되고 안쪽이 +10~+20 으로
   * 고르게 차 있다 — 즉 파티클이 아니라 헤이즈가 그림을 지배한다.
   * `intensity` 하나로 같이 내리면 테두리만 남은 링이 되어 시안과 반대가 된다.
   */
  haze?: number;
  /**
   * 한반도 파란 코어 글로우. 클로징에서는 시안에 없다.
   * 브랜드 포커스를 두 번 반복하면 히어로의 의미가 희석된다.
   */
  showCore?: boolean;
  /**
   * 포인터 추종 회전 + 커서 반발.
   * 클로징은 스쳐 지나가는 전환 씬이라 조작 어포던스를 주지 않는다.
   */
  interactive?: boolean;
}

export function SphereScene({
  active,
  progressRef,
  intensity = 1,
  haze = intensity,
  showCore = true,
  interactive = true,
}: SphereSceneProps) {
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
      <Globe
        progressRef={progressRef}
        reduced={reduced}
        intensity={intensity}
        haze={haze}
        showCore={showCore}
        interactive={interactive}
      />
    </CanvasShell>
  );
}

function Globe({
  progressRef,
  reduced,
  intensity,
  haze,
  showCore,
  interactive,
}: {
  progressRef?: RefObject<number>;
  reduced: boolean;
  intensity: number;
  haze: number;
  showCore: boolean;
  interactive: boolean;
}) {
  const isMobile = useIsMobileLayout();
  const counts = isMobile ? COUNTS.mobile : COUNTS.desktop;

  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const eased = useRef({ x: 0, y: 0 });
  /** 진입 회전 진행도 — "지구형태가 약간 돌면서 등장" */
  const intro = useRef(reduced ? 1 : 0);

  const land = useMemo(() => makeLandPoints(counts.land, 0x1a5eed), [counts.land]);
  const shell = useMemo(() => makeShellPoints(counts.shell, 0x2b17e5), [counts.shell]);
  const orbit = useMemo(() => makeOrbitPoints(counts.orbit, 0x1d5b3f, 4), [counts.orbit]);
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
      if (showCore) updateCore(coreRef.current, g, camera, 1);
      return;
    }

    // 뷰포트 좌표 → NDC. rect 읽기는 프레임당 한 번뿐이다.
    // 비인터랙티브(클로징)면 rect 읽기 자체를 건너뛴다 — 어차피 안 쓴다.
    let nx = 0;
    let ny = 0;
    let inside = false;
    if (interactive) {
      const rect = gl.domElement.getBoundingClientRect();
      if (client.current.has && rect.width > 0 && rect.height > 0) {
        nx = ((client.current.x - rect.left) / rect.width) * 2 - 1;
        ny = -(((client.current.y - rect.top) / rect.height) * 2 - 1);
        inside = nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
      }
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
    // 클로징은 포인터가 없어서, 스크롤·느린 자전이 없으면 인트로 1.8초 뒤 완전히 멈춘다.
    const idle = interactive ? 0 : _state.clock.elapsedTime * 0.07;
    g.rotation.y =
      FOCUS_ROTATION_Y +
      (1 - introEase) * 0.55 + // 등장하며 살짝 돌기
      scroll * 0.9 + // 스크롤에 따라 추가 회전
      eased.current.x * 0.3 + // 포인터 추종 (비인터랙티브면 eased 가 0 에 머문다)
      idle;
    // 지축 기울기를 고정으로 주고 그 위에 포인터 반응을 얹는다
    g.rotation.z = AXIAL_TILT;
    g.rotation.x = eased.current.y * 0.16;

    if (showCore) updateCore(coreRef.current, g, camera, introEase);
  });

  return (
    <>
      {/* 회전 그룹 밖 — 껍질의 산란광이라 구체와 같이 돌면 안 된다 */}
      <group scale={fitScale}>
        <GlobeHaze intensity={haze} instant={reduced} />
      </group>
      <group ref={groupRef} rotation={[0, FOCUS_ROTATION_Y, AXIAL_TILT]} scale={fitScale}>
        <PointLayer
          cloud={halo}
          color="#ffffff"
          size={0.03}
          opacity={0.55 * intensity}
          instant={reduced}
          tint={1.0}
          pointerRef={push}
          pushScale={interactive ? 1.2 : 0}
        />
        <PointLayer
          cloud={shell}
          color="#eef4ff"
          size={0.024}
          opacity={0.95 * intensity}
          instant={reduced}
          tint={1.0}
          pointerRef={push}
          pushScale={interactive ? 1 : 0}
        />
        <PointLayer
          cloud={land}
          color="#ffffff"
          size={0.03}
          opacity={1.0 * intensity}
          instant={reduced}
          tint={1.0}
          pointerRef={push}
          pushScale={interactive ? 0.85 : 0}
        />

        {/* 궤도 고리 — 구 바깥을 도는 점선. 시안에 3~4 개 보인다 */}
        <PointLayer
          cloud={orbit}
          color="#ffffff"
          size={0.022}
          opacity={0.7 * intensity}
          instant={reduced}
          tint={0.9}
          pointerRef={push}
          pushScale={interactive ? 1.4 : 0}
        />

        {/* 코어 글로우 — 매 프레임 카메라를 향하도록 돌린다(빌보드).
          drei `<Billboard>` 를 쓰지 않은 이유: 이건 회전 그룹의 자식이라
          Billboard 가 부모 회전을 상쇄하는 과정에서 quaternion 이 한 프레임 늦는다.
          클로징에서는 시안에 없으므로 아예 렌더하지 않는다(투명하게 두면 드로우콜만 남는다). */}
        {showCore ? (
          <mesh ref={coreRef} position={corePosition} renderOrder={-1}>
            {/* 시안에서 파란 코어는 구체 지름의 40% 정도다. falloff 여유까지 1.2R. */}
            <planeGeometry args={[GLOBE_RADIUS * 0.85, GLOBE_RADIUS * 0.85]} />
            <CoreGlowMaterial />
          </mesh>
        ) : null}
      </group>
    </>
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
  varying vec2 vScreen;

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

    /* 파스텔 이리데선스용 화면 좌표. 구체의 **로컬** 좌표가 아니라 NDC 를 쓴다 —
       시안의 색 번짐은 지구에 칠해진 무늬가 아니라 화면 위에 걸린 빛이라
       구체가 회전해도 색이 따라 돌면 안 된다. */
    vScreen = clip.w > 0.0 ? clip.xy / clip.w : vec2(0.0);
  }
`;

/**
 * 시안(`2:416`)의 구체는 **순백이 아니다.**
 * 좌하단이 살구·분홍, 가운데 위가 라벤더, 우측이 하늘빛으로 번지는 파스텔 무지개다.
 * 흰 파티클만 뿌리면 아무리 밀도를 올려도 "회색 점 구름"으로 읽힌다.
 *
 * 그래서 화면 좌표(`vScreen`)로 색 램프를 태운다. 로컬 좌표가 아닌 이유는
 * 정점 셰이더 주석 참고 — 색이 구체를 따라 돌면 안 된다.
 */
const POINT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTint;
  varying float vScale;
  varying vec2 vScreen;

  /**
   * 시안 2:416 픽셀 실측 팔레트.
   *
   * 원래 3색(살구/라벤더/하늘)이었는데 정규화를 거치면 거의 흰빛으로 수렴해서
   * "화려하지 않다"는 지적을 받았다. **무늬를 더하는 대신 색을 늘렸다** —
   * 금빛과 민트를 끼워 스펙트럼을 넓히고 채도를 한 단계씩 올렸다.
   * 구체의 형태(균등한 빛 구름)는 그대로 두는 게 핵심이다.
   */
  const vec3 WARM = vec3(1.00, 0.58, 0.62); // 로즈 — 좌하단
  const vec3 GOLD = vec3(1.00, 0.80, 0.62); // 금빛 — 좌중단
  const vec3 LAV  = vec3(0.74, 0.62, 1.00); // 라벤더 — 좌상단
  const vec3 COOL = vec3(0.58, 0.80, 1.00); // 하늘 — 우측
  const vec3 MINT = vec3(0.66, 1.00, 0.92); // 민트 — 우측 끝만 살짝

  void main() {
    // 기본 gl_Point 는 사각형이다. 3px 짜리 사각형 2만 개는 격자무늬로 읽힌다.
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d);
    if (a < 0.01) discard;

    /* 가로로 살구/라벤더 → 하늘, 세로로 살구 ↔ 라벤더.
       두 축을 곱하지 않고 순차로 섞어야 중간에 탁한 회색이 안 생긴다. */
    float x = vScreen.x * 0.5 + 0.5;
    float y = vScreen.y * 0.5 + 0.5;
    /* 세로로 살구 → 금빛 → 라벤더, 가로로 그 결과 → 하늘 → (끝에만) 민트.
       두 축을 곱하지 않고 순차로 섞어야 중간에 탁한 회색이 안 생긴다. */
    /* 시안 구체는 **따뜻한 쪽이 주인공**이다 — 분홍·라벤더가 화면의 2/3 를 먹고
       하늘색은 오른쪽 끝에만 걸친다. 예전엔 가로 그라디언트를 0.28 부터 하늘로
       넘겨서 구체 전체가 파랗게 읽혔다(“우리건 너무 약하다”의 실체). */
    vec3 left = mix(mix(WARM, GOLD, smoothstep(0.02, 0.38, y)), LAV, smoothstep(0.34, 0.90, y));
    vec3 tint = mix(left, COOL, smoothstep(0.58, 1.00, x));
    tint = mix(tint, MINT, smoothstep(0.88, 1.00, x) * 0.35);

    /* ⚠️ 밝기를 정규화한다 — 가장 밝은 채널을 1.0 으로 끌어올린다.
       그냥 곱하면 세 채널이 전부 1 미만이라 **색만 입는 게 아니라 어두워진다.**
       가산 블렌딩에서는 그 감소가 곧 "파티클이 옅어짐"이라, 정규화 전에는
       구체가 배경에 묻혀 거의 안 보였다. 색상만 옮기고 광량은 유지한다. */
    /* ⚠️ 최대 채널을 1.0 으로 끌어올리면 광량은 지키지만 **채도가 같이 날아간다**.
       (1,0.58,0.62) 를 그대로 두면 예쁜 로즈인데 정규화하면 그대로고, 반대로
       (0.74,0.62,1.0) 같은 건 1.0 으로 올라가며 옅어진다. 절반만 정규화해서
       광량 손실은 줄이되 색은 남긴다 — 가산 블렌딩이라 완전히 안 나누면 어두워진다. */
    float mx = max(max(tint.r, tint.g), tint.b);
    tint /= mix(1.0, mx, 0.55);

    vec3 col = mix(uColor, uColor * tint, uTint);

    /* 림 라이트 — 실루엣 가까울수록 밝다. 시안 구체는 가장자리에 흰 테가 도는데,
       그게 "구"로 읽히게 만드는 핵심이다. vScreen 이 NDC 라 원점에서의 거리가
       곧 실루엣까지의 거리다(구체가 화면 중앙에 있으므로). */
    float rim = smoothstep(0.42, 0.95, length(vScreen));
    col *= 1.0 + rim * 0.5;

    gl_FragColor = vec4(col, a * vScale * uOpacity);
  }
`;

function PointLayer({
  cloud,
  color,
  size,
  opacity,
  instant,
  tint,
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
  /**
   * 파스텔 이리데선스 세기 0~1.
   * 육지는 시안에서도 가장 희므로 낮게, 바다·헤일로는 색이 많이 스미므로 높게 준다.
   */
  tint: number;
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
          uTint: { value: tint },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color, size, opacity, instant, tint],
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
    float a = (halo * 0.18 + core * 0.42) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(c, a);
  }
`;

/* ==========================================================================
   껍질 발광층 (헤이즈)
   ========================================================================== */

/**
 * 시안 구체가 "점 구름"이 아니라 **진주빛 막**으로 보이는 진짜 이유.
 *
 * 파티클만으로는 아무리 개수를 늘려도 점 사이의 배경이 비쳐 성글게 읽힌다.
 * 시안에는 점 밑에 **얇은 껍질이 빛을 산란시키는 은은한 판**이 깔려 있고,
 * 특히 가장자리(limb)가 밝다. 그게 구체의 부피감을 만든다.
 *
 * ## 왜 구 메시가 아니라 카메라를 향한 원반인가
 * 얇은 껍질을 통과하는 시선의 길이는 중심에서 최소, 가장자리에서 최대다.
 * 그 광학 두께가 정확히 `1 / sqrt(1 - r²)` 이라서(r = 중심으로부터의 정규화 거리)
 * **원반 하나에 이 식을 그대로 넣으면** 구를 세워 두고 반투명 셰이딩하는 것과
 * 같은 그림이 나온다. 정점 12만 개짜리 구를 하나 더 그릴 이유가 없다.
 *
 * ## 회전 그룹 **밖**에 두는 이유
 * 이건 대륙 무늬가 아니라 껍질의 산란광이다. 구체가 돌 때 같이 돌면 안 된다.
 */
const HAZE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vScreen;
  void main() {
    vUv = uv;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreen = clip.w > 0.0 ? clip.xy / clip.w : vec2(0.0);
    gl_Position = clip;
  }
`;

const HAZE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec2 vScreen;

  const vec3 WARM = vec3(1.00, 0.78, 0.76);
  const vec3 LAV  = vec3(0.84, 0.79, 1.00);
  const vec3 COOL = vec3(0.72, 0.88, 1.00);

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    /* 얇은 껍질의 광학 두께. 가장자리에서 발산하므로 상한을 씌운다. */
    float shell = 1.0 / sqrt(max(0.030, 1.0 - r * r));

    /*
      ⚠️ shell 값을 그대로 곱하면 안 된다.
      중심에서도 값이 1 이라 **원반 전체가 균일하게 밝아지고**, 그 위에 얹은
      가산 파티클이 포화 근처로 밀려 대비를 통째로 잃는다. 실제로 그렇게 만들었더니
      구체가 "뿌연 원반"이 됐다.

      1.02 를 빼서 중심은 0 에 붙이고 **가장자리(limb)만 남긴다.** 여기에 아주 옅은
      상수(0.05)를 더해 안쪽의 진주빛 바닥을 만든다 — 시안의 부피감이 이 조합이다.
    */
    float a = max(0.0, shell - 1.02) * 0.16 + 0.09;
    a = min(a, 0.62);

    /* 가장자리 1픽셀에서 계단이 보이지 않게 살짝 접어 준다 */
    a *= smoothstep(1.0, 0.955, r);

    /* 파티클과 같은 램프를 쓴다 — 두 레이어의 색이 어긋나면 막이 아니라
       "색 다른 원반이 덧대진 것"으로 보인다. */
    float x = vScreen.x * 0.5 + 0.5;
    float y = vScreen.y * 0.5 + 0.5;
    vec3 left = mix(WARM, LAV, smoothstep(0.15, 0.85, y));
    vec3 tint = mix(left, COOL, smoothstep(0.30, 0.95, x));
    /* ⚠️ 최대 채널을 1.0 으로 끌어올리면 광량은 지키지만 **채도가 같이 날아간다**.
       (1,0.58,0.62) 를 그대로 두면 예쁜 로즈인데 정규화하면 그대로고, 반대로
       (0.74,0.62,1.0) 같은 건 1.0 으로 올라가며 옅어진다. 절반만 정규화해서
       광량 손실은 줄이되 색은 남긴다 — 가산 블렌딩이라 완전히 안 나누면 어두워진다. */
    float mx = max(max(tint.r, tint.g), tint.b);
    tint /= mix(1.0, mx, 0.55);

    if (a < 0.003) discard;
    gl_FragColor = vec4(tint, a * uOpacity);
  }
`;

function GlobeHaze({ intensity, instant }: { intensity: number; instant: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const fade = useRef(instant ? 1 : 0);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HAZE_VERTEX,
        fragmentShader: HAZE_FRAGMENT,
        uniforms: { uOpacity: { value: instant ? intensity : 0 } },
        transparent: true,
        depthWrite: false,
        /* 파티클과 같은 가산. 배경이 파스텔이라 이 층이 곧 "빛"이 된다. */
        blending: THREE.AdditiveBlending,
      }),
    [intensity, instant],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_state, delta) => {
    const m = matRef.current;
    if (!m || instant) return;
    if (fade.current < 1) fade.current = Math.min(1, fade.current + delta / 1.1);
    const o = m.uniforms.uOpacity;
    if (o) o.value = fade.current * intensity;
  });

  return (
    /* 파티클 껍질(GLOBE_RADIUS)보다 아주 조금 안쪽. 같은 반지름이면 가장자리에서
       헤이즈가 파티클 밖으로 삐져나와 테두리가 두 겹으로 보인다. */
    <mesh renderOrder={-2} frustumCulled={false}>
      <planeGeometry args={[GLOBE_RADIUS * 1.97, GLOBE_RADIUS * 1.97]} />
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}

function CoreGlowMaterial() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CORE_VERTEX,
        fragmentShader: CORE_FRAGMENT,
        uniforms: {
          // globals.css --primary-300 / --primary-500
          /* 시안의 코어는 **작고 흰빛에 가까운 시안**이다. primary-500 을 그대로 쓰면
             보라빛 덩어리가 되어 시안보다 훨씬 무겁다(실제로 그렇게 보였다). */
          uInner: { value: new THREE.Color("#ffffff") },
          uOuter: { value: new THREE.Color("#4aa8f0") },
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
