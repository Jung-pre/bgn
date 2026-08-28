"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CanvasShell, DPR_RANGE_HEAVY } from "@/r3f/canvas-shell";
import { RIBBON_TUNE } from "./ribbon-tune";

const ACROSS_SEGMENTS = 8;
const MIN_ALONG_SEGMENTS = 100;
const MAX_ALONG_SEGMENTS = 500;

type Wave = { a: number; f: number; w: number; p: number; k?: number };

const RIBBON_LAYOUTS = [
  {
    id: "upper",
    x: 0.12,
    y: 0.36,
    z: -0.04,
    rotation: -0.3194,
    scale: 0.92,
    /* 실제 두께 = scale * thick. 아래 리본(≈1.10~1.12)보다 두껍게 1.40 */
    thick: 1.522,
    phase: 8.4,
    timeScale: 0.91,
    seed: 17.3,
    nScale: 0.52,
    nSpeed: 0.11,
    nAmp: 0.038,
    gustSpeed: 0.073,
    spine: [
      { a: 0.075, f: 0.83, w: 0.097, p: 0.41 },
      { a: 0.044, f: 1.61, w: 0.071, p: -0.62 },
      { a: 0.028, f: 2.93, w: 0.053, p: 1.07 },
      { a: 0.016, f: 4.21, w: 0.119, p: 2.31 },
    ],
    lift: [
      { a: 0.088, f: 1.31, w: 0.37, p: 0.22 },
      { a: 0.047, f: 2.63, w: 0.251, p: -0.51 },
      { a: 0.023, f: 3.97, w: 0.173, p: 0.88 },
    ],
    twist: [
      { a: 0.142, f: 3.41, w: 0.29, p: 1.13 },
      { a: 0.074, f: 6.17, w: 0.201, p: -0.44 },
    ],
    crinkle: [
      { a: 0.038, f: 3.31, w: 0.33, p: 0.2, k: 4.7 },
      { a: 0.021, f: 5.73, w: 0.19, p: -0.7, k: -3.1 },
    ],
    gradient: {
      angle: 135,
      colors: [
        [1, 0.9098, 0.8039],
        [0.5333, 0.749, 0.9843],
        [0.9647, 0.7451, 0.9176],
      ],
      stops: [0.2516, 0.5319, 0.8419],
      radial0: [0.8221, 0, 3.0145, 1.3746],
      radial1: [0.0946, 1, 4.6307, 0.6437],
    },
  },
  {
    id: "lower-back",
    x: 0,
    y: -0.5,
    z: 0,
    rotation: 0.36,
    scale: 1.1,
    thick: 1,
    phase: 0,
    timeScale: 1.08,
    seed: 41.9,
    nScale: 0.47,
    nSpeed: 0.09,
    nAmp: 0.042,
    gustSpeed: 0.058,
    spine: [
      { a: 0.07, f: 0.71, w: 0.083, p: -0.18 },
      { a: 0.048, f: 1.93, w: 0.064, p: 1.44 },
      { a: 0.026, f: 2.57, w: 0.041, p: 0.33 },
      { a: 0.018, f: 3.79, w: 0.101, p: -1.62 },
    ],
    lift: [
      { a: 0.081, f: 1.19, w: 0.33, p: 0.91 },
      { a: 0.052, f: 2.21, w: 0.227, p: -1.05 },
      { a: 0.021, f: 4.13, w: 0.161, p: 1.7 },
    ],
    twist: [
      { a: 0.155, f: 3.07, w: 0.247, p: 0.55 },
      { a: 0.069, f: 5.89, w: 0.183, p: 2.02 },
    ],
    crinkle: [
      { a: 0.041, f: 2.87, w: 0.29, p: -0.4, k: 5.3 },
      { a: 0.019, f: 6.11, w: 0.211, p: 1.1, k: -2.6 },
    ],
    gradient: {
      /* CSS fill — 위→흰 0.30 / 파랑 0.30 / 크림 0.30 + 흰 radial 두 장 */
      angle: 180,
      colors: [
        [1, 1, 1],
        [0.5333, 0.749, 0.9843],
        [1, 0.9098, 0.8039],
      ],
      stops: [0, 0.4952, 1],
      radial0: [0.7746, 0, 1.2224, 0.5705],
      radial1: [0.1456, 1, 2.0719, 0.6128],
    },
  },
  {
    id: "lower-front",
    x: 0.08,
    y: -0.62,
    z: 0.04,
    rotation: 0.3615,
    scale: 1.12,
    thick: 1,
    phase: 4.2,
    timeScale: 1.17,
    seed: 63.1,
    nScale: 0.61,
    nSpeed: 0.14,
    nAmp: 0.045,
    gustSpeed: 0.081,
    spine: [
      { a: 0.08, f: 1.03, w: 0.111, p: 0.77 },
      { a: 0.041, f: 1.79, w: 0.079, p: -1.21 },
      { a: 0.03, f: 3.13, w: 0.049, p: 2.05 },
      { a: 0.014, f: 4.67, w: 0.137, p: 0.14 },
    ],
    lift: [
      { a: 0.094, f: 1.53, w: 0.41, p: -0.33 },
      { a: 0.044, f: 2.81, w: 0.269, p: 1.28 },
      { a: 0.026, f: 3.59, w: 0.151, p: 0.61 },
    ],
    twist: [
      { a: 0.136, f: 3.83, w: 0.341, p: -0.88 },
      { a: 0.081, f: 6.53, w: 0.219, p: 1.56 },
    ],
    crinkle: [
      { a: 0.036, f: 3.67, w: 0.37, p: 1.4, k: 3.9 },
      { a: 0.024, f: 5.21, w: 0.177, p: -1.9, k: -4.4 },
    ],
    gradient: {
      angle: 180,
      colors: [
        [0.5333, 0.749, 0.9843],
        [1, 1, 1],
        [1, 0.9098, 0.8039],
      ],
      stops: [0, 0.5, 1],
      radial0: [0.7725, 1, 1.2129, 0.5694],
      radial1: [0.1185, 0, 2.2267, 0.6289],
    },
  },
] as const;

const RIBBON_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * handhold.io의 실제 리본 셰이더 구조를 이식한 버전.
 * 면 방향으로 색을 칠하지 않고 UV domain warp로 파랑·크림·금색을 섞는다.
 */
const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uWarpIntensity;
  uniform float uSpeed;
  uniform float uEnergy;
  uniform float uNoiseScale;
  uniform float uAspectRatio;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uGradientStops;
  uniform float uGradientAngle;
  uniform vec4 uRadial0;
  uniform vec4 uRadial1;
  /* 리본 전체 투명도 배율 — 수정요청 6차 3p. 1.0 이 예전 값이다. */
  uniform float uOpacity;

  varying vec2 vUv;

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
    vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0)) +
      i.x + vec3(0.0, i1.x, 1.0)
    );
    vec3 m = max(
      0.5 - vec3(
        dot(x0, x0),
        dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)
      ),
      0.0
    );
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

  vec3 threeStopGradient(float t) {
    if (t <= uGradientStops.y) {
      float localT = clamp(
        (t - uGradientStops.x) /
        max(uGradientStops.y - uGradientStops.x, 0.0001),
        0.0,
        1.0
      );
      return mix(uColor0, uColor1, localT);
    }
    float localT = clamp(
      (t - uGradientStops.y) /
      max(uGradientStops.z - uGradientStops.y, 0.0001),
      0.0,
      1.0
    );
    return mix(uColor1, uColor2, localT);
  }

  float radialStrength(vec2 uv, vec4 radial) {
    vec2 radius = max(radial.zw, vec2(0.0001));
    float distanceFromCenter = length((uv - radial.xy) / radius);
    return 1.0 - clamp(distanceFromCenter, 0.0, 1.0);
  }

  vec4 compositeOver(vec4 top, vec4 bottom) {
    float alpha = top.a + bottom.a * (1.0 - top.a);
    vec3 color = (
      top.rgb * top.a +
      bottom.rgb * bottom.a * (1.0 - top.a)
    ) / max(alpha, 0.0001);
    return vec4(color, alpha);
  }

  void main() {
    vec2 uv = vUv;
    if (uAspectRatio > 1.0) {
      uv.x *= uAspectRatio;
    } else {
      uv.y /= uAspectRatio;
    }

    float time = uTime * uSpeed;
    vec2 t1 = time * vec2(0.017, -0.013);
    vec2 t2 = time * vec2(-0.011, 0.019);

    vec2 q = vec2(
      snoise(uv * uNoiseScale + t1),
      snoise(uv * uNoiseScale + vec2(5.2, 1.3) + t1 * 0.8)
    );
    vec2 r = vec2(
      snoise(uv * uNoiseScale + uWarpIntensity * 0.65 * q + vec2(1.7, 9.2) + t2),
      snoise(uv * uNoiseScale + uWarpIntensity * 0.65 * q + vec2(8.3, 2.8) + t2 * 0.9)
    );
    float foldNoise = snoise(
      uv * uNoiseScale +
      uWarpIntensity * 0.65 * r +
      vec2(time * 0.015)
    );
    float foldPattern = clamp(foldNoise * 0.5 + 0.48, 0.0, 1.0);

    vec2 cssUv = vec2(vUv.x, 1.0 - vUv.y);
    cssUv += q * (0.006 * uWarpIntensity);

    float angle = radians(uGradientAngle);
    vec2 direction = vec2(sin(angle), -cos(angle));
    vec2 gradientPoint = vec2(
      (cssUv.x - 0.5) * uAspectRatio,
      cssUv.y - 0.5
    );
    float gradientExtent = 0.5 * (
      abs(direction.x) * uAspectRatio +
      abs(direction.y)
    );
    float gradientT = 0.5 + dot(gradientPoint, direction) /
      max(2.0 * gradientExtent, 0.0001);

    vec4 fill = vec4(threeStopGradient(gradientT), 0.30);
    vec4 secondRadial = vec4(
      vec3(1.0),
      0.12 * radialStrength(cssUv, uRadial1)
    );
    vec4 firstRadial = vec4(
      vec3(1.0),
      0.12 * radialStrength(cssUv, uRadial0)
    );
    fill = compositeOver(secondRadial, fill);
    fill = compositeOver(firstRadial, fill);
    vec3 color = fill.rgb;

    float foldShade = mix(
      0.84,
      1.12,
      smoothstep(0.08, 0.92, foldPattern)
    );
    color *= foldShade;

    float foldHighlight =
      smoothstep(0.20, 0.43, foldPattern) *
      smoothstep(0.86, 0.52, foldPattern);
    color = mix(color, vec3(1.0), foldHighlight * 0.28);

    float fiberNoise = snoise(
      vec2(vUv.x * 28.0, vUv.y * 5.0) +
      vec2(time * 0.025, -time * 0.012)
    );
    color *= 0.97 + fiberNoise * 0.045;

    vec3 gray = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
    color = mix(gray, color, 1.0 + uEnergy * 0.3);

    float diffMask1 = snoise(vUv * 1.5 + vec2(13.7, 3.1) + t1 * 0.6);
    float diffMask2 = snoise(vUv * 0.8 + vec2(6.2, 11.8) + t2 * 0.4);
    float diffuse =
      smoothstep(-0.1, 0.4, diffMask1) *
      smoothstep(-0.2, 0.3, diffMask2);
    color = mix(color, mix(color, vec3(1.0), 0.5), diffuse * 0.16);

    float colorMax = max(max(color.r, color.g), color.b);
    float colorMin = min(min(color.r, color.g), color.b);
    float colorSat = (colorMax - colorMin) / (colorMax + 0.001);
    float colorLight = dot(color, vec3(0.299, 0.587, 0.114));
    float lightBoost = (1.0 - colorSat) * smoothstep(0.5, 0.8, colorLight);
    float grainIntensity = 0.08 + lightBoost * 0.06;

    vec2 grainUv = gl_FragCoord.xy;
    float grain1 = snoise(grainUv * 0.25 + uTime * 0.15);
    float grain2 = snoise(grainUv * 0.45 - uTime * 0.12);
    float grainProduct = grain1 * grain2;
    float grainRaw =
      sign(grainProduct) *
      max(0.0, abs(grainProduct) - 0.02) *
      2.5;
    vec3 grainTarget = color + vec3(0.08, 0.08, 0.07);
    color = mix(
      color,
      grainTarget,
      max(0.0, grainRaw) * grainIntensity * 15.0
    );

    float edgeDistance = min(vUv.y, 1.0 - vUv.y);
    float edgeAlpha = smoothstep(0.0, 0.005, edgeDistance);
    float surfaceAlpha = min(1.0, fill.a * 2.15);
    gl_FragColor = vec4(
      clamp(color, 0.0, 1.0),
      surfaceAlpha * edgeAlpha * uOpacity
    );
  }
`;

export interface RibbonSceneProps {
  progressRef: RefObject<number>;
  active?: boolean;
}

export function RibbonScene({ active = true }: RibbonSceneProps) {
  return (
    <CanvasShell
      active={active}
      activeFrameloop="always"
      dpr={DPR_RANGE_HEAVY}
      orthographic
      camera={{ manual: true }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "transparent" }}
      onCreated={({ gl, scene, camera, size }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0x000000, 0);
        scene.background = null;
        fitRibbonCamera(camera as THREE.OrthographicCamera, size.width, size.height);
      }}
    >
      <RibbonCamera />
      <DynamicRibbon />
    </CanvasShell>
  );
}

function fitRibbonCamera(camera: THREE.OrthographicCamera, width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  camera.left = -aspect;
  camera.right = aspect;
  camera.top = 1;
  camera.bottom = -1;
  camera.near = 0.1;
  camera.far = 100;
  camera.position.set(0, 0.15, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function RibbonCamera() {
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const applied = useRef({ width: 0, height: 0 });

  useFrame(() => {
    if (applied.current.width === size.width && applied.current.height === size.height) return;
    applied.current = { width: size.width, height: size.height };
    fitRibbonCamera(get().camera as THREE.OrthographicCamera, size.width, size.height);
  });

  return null;
}

function createRibbonGeometry(segments: number) {
  const rowSize = ACROSS_SEGMENTS + 1;
  const vertexCount = (segments + 1) * rowSize;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  for (let along = 0; along <= segments; along += 1) {
    const u = along / segments;
    for (let across = 0; across <= ACROSS_SEGMENTS; across += 1) {
      const v = across / ACROSS_SEGMENTS;
      const index = along * rowSize + across;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }

    if (along >= segments) continue;
    const row = along * rowSize;
    for (let across = 0; across < ACROSS_SEGMENTS; across += 1) {
      const topLeft = row + across;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + rowSize;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, topRight, bottomLeft, topRight, bottomRight, bottomLeft);
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function fract(n: number) {
  return n - Math.floor(n);
}

/** 결정론 1D 값 노이즈. Math.random 금지 — 같은 입력은 항상 같은 접힘. */
function valueNoise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = fract(Math.sin(i * 127.1) * 43758.5453);
  const b = fract(Math.sin((i + 1) * 127.1) * 43758.5453);
  return a * (1 - u) + b * u;
}

function waveSum(waves: readonly Wave[], x: number, t: number, v = 0) {
  let s = 0;
  for (let i = 0; i < waves.length; i += 1) {
    const w = waves[i];
    if (!w) continue;
    s += w.a * Math.sin(w.f * x + (w.k ?? 0) * v + w.p + w.w * t);
  }
  return s;
}

function updateRibbonPositions(
  positions: Float32Array,
  segments: number,
  time: number,
  amplitude: number,
  depth: number,
  motion: (typeof RIBBON_LAYOUTS)[number],
) {
  const gust = 0.78 + 0.22 * valueNoise1(time * motion.gustSpeed + motion.seed);
  const amp = amplitude * gust;
  let cursor = 0;

  for (let along = 0; along <= segments; along += 1) {
    const x = (along / segments - 0.5) * 6;
    const spine =
      waveSum(motion.spine, x, time) +
      (valueNoise1(x * motion.nScale + time * motion.nSpeed + motion.seed) - 0.5) * motion.nAmp;

    for (let across = 0; across <= ACROSS_SEGMENTS; across += 1) {
      const v = across / ACROSS_SEGMENTS;
      const acrossNormal = (v - 0.5) * 2;
      const y =
        waveSum(motion.lift, x, time) +
        waveSum(motion.twist, x, time) * acrossNormal +
        waveSum(motion.crinkle, x, time, v) +
        (valueNoise1(x * 0.91 + v * 3.07 + time * 0.19 + motion.seed * 2.7) - 0.5) *
          motion.nAmp *
          0.7;

      positions[cursor] = x;
      positions[cursor + 1] = (spine + y) * amp;
      positions[cursor + 2] =
        (v - 0.5) * 1.5 * depth +
        (valueNoise1(x * 0.37 + time * 0.08 + motion.seed) - 0.5) * 0.05;
      cursor += 3;
    }
  }
}

function noiseScaleFor(width: number, height: number) {
  return 0.25 * Math.pow(Math.max(width, height) / 72, 0.42);
}

function createRibbonUniforms(layout: (typeof RIBBON_LAYOUTS)[number]) {
  const { gradient } = layout;
  return {
    uTime: { value: 0 },
    uWarpIntensity: { value: 0.8 },
    uSpeed: { value: 0.2 },
    uEnergy: { value: 0.5 },
    uNoiseScale: { value: 0.35 },
    uAspectRatio: { value: 4 },
    uColor0: { value: new THREE.Vector3(...gradient.colors[0]) },
    uColor1: { value: new THREE.Vector3(...gradient.colors[1]) },
    uColor2: { value: new THREE.Vector3(...gradient.colors[2]) },
    uGradientStops: { value: new THREE.Vector3(...gradient.stops) },
    uGradientAngle: { value: gradient.angle },
    uRadial0: { value: new THREE.Vector4(...gradient.radial0) },
    uRadial1: { value: new THREE.Vector4(...gradient.radial1) },
    uOpacity: { value: RIBBON_TUNE.opacity },
  };
}

function DynamicRibbon() {
  const size = useThree((state) => state.size);
  const segments = Math.max(
    MIN_ALONG_SEGMENTS,
    Math.min(MAX_ALONG_SEGMENTS, Math.round(size.width * 0.3)),
  );
  const geometries = useMemo(
    () => RIBBON_LAYOUTS.map(() => createRibbonGeometry(segments)),
    [segments],
  );
  const uniforms = useMemo(() => RIBBON_LAYOUTS.map(createRibbonUniforms), []);
  const materialRefs = useRef<Array<THREE.ShaderMaterial | null>>([]);
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const reducedMotion = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotion.current = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useFrame((state) => {
    const tune = RIBBON_TUNE;
    const elapsed = reducedMotion.current ? 0 : state.clock.elapsedTime;
    const aspectRatio = size.width / Math.max(size.height, 1);
    const noiseScale = noiseScaleFor(size.width, size.height) * tune.noiseScaleMul;

    RIBBON_LAYOUTS.forEach((layout, index) => {
      const geometry = geometries[index];
      if (!geometry) return;
      const position = geometry.getAttribute("position") as THREE.BufferAttribute;

      const localTime = elapsed * tune.geometrySpeed * layout.timeScale + layout.phase;
      updateRibbonPositions(
        position.array as Float32Array,
        segments,
        localTime,
        tune.amplitude,
        tune.depth,
        layout,
      );
      position.needsUpdate = true;

      const mesh = meshRefs.current[index];
      if (mesh) {
        mesh.visible = tune.showRibbon;
        mesh.position.set(tune.posX + layout.x, tune.posY + layout.y, layout.z);
        mesh.rotation.z =
          layout.rotation + (valueNoise1(elapsed * 0.07 + layout.seed) - 0.5) * 0.035;
        const s = tune.groupScale * layout.scale;
        mesh.scale.set(s, s * layout.thick, s * layout.thick);
      }

      const material = materialRefs.current[index];
      if (!material) return;
      material.uniforms.uTime!.value = localTime;
      material.uniforms.uWarpIntensity!.value = tune.warpIntensity;
      material.uniforms.uSpeed!.value = tune.gradientSpeed;
      material.uniforms.uEnergy!.value = tune.energy;
      material.uniforms.uNoiseScale!.value = noiseScale;
      material.uniforms.uAspectRatio!.value = aspectRatio;
      material.uniforms.uOpacity!.value = tune.opacity;
    });
  });

  return (
    <>
      {RIBBON_LAYOUTS.map((layout, index) => (
        <mesh
          key={layout.id}
          ref={(node) => {
            meshRefs.current[index] = node;
          }}
          geometry={geometries[index]}
          frustumCulled={false}
          renderOrder={index}
          onBeforeRender={(renderer) => {
            if (index > 0) renderer.clearDepth();
          }}
        >
          <shaderMaterial
            ref={(node) => {
              materialRefs.current[index] = node;
            }}
            vertexShader={RIBBON_VERTEX_SHADER}
            fragmentShader={RIBBON_FRAGMENT_SHADER}
            uniforms={uniforms[index]}
            transparent
            depthTest
            depthWrite
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}
