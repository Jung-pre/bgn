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
import { GLOBE_TUNE_DEFAULTS, getGlobeTune } from "./globe-tune";

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
  desktop: { land: 120000, shell: 78000, halo: 16000 },
  mobile: { land: 26000, shell: 16000, halo: 4500 },
} as const;

/** 지축 기울기 23.4°(rad). 정확히 기울여야 "지구"로 읽힌다. */
const AXIAL_TILT = 0.409;

/**
 * 수정요청(2차) "한국쪽 지도가 시작으로 보이게" — 정면 구도 보정 두 개.
 *
 * Euler 'XYZ'(Rx·Ry·Rz)라 지축 기울기(Rz)가 **먼저** 걸린다. 그 결과
 * FOCUS_ROTATION_Y 만으로는 한국이 화면 (0.18, 0.81) — 꼭대기 가장자리로
 * 밀려나고 정면 중앙은 호주가 차지했다(마스크를 그대로 투영해 확인).
 *
 *   · PITCH_X 0.55 : 위도 37.5°+기울기만큼 위로 밀린 한국을 화면 중앙대로 내린다
 *   · YAW_TRIM -8° : 내린 뒤 남는 우측 치우침(x 0.18)을 0.10 으로
 *
 * 이 값에서 한국은 화면 (0.10, 0.39), z 0.92 — 정면 상단 중앙에 또렷이 온다.
 * (검증 스크립트: 랜드마스크를 같은 회전으로 정사영해 픽셀로 확인했다)
 */
const FOCUS_PITCH_X = 0.55;
const FOCUS_YAW_TRIM = -8 * (Math.PI / 180);

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
  /**
   * 비인터랙티브(푸터·클로징) 구체 크기 배수.
   * 히어로 `size` 0.86 과 섞이지 않게 이쪽만 따로 둔다.
   */
  fitSize?: number;
}

export function SphereScene({
  active,
  progressRef,
  intensity = 1,
  haze = intensity,
  showCore = true,
  interactive = true,
  fitSize = 1,
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
        fitSize={fitSize}
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
  fitSize,
}: {
  progressRef?: RefObject<number>;
  reduced: boolean;
  intensity: number;
  haze: number;
  showCore: boolean;
  interactive: boolean;
  fitSize: number;
}) {
  const isMobile = useIsMobileLayout();
  const counts = isMobile ? COUNTS.mobile : COUNTS.desktop;

  const groupRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const bodyMeshRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  /**
   * 은하수 진행도 / 원형 평판 잔량.
   *
   * 이 `useFrame` 에서 계산해 자식(PointLayer·GlobeBodyMaterial)이 읽는다.
   * R3F 는 등록 순서대로 프레임 콜백을 돌리고 부모가 먼저 렌더되므로
   * 부모 → 자식 순서가 보장된다(한 프레임 지연 없음).
   */
  const galaxyRef = useRef(0);
  const bodyCoverRef = useRef(1);
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
   *
   * 히어로만 `GLOBE_TUNE_DEFAULTS.size`(0.86) 로 한 걸음 물린다 — 카피·마퀴 여백.
   * 클로징·푸터는 그 배율을 쓰면 안 된다. 배경 요소로 쓰던 원래 크기(1)를 유지한다.
   */
  const fitScale =
    Math.min(1, (size.width / size.height) * 1.05) *
    (interactive ? GLOBE_TUNE_DEFAULTS.size : fitSize);

  /** demand 모드(동작 줄이기)에서는 한 번은 그려야 화면이 빈 채로 남지 않는다 */
  useEffect(() => {
    if (reduced) invalidate();
  }, [reduced, invalidate]);

  useFrame((_state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    /* 히어로만 라이브 스토어를 읽는다. 클로징·푸터는 코드 기본값. */
    const tune = interactive ? getGlobeTune() : null;
    const yawTrim = tune ? tune.yawTrimDeg * (Math.PI / 180) : FOCUS_YAW_TRIM;
    const pitchX = tune ? tune.pitchX : FOCUS_PITCH_X;
    const sizeMul = interactive ? (tune?.size ?? GLOBE_TUNE_DEFAULTS.size) : fitSize;
    const fitted = Math.min(1, (_state.size.width / _state.size.height) * 1.05) * sizeMul;
    const scrollNow = progressRef?.current ?? 0;
    const fadeStartNow = tune?.fadeStart ?? 0.16;
    const fadeEndNow = tune?.fadeEnd ?? 0.78;
    const zoomTNow = interactive
      ? Math.min(
          1,
          Math.max(0, (scrollNow - fadeStartNow) / Math.max(0.02, fadeEndNow - fadeStartNow)),
        )
      : 0;
    /**
     * 히어로만: 확대 → (은하수) → 축소.
     *
     * 예전엔 `grow` 가 끝까지 단조 증가라 구체가 화면 밖으로 계속 커지다가
     * 통째로 페이드아웃했다(진행도 0.6 근처가 **흰 화면 한 장**이었다).
     * 이제 `zoomIn` 으로 화면을 채운 뒤 `zoomOut` 으로 되돌아오며,
     * 그 되돌아오는 구간에서 파티클이 은하수로 펴진다 — 사용자가 말한
     * "다시 축소되어 2번 섹션이 나올 때"가 이 구간이다.
     */
    const zin = smoothRange(zoomTNow, CUE.zoomIn[0], CUE.zoomIn[1]);
    const zout = smoothRange(zoomTNow, CUE.zoomOut[0], CUE.zoomOut[1]);
    /* 곡선은 기존과 같은 모양(0.78 선형 + 0.22 제곱)을 유지한다 */
    const zoomNow = zin * 0.78 + zin * zin * 0.22;
    /**
     * 최대 4.45 → 은하수가 다 펴지는 지점에서 **0.6**.
     *
     * 원반은 `spread` 로 반경이 1.9배까지 벌어진다. 배율을 1 근처로만 되돌리면
     * 실효 반경이 구체의 2.4배가 되어 띠가 화면 밖으로 넘친다(실제로 그랬다).
     * 0.6 이면 실효 1.1 배 — 원반 전체가 여백을 두고 화면에 들어온다.
     */
    const grow =
      interactive && !reduced
        ? 1 + zoomNow * 3.45 - zout * (tune?.gxShrink ?? GLOBE_TUNE_DEFAULTS.gxShrink)
        : 1;
    const galaxyNow =
      interactive && !reduced
        ? smoothRange(zoomTNow, tune?.gxStart ?? CUE.galaxy[0], tune?.gxEnd ?? CUE.galaxy[1])
        : 0;
    galaxyRef.current = galaxyNow;
    /* 원형 평판은 은하수가 펴지기 전에 사라진다 */
    bodyCoverRef.current = 1 - smoothRange(zoomTNow, CUE.bodyOut[0], CUE.bodyOut[1]);
    g.scale.setScalar(fitted * grow);
    bodyGroupRef.current?.scale.setScalar(fitted * grow);
    if (bodyMeshRef.current) bodyMeshRef.current.visible = tune ? tune.showBody : true;
    if (coreRef.current) coreRef.current.visible = showCore && (tune ? tune.showCore : true);

    if (reduced) {
      // 정지 구도 — 기울기만 유지하고 애니메이션은 전부 건너뛴다.
      g.rotation.set(pitchX, FOCUS_ROTATION_Y + yawTrim, AXIAL_TILT);
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

    // 정면 경도(FOCUS_ROTATION_Y)를 기준으로 삼고, 인트로는 그 앞에서 살짝 돌다 멈춘다.
    // 클로징은 포인터가 없어서, 스크롤·느린 자전이 없으면 인트로 1.8초 뒤 완전히 멈춘다.
    //
    // 수정요청(2차): "한국쪽 지도가 시작으로 보이게".
    //   · 진입 오프셋 0.55(≈31.5°)는 한국이 1.8초 뒤에야 정면에 오는 값이라 0.12 로.
    //     첫 프레임에도 한반도가 구체 중앙 ±7° 안에 있고, "살짝 돌며 등장"은 남는다.
    //   · scroll 0.9 도 같은 이유로 0.35 로 — 스크롤을 조금만 내려도 한국이 옆으로
    //     달아나던 것을, 전환 끝(진행도 1)에 20° 만 돌게 줄인다.
    const idle = interactive
      ? _state.clock.elapsedTime * (tune?.spinRate ?? 0)
      : _state.clock.elapsedTime * 0.07;
    const yawKeep = interactive ? 1 - zoomTNow * 0.85 : 1;
    /**
     * 은하수는 **화면 수평**으로 흘러야 한다(수정요청: "방향이 너무 잘못된 거 같아").
     *
     * 밴드는 로컬 XY 평면에 만든다. 그런데 이 그룹은 pitch 0.55 + 지축 기울기로
     * 기울어 있어서 그대로 두면 띠가 사선으로 눕고 원근으로 찌그러진다.
     * 그래서 `uGalaxy` 가 차오르는 만큼 회전을 0 으로 수렴시킨다 —
     * 구체일 때의 기울기는 그대로 두고, 펴지는 동안 반듯해진다.
     */
    const upright = 1 - galaxyNow;
    g.rotation.y =
      (FOCUS_ROTATION_Y +
        yawTrim +
        (1 - introEase) * (tune?.introYaw ?? 0.12) +
        scrollNow * (tune?.scrollYaw ?? 0.35) * yawKeep +
        eased.current.x * (tune?.pointerYaw ?? 0.3) +
        idle) *
      upright;
    // 지축 기울기를 고정으로 주고 그 위에 포인터 반응을 얹는다
    g.rotation.z = AXIAL_TILT * upright;
    g.rotation.x = (pitchX + eased.current.y * (tune?.pointerPitch ?? 0.16)) * upright;

    if (showCore) updateCore(coreRef.current, g, camera, introEase);
  });

  return (
    <>
      {/* 회전 그룹 밖 — 껍질의 산란광이라 구체와 같이 돌면 안 된다 */}
      <group ref={bodyGroupRef} scale={fitScale}>
        {/**
         * ## ⚠️ 바디 평판은 **회전 그룹 밖**이어야 한다
         *
         * 처음엔 아래 `groupRef` 안(파티클과 같은 그룹)에 넣었다. 그 그룹은 매
         * 프레임 Y 축으로 돌기 때문에 **평판이 같이 뒤집힌다** — 옆으로 서는 순간
         * 화면에는 선으로 눌려 아무것도 못 가린다.
         *
         * 실측이 그대로 나왔다: 마퀴가 구체 **안에서 오히려 더 잘 보였다**
         * (실효 투과율 140%). 알파를 아무리 올려도 안 되던 이유가 이거다.
         * 산란광(GlobeHaze)이 같은 이유로 이미 여기 있다.
         *
         * renderOrder -3 → 헤이즈(-2)·파티클보다 먼저 깔린다.
         */}
        <mesh ref={bodyMeshRef} renderOrder={-3} frustumCulled={false}>
          <planeGeometry args={[GLOBE_RADIUS * 1.97, GLOBE_RADIUS * 1.97]} />
          <GlobeBodyMaterial
            intensity={intensity}
            instant={reduced}
            live={interactive}
            coverRef={bodyCoverRef}
          />
        </mesh>
        <GlobeHaze intensity={haze} instant={reduced} live={interactive} />
      </group>
      {/* 수정요청(2차) "질감이 더 투명같지않게" — 레이어 알파를 시안 실측값
          (0.55/0.95/1.0)으로 복원. 직전 커밋에서 0.20/0.36/0.42 로 내려가
          구체가 속이 비쳐 보였고, 클로징 스피어 튜닝(intensity 0.12)도
          이 원본 알파를 기준으로 잰 값이라 복원이 곧 회귀 수정이다. */}
      <group
        ref={groupRef}
        rotation={[FOCUS_PITCH_X, FOCUS_ROTATION_Y + FOCUS_YAW_TRIM, AXIAL_TILT]}
        scale={fitScale}
      >
        <PointLayer
          cloud={halo}
          kind="halo"
          color="#ffffff"
          size={0.03}
          opacity={1.0 * intensity}
          instant={reduced}
          tint={1.0}
          pointerRef={push}
          pushScale={interactive ? 1.2 : 0}
          live={interactive}
          galaxyRef={galaxyRef}
        />
        <PointLayer
          cloud={shell}
          kind="shell"
          color="#eef4ff"
          size={0.024}
          opacity={0.8 * intensity}
          instant={reduced}
          tint={1.0}
          pointerRef={push}
          pushScale={interactive ? 1 : 0}
          live={interactive}
          galaxyRef={galaxyRef}
        />
        <PointLayer
          cloud={land}
          kind="land"
          color="#ffffff"
          size={0.03}
          opacity={0.28 * intensity}
          instant={reduced}
          tint={1.0}
          pointerRef={push}
          pushScale={interactive ? 0.85 : 0}
          live={interactive}
          galaxyRef={galaxyRef}
        />

        {/* 수정요청(26.08.24) "지구 주변에 둘러져있는 행성같은 띠는 빼주세요" — 궤도 고리 제거 */}

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
  uniform float uGalaxy;      // 0 = 구체 / 1 = 은하수 밴드
  uniform vec4 uGxPose;       // (tilt rad, yaw rad, offX, offY)
  uniform vec4 uGxShape;      // (length, thick, amp, gap)
  uniform float uGxBands;
  uniform float uTime;
  varying float vScale;
  varying vec2 vScreen;
  varying float vGalaxy;

  void main() {
    /**
     * ## 구체 → 은하수
     *
     * 수정요청: "파티클들을 끌어와서 다시 은하수를 만드는 부분이 더 잘 보이게".
     *
     * 구(球)를 **XZ 평면 원반**으로 눌러 나선으로 감는다:
     *  ① 'pos.y' 를 거의 0 으로 눌러 납작하게 만든다 — 원반의 두께가 된다.
     *  ② 바깥 입자일수록 더 감기게 각도를 더한다(differential rotation).
     *     같은 각속도로 돌리면 구체가 통째로 도는 것처럼 보여 "빨려든다"가 안 산다.
     *  ③ 반경을 벌려('spread') 화면을 가로지르는 띠가 되게 한다.
     *
     * ⚠️ 원반의 법선은 로컬 +Y 다. 그룹이 'rotation.x = 0.55'(≈31°)로 기울어 있어
     *    화면에서는 **31° 로 열린 타원 띠**로 보인다 — 정확히 은하수 실루엣이다.
     *    여기서 각도를 더 주면 정면 원반이 되어 그냥 "소용돌이 판"이 된다.
     */
    vec3 pos = position;
    if (uGalaxy > 0.0005) {
      float g = uGalaxy;
      float R = max(length(pos), 1e-4);

      /**
       * ## 구체 → 은하수 = 겹치는 라인 밴드
       *
       * 모양·자세는 전부 **튜닝 패널**(globe-tune 의 gx* 값)이 정한다.
       * 기울기는 **고정**이다 — 전환 도중 회전시키지 않는다.
       *
       * uGxPose  = (기울기rad, 깊이yaw rad, 오프셋X, 오프셋Y)
       * uGxShape = (길이, 두께, 진폭, 밴드간격)
       * uGxBands = 밴드 개수
       */
      float h1 = fract(sin(dot(position, vec3(12.9898, 78.2330, 37.7190))) * 43758.5453);
      float h2 = fract(sin(dot(position, vec3(93.9898, 67.3450, 11.1350))) * 24634.6345);
      float h3 = fract(sin(dot(position, vec3(45.3320, 19.8740, 88.2190))) * 15731.7431);

      float nb = max(1.0, uGxBands);
      float band = floor(h1 * nb);
      float phase = band * 2.1;
      float amp = uGxShape.z - band * 0.09;
      /* 밴드끼리 세로로 어긋나게 두어 서로 교차한다 */
      float baseY = (band - (nb - 1.0) * 0.5) * uGxShape.w;

      /* 밴드를 따라가는 위치 -1..1 — 길이를 키우면 화면 밖까지 나간다 */
      float ax = h2 * 2.0 - 1.0;
      float X = ax * uGxShape.x;

      /* 두 하모닉을 겹쳐 리본처럼 완만하게 굽힌다 */
      float w = sin(ax * 2.0 + phase + uTime * 0.10) * 0.62
              + sin(ax * 3.7 + phase * 1.7 - uTime * 0.07) * 0.28;
      /* 밴드 두께 — 가운데가 촘촘하고 위아래로 성글어진다 */
      float t3 = (h3 - 0.5);
      float Y = baseY + amp * w + t3 * abs(t3) * uGxShape.y;
      float Z = (fract(h3 * 7.31) - 0.5) * 0.35;

      /**
       * 자세 — 두 번 돌린다. 순서가 중요하다:
       *  1) Y축(깊이) — 한쪽 끝을 카메라에서 멀리 보낸다. 이게 없으면 아무리
       *     기울여도 벽에 붙은 그림이다. 원근이 먼 쪽을 좁혀야 공간감이 난다.
       *  2) Z축(화면 기울기) — +30도면 8시→2시, -20도면 10시→4시.
       * 반대로 하면 기울기가 원근에 먹혀 각도가 눕는다.
       */
      vec3 b = vec3(X + uGxPose.z, Y + uGxPose.w, Z);
      float cy = cos(uGxPose.y);
      float sy = sin(uGxPose.y);
      b = vec3(b.x * cy + b.z * sy, b.y, -b.x * sy + b.z * cy);
      float cz = cos(uGxPose.x);
      float sz = sin(uGxPose.x);
      b = vec3(b.x * cz - b.y * sz, b.x * sz + b.y * cz, b.z);

      pos = mix(pos, b * R, g);
    }
    vGalaxy = uGalaxy;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
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
    /* 은하수 구간에서는 입자를 조금 키운다 — 반경이 벌어지며 밀도가 떨어져
       그냥 두면 띠가 옅어져 "잘 안 보인다". */
    gl_PointSize = uSize * (1.0 + grow * 0.5) * (1.0 + uGalaxy * 0.85) * (uHeight * 0.5) / max(0.001, -mv.z);
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
  varying float vGalaxy;

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
    /* 좌측은 피치·라벤더, 하늘은 중반부터. 끝만 섞으면 파랑이 사라진다. */
    vec3 left = mix(mix(WARM, GOLD, smoothstep(0.02, 0.38, y)), LAV, smoothstep(0.34, 0.90, y));
    /* 수정요청(2차) 젤리공 레퍼런스: 성에 도트는 어디서나 흰색이고 파랑은
       심장(바디)뿐이다. 우측 COOL 램프를 절반 이하로 — 프린지도 같이 준다. */
    vec3 tint = mix(left, COOL, smoothstep(0.36, 1.00, x) * 0.4);
    /* 도트는 어디서나 **거의 흰색**이다(젤리공 레퍼런스). 림에 몰린 헤일로
       도트가 램프색을 그대로 받아 위 보라·아래 주황 아크가 생겼었다. */
    tint = mix(tint, vec3(1.0), 0.55);
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
    col *= 1.0 + rim * 0.18;
    /* 좌상단 가산 파티클이 대륙을 흰 덩어리로 만든다 */
    float hot = smoothstep(0.52, 0.0, x) * smoothstep(0.36, 0.82, y);
    /* 윗호는 빼 둔다. y 0.95 까지 곱하면 머리 꼭대기가 배경으로 꺼져 빵구로 읽힌다. */
    /* ⚠️ 은하수 구간에서는 이 억제를 푼다. 구체일 때 대륙이 뭉치는 걸 막는 보정인데
       원반으로 펴진 뒤에도 걸려 있으면 띠의 왼쪽 절반만 어두워져 반쪽만 보인다. */
    col *= 1.0 - hot * 0.46 * (1.0 - vGalaxy);

    /* 은하수는 배경(밝은 하늘)과 붙어 있어 그대로 두면 묻힌다.
       가산 블렌딩이라 광량을 올리는 것이 곧 가시성이다. */
    /* 배경이 어두운 딤이 아니라 **2번 섹션 하늘**이라 그만큼 더 밝아야 산다 */
    col *= 1.0 + vGalaxy * 0.28;
    /* 은하수는 1까지 올리지 않는다. 최대 0.8 */
    float alpha = a * vScale * uOpacity * mix(1.0, 0.8, vGalaxy);

    gl_FragColor = vec4(col, min(alpha, mix(1.0, 0.8, vGalaxy)));
  }
`;

/**
 * ## 구체 → 은하수 → 라인 (수정요청 26.08.25)
 *
 * 진행도 `t`(= fadeStart~fadeEnd 를 0~1 로 편 값) 기준 큐 시트다.
 * 세 요청을 그대로 옮겼다:
 *   ① "확대 모션은 너무 좋아"      → `ZOOM_IN` 구간의 곡선은 손대지 않는다.
 *   ② "은하수가 더 잘 보이길"      → `GALAXY` 를 넓게 잡고 그 뒤에 **정지 구간**을 둔다.
 *   ③ "원형 오브젝트는 안 보여도 됨" → `BODY_OUT` 이 은하수보다 **먼저** 끝난다.
 *
 * 순서가 핵심이다. 바디(원형 평판)가 남아 있으면 파티클이 그 위에 묻혀
 * 은하수가 안 읽힌다. 그래서 바디를 먼저 지우고, 그다음 파티클을 편다.
 */
const CUE = {
  /** 확대 — 여기까지 최대 배율. 이 곡선이 "좋다"고 한 그 모션이다. */
  zoomIn: [0.0, 0.46],
  /** 원형 평판(바디) 소멸 — 은하수가 펴지기 전에 완전히 사라진다 */
  bodyOut: [0.26, 0.48],
  /**
   * 파티클이 라인으로 모인다.
   * 시작이 늦으면 최대 확대 상태(배율 4.45)로 파티클이 흩어진 채 머무는
   * **빈 프레임**이 생긴다. 확대가 끝나자마자 바로 모이기 시작해야 한다.
   */
  galaxy: [0.29, 0.64],
  /**
   * 다시 축소 — 은하수와 **같이** 진행한다.
   *
   * 처음엔 축소를 은하수 뒤(0.5~0.88)에 뒀는데, 원반이 다 펴지는 순간에도
   * 배율이 4.3 이라 띠가 화면보다 훨씬 커져 "은하수"가 아니라 화면을 덮은
   * 반짝이는 텍스처로 읽혔다. 펴짐과 축소가 같이 가야 띠 전체가 화면에 들어온다.
   */
  zoomOut: [0.34, 0.68],
} as const;

/** smoothstep(a,b,x) 와 같다 */
function smoothRange(x: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-4, b - a)));
  return t * t * (3 - 2 * t);
}

const LAYER_SHOW = {
  halo: "showHalo",
  shell: "showShell",
  land: "showLand",
} as const;
const LAYER_OPACITY = {
  halo: "haloOpacity",
  shell: "shellOpacity",
  land: "landOpacity",
} as const;
const LAYER_SIZE = {
  halo: "haloSize",
  shell: "shellSize",
  land: "landSize",
} as const;
const LAYER_PUSH = {
  halo: "haloPush",
  shell: "shellPush",
  land: "landPush",
} as const;

function PointLayer({
  cloud,
  kind,
  color,
  size,
  opacity,
  instant,
  tint,
  pointerRef,
  pushScale,
  live,
  galaxyRef,
}: {
  cloud: PointCloud;
  kind: "halo" | "shell" | "land";
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
  /** 히어로만 라이브 스토어를 읽는다. */
  live: boolean;
  /** 0 = 구체 / 1 = 은하수 원반. 부모가 매 프레임 쓴다. */
  galaxyRef?: RefObject<number>;
}) {
  const fade = useRef(instant ? 1 : 0);
  const groupRef = useRef<THREE.Group>(null);
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
          uGalaxy: { value: 0 },
          uGxPose: { value: new THREE.Vector4(0.2618, 0.2618, 0.08, -1.2) },
          uGxShape: { value: new THREE.Vector4(5.4, 1.45, 0.62, 0.14) },
          uGxBands: { value: 3 },
          uTime: { value: 0 },
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

  useFrame(({ size: viewSize, viewport, clock }, delta) => {
    const m = matRef.current;
    if (!m) return;
    const h = m.uniforms.uHeight;
    if (h) h.value = viewSize.height * viewport.dpr;

    const ug = m.uniforms.uGalaxy;
    if (ug) ug.value = galaxyRef?.current ?? 0;
    /* 모양·자세는 패널이 정한다. 히어로가 아니면 기본값 그대로. */
    const gt = live ? getGlobeTune() : GLOBE_TUNE_DEFAULTS;
    const upose = m.uniforms.uGxPose;
    if (upose)
      (upose.value as THREE.Vector4).set(
        (gt.gxTiltDeg * Math.PI) / 180,
        (gt.gxYawDeg * Math.PI) / 180,
        gt.gxX,
        gt.gxY,
      );
    const ushape = m.uniforms.uGxShape;
    if (ushape) (ushape.value as THREE.Vector4).set(gt.gxLength, gt.gxThick, gt.gxAmp, gt.gxGap);
    const ubands = m.uniforms.uGxBands;
    if (ubands) ubands.value = Math.max(1, Math.round(gt.gxBands));
    const ut = m.uniforms.uTime;
    if (ut) ut.value = clock.elapsedTime;

    const t = live ? getGlobeTune() : null;
    if (groupRef.current) {
      groupRef.current.visible = t ? t[LAYER_SHOW[kind]] : true;
    }
    const layerOpacity = t ? t[LAYER_OPACITY[kind]] * t.intensity : opacity;
    const layerSize = t ? t[LAYER_SIZE[kind]] : size;
    const layerPush = t ? t[LAYER_PUSH[kind]] : pushScale;
    const pMax = t?.pushMax ?? PUSH_MAX;
    const pRad = t?.pushRadius ?? PUSH_RADIUS;

    const us = m.uniforms.uSize;
    if (us) us.value = layerSize;
    const ur = m.uniforms.uPushRadius;
    if (ur) ur.value = pRad;

    // ── 커서 반발 ────────────────────────────────────────────────
    const p = pointerRef.current;
    const up = m.uniforms.uPointer;
    if (up) (up.value as THREE.Vector2).set(p.x, p.y);
    const ua = m.uniforms.uAspect;
    if (ua) ua.value = viewSize.height > 0 ? viewSize.width / viewSize.height : 1;
    const upush = m.uniforms.uPush;
    if (upush) upush.value = p.strength * layerPush * pMax;

    const o = m.uniforms.uOpacity;
    if (instant) {
      if (o) o.value = layerOpacity;
      return;
    }
    // 로딩 화면 없이 텍스트가 먼저 뜨고, 3D 는 준비되는 대로 스며든다
    if (fade.current < 1) fade.current = Math.min(1, fade.current + delta / 1.1);
    if (o) o.value = fade.current * layerOpacity;
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[cloud.positions, 3]} />
          <bufferAttribute attach="attributes-aScale" args={[cloud.scales, 1]} />
        </bufferGeometry>
        <primitive ref={matRef} object={material} attach="material" />
      </points>
    </group>
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
    float a = (halo * 0.14 + core * 0.32) * uOpacity;
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
  const vec3 LAV  = vec3(0.90, 0.88, 1.00);
  const vec3 COOL = vec3(0.58, 0.82, 1.00);

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
    /* 하늘은 우측 절반. 0.30부터면 전체가 파랗고, 0.62부터면 파랑이 안 보인다. */
    vec3 tint = mix(left, COOL, smoothstep(0.42, 1.00, x) * 0.45);
    /* 젤리공 레퍼런스의 림은 무지개가 아니라 **흰 성에**다 — 헤이즈가 림
       전용 레이어라 램프색이 그대로 아크로 보였다(위 보라·아래 주황).
       채도를 절반 넘게 걷어낸다. */
    tint = mix(tint, vec3(1.0), 0.58);
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

function GlobeHaze({
  intensity,
  instant,
  live,
}: {
  intensity: number;
  instant: boolean;
  live: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
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
    if (!m) return;
    const t = live ? getGlobeTune() : null;
    if (meshRef.current) meshRef.current.visible = t ? t.showHaze : true;
    const target = t ? t.haze : intensity;
    const o = m.uniforms.uOpacity;
    if (instant) {
      if (o) o.value = target;
      return;
    }
    if (fade.current < 1) fade.current = Math.min(1, fade.current + delta / 1.1);
    if (o) o.value = fade.current * target;
  });

  return (
    /* 파티클 껍질(GLOBE_RADIUS)보다 아주 조금 안쪽. 같은 반지름이면 가장자리에서
       헤이즈가 파티클 밖으로 삐져나와 테두리가 두 겹으로 보인다. */
    <mesh ref={meshRef} renderOrder={-2} frustumCulled={false}>
      <planeGeometry args={[GLOBE_RADIUS * 1.97, GLOBE_RADIUS * 1.97]} />
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}

/**
 * ## 젤리 바디 — 구체를 **채우는** 층
 *
 * 수정요청(26.08.24): "지구가 지금은 투명한 느낌이라 빛 요소, 지구 자체의 밀도가
 * 채워져있어야 합니다 (레퍼처럼 젤리같은 느낌에 글자가 보이지 않도록)".
 *
 * 기존 헤이즈 층은 **가산 합성**이라 원리적으로 뒤를 가릴 수 없다 — 빛을 더하기만
 * 한다. 그래서 파티클을 아무리 늘려도 뒤 글자가 비쳤다. 이 층은 일반 합성으로
 * 가운데를 실제로 덮고, 가장자리에서만 알파가 빠진다.
 *
 * 파티클 껍질 **안쪽**(0.985R)에 두어 점들이 이 위에 표면 디테일로 얹히게 한다.
 */
const BODY_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BODY_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uLit;
  uniform vec3 uShade;
  uniform float uOpacity;
  uniform float uFill;
  uniform float uRim;
  uniform float uCau;
  uniform float uPearl;
  uniform float uEdge;

  /* 시안(205:421 / img_01_sphere01) 안쪽은 강철 블루가 아니다.
     좌 피치·라벤더 → 가운데 진주 → 우측에만 하늘.
     채도를 세게 잡고 알파를 0.98로 두면 밝은 동시에 무거운 원반이 된다. */
  const vec3 WARM  = vec3(0.90, 0.78, 0.82);
  const vec3 LAV   = vec3(0.80, 0.78, 0.90);
  const vec3 PEARL = vec3(0.84, 0.88, 0.96);
  const vec3 COOL  = vec3(0.42, 0.70, 0.98);

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    /* 구면 법선을 복원해 한쪽에서 빛이 드는 젤리로 만든다 */
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 n = vec3(p, z);
    /* 예전 (-0.42, 0.46) 은 좌상단이 하이라이트로 하얗게 날아갔다. */
    float lit = clamp(dot(n, normalize(vec3(0.18, 0.12, 0.96))), 0.0, 1.0);

    /**
     * ## 불투명한 원반이 아니라 **반투명 젤**
     *
     * 수정요청(26.08.24 후속): "밀도 즉 안이 차보이는 느낌 … 약간 투명 젤리같은 느낌".
     * 앞 버전은 심 알파가 0.97 이라 그냥 **불투명한 공**이었다. 뒤가 안 비치니
     * 요구는 만족했지만 젤리가 아니라 플라스틱으로 보였다.
     *
     * 젤은 빛이 **통과하면서 산란**한다. 그래서 세 가지를 같이 준다:
     *  ① 두께에 따라 알파가 변한다 — 가장자리는 얇아 비치고 심은 막힌다.
     *     (원형 div + backdrop-filter 로 "비치되 안 읽히게" 하려던 시도는
     *      CSS 쪽 주석대로 무효였다. 그래서 심은 알파로 막는다.)
     *  ② 두께에 비례한 내부 산란 — 가운데가 두꺼우니 더 밝고 뿌옇다 (밀도감)
     *  ③ 굴절 반점(caustic) — 젤 안에서 빛이 몰린 자리. 이게 있어야 속이
     *    "차 있다"로 읽힌다. 없으면 그냥 옅은 원이다.
     */
    /* 두께 — 구면이라 가운데가 가장 두껍다. 그대로 산란량이 된다. */
    float thick = z;

    /**
     * ## ⚠️ 알파에 **두께를 곱하면 안 된다**
     *
     * 알파 = (0.16 + 0.84 x thick^0.62) 로 뒀더니 가장자리로 갈수록 투명해져서,
     * 마퀴가 구체 **좌우 림에서 그대로 새어 나왔다**(r=0.9 에서 알파 0.62).
     * 화면 정가운데만 막히고 양옆에서 글자가 보이니 "여전히 잘 보인다" 가 된다.
     *
     * 두께감은 **색**(아래 lit·cau)이 이미 만들고 있다. 알파는 실루엣까지
     * 평평하게 두고 마지막 6% 반경에서만 떨어뜨린다.
     */
    float fill = smoothstep(1.0, uEdge, r);

    /**
     * ③ 굴절 반점.
     * ⚠️ 주파수를 7 대로 두면 반점이 **흰 타원 얼룩**으로 뭉친다(렌즈 플레어처럼
     * 보였다). 젤 속 굴절은 그보다 훨씬 잘다 — 주파수를 두 배로 올리고 세기를
     * 절반으로 내려야 "속이 차 있다"로 읽힌다.
     */
    float cau = sin(n.x * 15.3 + n.y * 11.7) * sin(n.y * 13.1 - n.z * 9.4);
    cau = pow(clamp(cau * 0.5 + 0.5, 0.0, 1.0), 3.0) * thick;

    /* 림 라이트 — 젤리의 가장자리가 밝게 서는 그 느낌 */
    float rim = pow(smoothstep(0.70, 1.0, r), 2.2);

    /* 안쪽 팔레트 — 평판 UV라 구체가 돌아도 색이 따라 돌지 않는다 */
    float x = p.x * 0.5 + 0.5;
    float y = p.y * 0.5 + 0.5;
    vec3 left = mix(WARM, LAV, smoothstep(0.10, 0.82, y));
    vec3 tint = mix(left, PEARL, smoothstep(0.20, 0.48, x) * 0.35);
    tint = mix(tint, COOL, smoothstep(0.30, 0.92, x) * 0.38);

    /* 색은 tint, 조명은 명암만. 대비를 세게 주면 속이 돌처럼 무거워진다. */
    vec3 shade = mix(tint, uShade, 0.10);
    vec3 highlight = mix(mix(tint, PEARL, 0.12), uLit, 0.05);
    vec3 col = mix(shade, highlight, pow(lit, 1.7));
    col = mix(col, PEARL, pow(thick, 2.0) * uPearl);
    col += cau * uCau;

    /**
     * 젤리 심장 — 수정요청(2차) 레퍼런스 픽셀 실측:
     *   중심 (167,205,246) / 중우측 (136,182,225) — **채도 있는 하늘색 발광**.
     *   젤리로 읽히는 건 성에 껍질이 아니라 이 파란 심장이다. 우리는 중심이
     *   (227,233,248) 흰색이라 그냥 뿌연 공이었다.
     * 내부 평균 휘도도 시안 199 vs 우리 228 — 0.93 배로 가라앉힌다.
     */
    vec3 HEART = vec3(0.47, 0.68, 0.92);
    vec2 hc = p - vec2(0.10, 0.0);
    float heart = exp(-dot(hc, hc) / 0.15);
    col = mix(col, HEART, heart * 0.85);
    /* 좌하단 분홍 기운 — 시안 (216,204,216) */
    vec2 pc = p - vec2(-0.52, -0.45);
    col = mix(col, vec3(0.88, 0.80, 0.86), exp(-dot(pc, pc) / 0.18) * 0.35);
    col *= 0.96;
    col += rim * uRim;
    /* 좌상단 핫스팟 — 대륙이 흰 덩어리로 뭉개지지 않게 */
    float hot = smoothstep(0.52, 0.0, x) * smoothstep(0.36, 0.82, y);
    /* 윗호는 빼 둔다. y 0.95 까지 곱하면 머리 꼭대기가 배경으로 꺼져 빵구로 읽힌다. */
    col *= 1.0 - hot * 0.28;

    /**
     * 수정요청(2차): "뒤에 글자가 아예 안 보이게끔 젤리공 같은 느낌".
     * 0.80 은 마퀴가 20% 로 비쳐 고대비 글자가 그대로 읽혔다. 0.95 로 막되,
     * 젤리 인상은 알파가 아니라 내부 산란(아래 PEARL·cau 상향)이 만든다 —
     * 0.98 이 볼링공으로 보였던 건 산란 없이 알파만 높였기 때문이다.
     */
    float a = clamp(fill * uFill + rim * 0.015, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

function GlobeBodyMaterial({
  intensity,
  instant,
  live,
  coverRef,
}: {
  intensity: number;
  instant: boolean;
  live: boolean;
  /**
   * 스크롤로 깎는 잔량 0~1.
   *
   * 수정요청: "다시 축소되어 2번 섹션이 나올 때 원형 오브젝트는 안 보여도 된다."
   * 튜닝 스토어의 `cover` 는 그대로 두고 여기에 곱한다 — 패널로 맞춰 둔
   * 기본 불투명도를 잃지 않으면서 스크롤로만 걷어낸다.
   */
  coverRef?: RefObject<number>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const fade = useRef(instant ? 1 : 0);
  const d = GLOBE_TUNE_DEFAULTS;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BODY_VERTEX,
        fragmentShader: BODY_FRAGMENT,
        uniforms: {
          /* 조명 폭만. 색은 BODY_FRAGMENT 의 이리데선트 tint 가 맡는다.
             강철 블루(#a8c0e4/#5e7fb4)로 두면 안쪽이 통째로 파랗게 읽힌다. */
          uLit: { value: new THREE.Color("#ebe0e8") },
          uShade: { value: new THREE.Color("#c8b8c2") },
          uOpacity: { value: instant ? intensity : 0 },
          uFill: { value: d.bodyFill },
          uRim: { value: d.bodyRim },
          uCau: { value: d.bodyCau },
          uPearl: { value: d.bodyPearl },
          uEdge: { value: d.bodyEdge },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        /* ⚠️ 가산이 아니라 **일반 합성**. 가산이면 뒤가 절대 안 가려진다. */
        blending: THREE.NormalBlending,
        premultipliedAlpha: true,
        toneMapped: false,
      }),
    [intensity, instant, d.bodyFill, d.bodyRim, d.bodyCau, d.bodyPearl, d.bodyEdge],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_state, delta) => {
    const m = matRef.current;
    if (!m) return;
    const t = live ? getGlobeTune() : null;
    if (t) {
      const uFill = m.uniforms.uFill;
      const uRim = m.uniforms.uRim;
      const uCau = m.uniforms.uCau;
      const uPearl = m.uniforms.uPearl;
      const uEdge = m.uniforms.uEdge;
      if (uFill) uFill.value = t.bodyFill;
      if (uRim) uRim.value = t.bodyRim;
      if (uCau) uCau.value = t.bodyCau;
      if (uPearl) uPearl.value = t.bodyPearl;
      if (uEdge) uEdge.value = t.bodyEdge;
    }
    const target = (t ? t.cover : intensity) * (coverRef?.current ?? 1);
    const o = m.uniforms.uOpacity;
    if (instant) {
      if (o) o.value = target;
      return;
    }
    if (fade.current < 1) fade.current = Math.min(1, fade.current + delta / 1.1);
    if (o) o.value = fade.current * target;
  });

  return <primitive ref={matRef} object={material} attach="material" />;
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
