"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CanvasShell, DPR_RANGE_HEAVY } from "@/r3f/canvas-shell";

/**
 * 타워 씬 띠 — handhold.io 히어로와 같은 **메쉬 + 도메인워프** 구조.
 *
 * 색·알파는 시안 실크 실측값이다. PNG 를 텍스처로 얹지 않는다.
 *   은백 #e9e9ef · 아이스블루 #bfd7f2 · 분홍 #facbda
 */

const SEG_X = 140;
const SEG_Y = 8;

/**
 * ⚠️ `new THREE.Color("#hex")` 를 그냥 쓰면 안 된다.
 *
 * three r152+ 는 색 관리가 기본으로 켜져 있어서 생성자가 **sRGB → 선형으로
 * 변환**한다. 그런데 이 셰이더는 raw ShaderMaterial 이라 출력에서 선형 → sRGB
 * 로 되돌리는 처리(`colorspace_fragment`)가 자동으로 안 붙는다. 변환이 한쪽만
 * 걸려서 #e9e9ef(0.91) 가 0.81 로, #bfd7f2 의 파랑기가 통째로 눌린 채 찍힌다
 * — 띠가 탁한 회색으로 보이던 원인이다.
 *
 * `setStyle(hex, LinearSRGBColorSpace)` 는 "이미 작업 색공간 값"이라고 알려
 * 변환을 건너뛴다. 시안에서 뽑은 sRGB 값이 그대로 화면에 나간다.
 */
const srgb = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

/**
 * 팔레트는 **원본 띠 아트(`img_01_line01/02/03.webp`) 실측값**에 맞춘 것이다.
 * 알파 0.12 이상 픽셀 기준:
 *   밝기(value)  평균 0.95~0.97   ← 시안 띠는 사실상 **흰색**이다
 *   채도(sat)    중앙 0.07~0.20 / 상위5% 0.29~0.49
 *   채도 있는 픽셀의 색상  파랑 200~260 이 **82~97%**, 분홍 8~13%, 금 1~5%
 *
 * 그래서 파랑이 주(主)이고 분홍은 소수 accent 다. 예전 `#8eb6e4` 는 밝기 0.894 로
 * 시안 아트 어디에도 없는 어두운 값이었다 — 띠가 탁해 보이던 이유.
 */
const PALETTE = [
  srgb("#c8ddf6"), // 아이스블루 — v 0.965 / s 0.184
  srgb("#f0f1f5"), // 은백(주) — v 0.961 / s 0.021
  srgb("#f6b2c4"), // 장미/빨강 accent — v 0.965 / s 0.276
  srgb("#a9c9ef"), // 깊은 파랑 — v 0.937 / s 0.289 (실측 상위5% 대역)
  srgb("#f7dfb4"), // 황금 — v 0.969 / s 0.271 (실측 색상 20~60도 대역)
] as const;

type RibbonSpec = {
  length: number;
  width: number;
  rotate: number;
  y: number;
  opacity: number;
  phase: number;
  scale: number;
};

/**
 * `width` 는 **띠 자체의 두께**다(세로 파동은 정점 셰이더가 따로 만든다).
 *
 * 카메라가 세로 -1~1 이라 화면 높이가 2 단위다.
 *
 * 시안 띠는 **선명한 심(core) + 안개처럼 풀리는 가장자리**로 되어 있어서, 눈에
 * 보이는 폭이 심의 두 배 가까이 된다. 그래서 판(plane)은 넉넉히 잡고 falloff
 * (아래 `veil`)로 녹인다 — 판을 심 두께에 맞추면(0.66/0.40) 띠가 가늘고
 * 딱딱하게 끝난다.
 *
 * 반대로 예전 값(1.55/1.15 = 화면 높이의 78%/58%)은 한 장이 화면을 덮었다.
 *
 * 예전 값(1.55 / 1.15)은 화면 높이의 78% / 58% 라 띠 한 장이 화면을 거의 덮었다.
 */
const RIBBONS: readonly RibbonSpec[] = [
  { length: 6.2, width: 2.0, rotate: -0.12, y: 0.02, opacity: 0.92, phase: 0, scale: 1 },
  { length: 5.4, width: 1.4, rotate: 0.22, y: -0.18, opacity: 0.68, phase: 2.1, scale: 0.86 },
];

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float a = position.x;
    float r = uv.y;
    float t = uTime * 0.7 + uPhase;

    /**
     * 척추 파동 — 띠가 그리는 큰 S 자.
     *
     * 판 두께를 1.5 → 2.0 으로 키우면서 이 값을 그대로 두면 **상대적으로 납작해진다.**
     * 두께에 비례해 올려야 같은 인상이 유지된다. 0.15 → 0.26.
     */
    float s = 0.26 * (
      0.50 * sin(0.9 * a + 0.4 + 0.10 * t) +
      0.30 * sin(1.7 * a - 0.6 + 0.07 * t) +
      0.20 * sin(2.8 * a + 1.0 + 0.05 * t)
    );

    /* 잔물결도 같은 비율로. 뒤쪽 항(비틀림·사선)은 그대로 둔다 — 같이 키우면
       결이 너무 잘게 흔들려서 실크가 아니라 물결무늬가 된다. */
    float o =
      0.130 * sin(1.4 * a + 0.2 + 0.40 * t) +
      0.072 * sin(2.5 * a - 0.5 + 0.28 * t) +
      0.036 * sin(3.8 * a + 0.8 + 0.18 * t) +
      (0.15 * sin(3.6 * a + 1.2 + 0.32 * t) + 0.08 * sin(6.4 * a - 0.4 + 0.22 * t)) * ((r - 0.5) * 2.0) +
      0.04 * sin(3.5 * a + 5.0 * r + 0.35 * t) +
      0.02 * sin(5.5 * a - 3.5 * r + 0.22 * t);

    vec3 p = vec3(a, s + o, (r - 0.5) * 1.5);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uWarp;
  uniform float uSpeed;
  uniform float uNoiseScale;
  uniform float uAspect;
  uniform float uOpacity;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  varying vec2 vUv;

  /**
   * 해시 화이트노이즈.
   *
   * 그레인을 simplex 로 만들면 주파수를 올리는 순간 **셀(비늘) 무늬**가 드러난다.
   * 해시는 픽셀마다 독립이라 아무리 잘게 써도 구조가 안 생긴다 — 필름 그레인·
   * 직물 결에는 이쪽이 맞다.
   */
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.56);
    return fract(p.x * p.y);
  }

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
      -0.577350269189626,
      0.024390243902439
    );
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = vUv;
    if (uAspect > 1.0) uv.x *= uAspect;
    else uv.y /= max(uAspect, 0.001);

    float time = uTime * uSpeed;
    vec2 t1 = time * vec2(0.017, -0.013);
    vec2 t2 = time * vec2(-0.011, 0.019);

    vec2 q = vec2(
      snoise(uv * uNoiseScale + t1),
      snoise(uv * uNoiseScale + vec2(5.2, 1.3) + t1 * 0.8)
    );
    vec2 r = vec2(
      snoise(uv * uNoiseScale + uWarp * 0.65 * q + vec2(1.7, 9.2) + t2),
      snoise(uv * uNoiseScale + uWarp * 0.65 * q + vec2(8.3, 2.8) + t2 * 0.9)
    );
    float f = snoise(uv * uNoiseScale + uWarp * 0.65 * r + time * 0.015);
    float pattern = clamp(f * 0.5 + 0.48, 0.0, 1.0);

    /**
     * 디더(스티플) — 레퍼런스 노이즈의 정체.
     *
     * 알갱이를 **결과 밝기에 곱하면** 화면 전체에 필름 그레인이 낀 것처럼 되고,
     * 레퍼런스처럼 "색이 점으로 흩어지며 넘어가는" 느낌은 안 난다.
     * 레퍼런스는 색 그라디언트 **값 자체에** 노이즈를 더한 뒤 문턱을 통과시킨
     * 디더다 — 파랑에서 흰색으로 넘어가는 경계가 점 구름으로 부서진다.
     *
     * 거친 알갱이(g2)와 고운 알갱이(g1)를 섞어야 한 가지 크기로 규칙적이지 않다.
     */
    float g1 = hash21(vUv * vec2(900.0, 320.0)) - 0.5;
    float g2 = hash21(vUv * vec2(430.0, 150.0) + 7.7) - 0.5;
    float grain = g1 * 0.65 + g2 * 0.35;
    float dith = clamp(pattern + grain * 0.34, 0.0, 1.0);

    /**
     * ⚠️ 이 주파수(18.0 / 3.4)와 아래 문턱은 **건드리지 말 것.**
     *
     * 가로를 44 로 올렸더니 simplex 노이즈 덩어리가 잘게 쪼개지면서 띠 위에
     * **비늘/꽃잎 같은 반복 무늬**가 생겼다. 색을 가늘게 하려다 무늬를 만든 셈이다.
     * 색 세기를 조절할 땐 주파수·문턱이 아니라 **아래 mix 비율만** 만진다.
     */
    float fiber = snoise(vec2(vUv.x * 18.0, vUv.y * 3.4) + t1 * 0.5);
    float pinkMask = smoothstep(0.35, 0.72, fiber);
    float blueMask = smoothstep(0.15, 0.55, 1.0 - fiber);

    /**
     * 실측 프로파일에 맞춘 배합.
     *   밝기 0.95~0.97 · 채도 중앙 0.07~0.20
     *   채도 있는 픽셀의 82~97% 가 파랑, 분홍은 8~13% 뿐
     *
     * 그래서 **은백이 바탕**이고 아이스블루는 그 위에 최대 절반까지만 섞인다.
     * (예전엔 은백↔아이스블루를 대등하게 오가서 하늘색 판처럼 보였다.)
     * 파랑 accent 는 주역이라 유지하고, 분홍은 실측 비중대로 확 줄인다.
     */
    vec3 color = mix(uColor1, uColor0, smoothstep(0.20, 0.85, dith) * 0.5);
    color = mix(color, uColor3, blueMask * 0.38);
    color = mix(color, uColor2, pinkMask * 0.30);

    /* 황금 — 시안 실측 색상 분포에서 20~60도 대역이 1~5% 있다. 결이 아니라
       **접힘이 깊은 자리(pattern 상단)** 에 얹어야 금속기가 아니라 광택으로 읽힌다. */
    float goldMask = smoothstep(0.70, 0.95, dith);
    color = mix(color, uColor4, goldMask * 0.30);

    /* 가장자리도 같은 알갱이로 부순다 — 매끈하게 페이드하면 그 부분만 CG 처럼 뜬다 */
    float edgeDist = min(vUv.y, 1.0 - vUv.y);
    float veil = smoothstep(0.0, 0.12, edgeDist + grain * 0.045);

    /**
     * 알파 상한을 0.72 → 1.0 으로 연다.
     *
     * 가산 합성일 땐 0.72 로도 밝기가 더해져서 보였다. 일반 합성으로 바꾸면
     * sky*(1-a) + color*a 라 a 가 낮으면 하늘색이 거의 그대로 남는다 —
     * 실제로 최대 a 가 0.3(체감 0.15) 이라 띠가 흰 안개로만 보였다.
     * 시안의 띠는 심(core)에서 하늘을 확실히 덮는다.
     */
    /* 밀도도 디더 값을 쓴다 — 색과 알파가 같은 알갱이를 공유해야 한 덩어리로 읽힌다 */
    float density = mix(0.20, 1.0, dith) * veil;
    float alpha = clamp(density, 0.0, 1.0) * uOpacity;

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export interface RibbonSceneProps {
  progressRef: RefObject<number>;
  active?: boolean;
}

export function RibbonScene({ progressRef, active = true }: RibbonSceneProps) {
  return (
    <CanvasShell
      active={active}
      activeFrameloop="always"
      dpr={DPR_RANGE_HEAVY}
      orthographic
      camera={{ manual: true }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "transparent" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0x000000, 0);
        scene.background = null;
      }}
    >
      <RibbonCamera />
      <Ribbons progressRef={progressRef} />
    </CanvasShell>
  );
}

function RibbonCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.near = 0.1;
    camera.far = 100;
    camera.position.set(0, 0.15, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

function Ribbons({ progressRef }: { progressRef: RefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(size.height, 1);

  const items = useMemo(
    () =>
      RIBBONS.map((spec, i) => ({
        spec,
        key: `ribbon-${i}`,
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: spec.phase },
          uWarp: { value: 0.8 },
          uSpeed: { value: 0.2 },
          /* 낮출수록 색 구역이 **크고 차분해진다**. 레퍼런스는 금·파랑이 각각
             큰 덩어리로 자리 잡고 그 경계만 알갱이로 부서진다 — 0.35 는 무늬가
             잘아서 얼룩덜룩했다. (셀 무늬가 나던 fiber 주파수와는 다른 값이다.) */
          uNoiseScale: { value: 0.2 },
          uAspect: { value: 1.8 },
          uOpacity: { value: spec.opacity },
          uColor0: { value: PALETTE[0] },
          uColor1: { value: PALETTE[1] },
          uColor2: { value: PALETTE[2] },
          uColor3: { value: PALETTE[3] },
          uColor4: { value: PALETTE[4] },
        },
      })),
    [],
  );

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const u = progressRef.current ?? 0;
    const group = groupRef.current;
    if (group) {
      group.position.y = 0.04 * u;
      group.rotation.z = -0.04 * u;
    }

    for (let i = 0; i < items.length; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uTime!.value = t;
      mat.uniforms.uAspect!.value = aspect;
    }
  });

  return (
    <group ref={groupRef}>
      {items.map((it, i) => (
        <mesh
          key={it.key}
          ref={(m) => {
            meshRefs.current[i] = m;
          }}
          position={[0, it.spec.y, 0]}
          rotation={[0, 0, it.spec.rotate]}
          scale={it.spec.scale}
          renderOrder={i}
          frustumCulled={false}
        >
          <planeGeometry args={[it.spec.length, it.spec.width, SEG_X, SEG_Y]} />
          <shaderMaterial
            vertexShader={VERT}
            fragmentShader={FRAG}
            uniforms={it.uniforms}
            transparent
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
            /**
             * 가산(Additive)이 아니라 **일반 합성**이다.
             *
             * 가산은 배경에 빛을 더하기만 한다. 시안 하늘이 이미 밝은 파스텔이라
             * 더하는 순간 흰색으로 날아가고, 팔레트의 분홍·아이스블루가 사라진다.
             * 시안의 띠는 발광체가 아니라 **반투명 실크**라 밑색이 비쳐야 한다.
             *
             * 프래그먼트가 이미 `color * alpha` 로 내보내므로 premultiplied 다.
             */
            blending={THREE.NormalBlending}
            premultipliedAlpha
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
