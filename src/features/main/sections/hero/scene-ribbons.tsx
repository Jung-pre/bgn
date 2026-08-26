"use client";

import { type RefObject, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CanvasShell, DPR_RANGE_HEAVY } from "@/r3f/canvas-shell";
import { TOWER_LINES } from "./hero-assets";
import { getRibbonTune, RIBBON_LAYER_IDS } from "./ribbon-tune";

/**
 * 타워 씬 띠 — **멤브레인 + 노이즈**. 포인트 도트는 쓰지 않는다.
 *
 * handhold.io 히어로와 같은 구조다.
 *   · 지오메트리는 꼬인 실크 판 (vertex)
 *   · 색은 도메인 워프 심플렉스 노이즈로 불특정 얼룩 (fragment)
 *   · 질감은 화면 공간 그레인 × UV 결 노이즈. 점을 심지 않는다.
 *
 * 자리는 Figma 실측 `TOWER_LINES`. CSS rotate 는 three 와 부호가 반대다.
 */

const SEG_X = 160;
const SEG_Y = 28;

const srgb = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

/** Figma `물결 라인` (213:10873) 스톱. 크림 / 핑크 / 블루 */
const WHITE = srgb("#ffffff");
const WAVE_CREAM = srgb("#ffe8cd");
const WAVE_PINK = srgb("#f6beea");
const WAVE_BLUE = srgb("#88bffb");

/**
 * 위→아래 5막. 가운데 스톱 위치는 Figma linear-gradient % 그대로.
 * 0 213:10874  크림 → 핑크 47.3% → 블루
 * 1 213:10878  핑크 → 블루 49.5% → 크림
 * 2 213:10875  블루 → 핑크 71.6% → 크림
 * 3 213:10876  블루 → 크림 31.7% → 핑크
 * 4 213:10877  크림 → 블루 71.4% → 핑크
 */
const WAVE_STOPS = [
  { a: WAVE_CREAM, b: WAVE_PINK, c: WAVE_BLUE, mid: 0.473 },
  { a: WAVE_PINK, b: WAVE_BLUE, c: WAVE_CREAM, mid: 0.495 },
  { a: WAVE_BLUE, b: WAVE_PINK, c: WAVE_CREAM, mid: 0.716 },
  { a: WAVE_BLUE, b: WAVE_CREAM, c: WAVE_PINK, mid: 0.317 },
  { a: WAVE_CREAM, b: WAVE_BLUE, c: WAVE_PINK, mid: 0.714 },
] as const;

/** 시안 fill 1~4. linear 각도·스톱 + radial 두 장. CONFS 인덱스와 같다. */
const FIGMA_FILLS = [
  {
    a: WAVE_CREAM,
    b: WAVE_BLUE,
    c: WAVE_PINK,
    t: [0.2516, 0.5319, 0.8419] as const,
    angle: 135,
    radA: { cx: 0.8221, cy: 0.0, rx: 3.0145, ry: 1.3746 },
    radB: { cx: 0.0946, cy: 1.0, rx: 4.6307, ry: 0.6437 },
  },
  {
    a: WAVE_BLUE,
    b: WAVE_CREAM,
    c: WAVE_PINK,
    t: [0.2059, 0.5004, 0.7948] as const,
    angle: 145,
    radA: { cx: 0.9616, cy: 0.0, rx: 1.4789, ry: 1.4016 },
    radB: { cx: 0.0946, cy: 1.0, rx: 2.3457, ry: 0.6437 },
  },
  {
    a: WAVE_BLUE,
    b: WAVE_PINK,
    c: WAVE_CREAM,
    t: [0.0, 0.5, 1.0] as const,
    angle: 180,
    radA: { cx: 0.7725, cy: 1.0, rx: 1.2129, ry: 0.5694 },
    radB: { cx: 0.1185, cy: 0.0, rx: 2.2267, ry: 0.6289 },
  },
  {
    a: WAVE_PINK,
    b: WAVE_BLUE,
    c: WAVE_CREAM,
    t: [0.0, 0.4952, 1.0] as const,
    angle: 180,
    radA: { cx: 0.7746, cy: 0.0, rx: 1.2224, ry: 0.5705 },
    radB: { cx: 0.1456, cy: 1.0, rx: 2.0719, ry: 0.6128 },
  },
] as const;

const PX = 1 / 460;
const DEG = Math.PI / 180;
/** 시안 박스가 뷰포트 왼쪽보다 안쪽에서 끝나 기울이면 더 짧아진다.
 *  양쪽을 프레임 밖으로 밀어 세로 이음매가 안 생기게 한다. */
const EDGE_BLEED = 900;

type RibbonConf = {
  slot: number;
  amp: number;
  twAmp: number;
  twFreq: number;
  twistDir: 1 | -1;
  phase: number;
  speed: number;
  bodyAlpha: number;
  streak: number;
  copies: number;
  /** WAVE_STOPS 시작 인덱스. copies>1 이면 복사본마다 +1 */
  wave: number;
};

const CONFS: readonly RibbonConf[] = [
  {
    slot: 0,
    amp: 0.2,
    twAmp: 1,
    twFreq: 1.5,
    twistDir: 1,
    phase: 0.0,
    speed: 0.55,
    bodyAlpha: 0.88,
    streak: 0.2,
    copies: 1,
    wave: 0,
  },
  {
    slot: 1,
    amp: 0.15,
    twAmp: 1.3,
    twFreq: 1.75,
    twistDir: 1,
    phase: 2.1,
    speed: 0.62,
    bodyAlpha: 0.92,
    streak: 0.42,
    copies: 1,
    wave: 1,
  },
  {
    slot: 2,
    amp: 0.16,
    twAmp: 2.5,
    twFreq: 0.75,
    twistDir: -1,
    phase: 4.4,
    speed: 0.5,
    bodyAlpha: 0.8,
    streak: 0.55,
    copies: 2,
    wave: 2,
  },
  {
    slot: 3,
    amp: 0.09,
    twAmp: 1.6,
    twFreq: 1.2,
    twistDir: 1,
    phase: 1.3,
    speed: 0.45,
    bodyAlpha: 1,
    streak: 0.22,
    copies: 1,
    wave: 4,
  },
];

const COMMON_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uAmp;
  uniform float uTwAmp;
  uniform float uTwFreq;
  uniform float uTwistDir;
  uniform float uLen;
  uniform float uHalfW;

  float spineY(float a, float t) {
    return uAmp * (
      0.50 * sin(0.9 * a + 0.4 + 0.10 * t) +
      0.30 * sin(1.7 * a - 0.6 + 0.07 * t) +
      0.20 * sin(2.8 * a + 1.0 + 0.05 * t)
    ) + 0.045 * sin(1.4 * a + 0.2 + 0.40 * t);
  }

  float twistAt(float a, float t) {
    return uTwistDir * (
      uTwAmp * sin(uTwFreq * a + 0.9 + 0.09 * t) +
      0.28 * sin(1.05 * a - 0.5 + 0.06 * t)
    );
  }

  float taperAt(float u) {
    /* 끝으로 갈수록 가늘어지면 화면 왼쪽에서 띠가 끊긴다.
       시안 리본은 프레임 밖으로 이어지므로 두께는 거의 유지한다. */
    float leaf = 0.9 + 0.1 * pow(sin(3.14159265 * clamp(u, 0.0, 1.0)), 0.8);
    float breathe = 0.94 + 0.06 * sin(2.6 * u * uLen * 0.55 + uPhase * 2.1 + uTime * 0.12);
    return leaf * breathe;
  }
`;

const MEMBRANE_VERT_BODY = /* glsl */ `
  varying vec2 vUv;
  varying float vTwist;
  varying float vRoll;
  varying float vAcross;

  void main() {
    vUv = uv;
    float t = uTime + uPhase;
    float a = position.x;
    float yy = position.y * taperAt(uv.x);
    float tw = twistAt(a, t) + 0.22 * yy;
    vTwist = cos(tw);
    vRoll = sin(tw);
    vec3 p = vec3(a, spineY(a, t) + yy * cos(tw), yy * sin(tw) * 0.9);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    /* 그라디언트는 메시 UV가 아니라 **화면 가로**. 띠가 길어서 UV 한 구간만
       보이면 단색으로 읽힌다. Figma 물결 라인 바가 박스 전체를 가로지르는 것과 같다. */
    vAcross = gl_Position.w > 0.0 ? gl_Position.x / gl_Position.w * 0.5 + 0.5 : 0.5;
  }
`;

/**
 * handhold.io 히어로와 같은 프래그먼트 언어.
 * Ashima simplex 2D + 도메인 워프로 색 얼룩, gl_FragCoord 그레인으로 모래 질감.
 */
const MEMBRANE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uBodyAlpha;
  uniform float uGrain;
  uniform float uSeed;
  uniform float uStreak;
  uniform float uRose;
  uniform float uGold;
  uniform float uBlue;
  uniform float uRoseMul;
  uniform float uGoldMul;
  uniform float uBlueMul;
  uniform float uIrid;
  uniform vec3 uWhite;
  uniform vec3 uStopA;
  uniform vec3 uStopB;
  uniform vec3 uStopC;
  uniform vec3 uRoseC;
  uniform vec3 uGoldC;
  uniform vec3 uBlueC;
  uniform float uMid;
  uniform float uSpecialFill;
  uniform float uGradAngle;
  uniform vec3 uStopT;
  uniform vec2 uRadACenter;
  uniform vec2 uRadARadii;
  uniform vec2 uRadBCenter;
  uniform vec2 uRadBRadii;
  varying vec2 vUv;
  varying float vTwist;
  varying float vRoll;
  varying float vAcross;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
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
    float u = vUv.x;
    float v = vUv.y * 2.0 - 1.0;

    /**
     * 3차 수정요청 — 레퍼런스(handhold.io) 실측 재현.
     *
     * 레퍼런스 캡처에서 확인한 구조:
     *  ① 색은 화면 위치가 아니라 **면의 방향**이 정한다. 정면으로 누운 면이
     *     바탕색, 꼬여서 옆으로 서는 골에 **채도 높은 파랑 쐐기**가 몰리고,
     *     마루 능선은 흰 하이라이트로 선다.
     *  ② 표면 전체가 균일한 모래 그레인이다 — 색을 더하는 게 아니라
     *     **알파를 흔든다**(리소그래프처럼 입자가 씹힌다).
     *  ③ 실루엣이 매끈한 선이 아니라 가장자리에서 그레인 입자로 **녹아
     *     흩어진다**. 중심부는 거의 불투명하다.
     * 색만 디자인 스톱(uStopA/B/C — 크림·핑크·블루)을 쓴다.
     */
    float core = 1.0 - smoothstep(0.42, 0.96, abs(v));
    float along = smoothstep(0.0, 0.01, u) * smoothstep(1.0, 0.99, u);

    /* ① 방향 기반 색 */
    float fold = pow(abs(vRoll), 1.35);
    float crest = pow(clamp(vTwist, 0.0, 1.0), 2.2);

    /* GLSL ES 1.00: 선언은 블록 맨 앞. 중간에 float 를 끼우면 컴파일이
       실패하고, Three 가 이전 셰이더(흰 그레인)를 그대로 쓴다. */
    float screenP = clamp(vAcross, 0.0, 1.0);
    float mid = clamp(uMid, 0.08, 0.92);
    vec3 wash = mix(uStopA, uStopB, smoothstep(0.0, mid, screenP));
    wash = mix(wash, uStopC, smoothstep(mid, 1.0, screenP));

    vec2 gUv = gl_FragCoord.xy;
    float g1 = snoise(gUv * 0.71 + vec2(uSeed * 37.0, uSeed));
    float g2 = snoise(gUv * 1.63 + vec2(19.0, uSeed * 11.0));
    float sand = 0.5 + 0.25 * g1 + 0.25 * g2;
    vec3 col;
    float alpha;
    vec3 lin;
    vec2 box;
    float radA;
    float radB;
    float silk;
    float grain;
    float dens;
    float rosePush;
    float goldPush;
    float bluePush;
    float iridPush;
    vec3 irid;
    vec3 deep;
    float flow;
    float k;
    vec3 cA;
    vec3 cB;
    vec3 cC;
    float g3;
    float speckle;
    vec2 st;
    vec2 gdir;
    float gt;

    /* 시안 fill. 색은 스톱, 지직은 원래처럼 알파만 뚫는다. */
    if (uSpecialFill > 0.5) {
      st = vec2(vUv.x, 1.0 - vUv.y);
      gdir = vec2(sin(uGradAngle), -cos(uGradAngle));
      gt = clamp(dot(st - vec2(0.5), gdir) + 0.5, 0.0, 1.0);
      lin = mix(uStopA, uStopB, smoothstep(uStopT.x, uStopT.y, gt));
      lin = mix(lin, uStopC, smoothstep(uStopT.y, uStopT.z, gt));
      radA = 1.0 - smoothstep(0.0, 1.0, length((st - uRadACenter) / uRadARadii));
      radB = 1.0 - smoothstep(0.0, 1.0, length((st - uRadBCenter) / uRadBRadii));
      lin = mix(lin, uWhite, 0.12 * radA + 0.12 * radB);
      dens = smoothstep(0.16, 0.52, core + (sand - 0.5) * 0.6);
      dens *= 0.84 + 0.3 * sand;
      g3 = snoise(gUv * 5.1 + vec2(uSeed * 13.0, 8.0));
      speckle = 0.5 + 0.5 * g3;
      dens *= mix(1.0, smoothstep(0.20, 0.58, speckle), clamp(uGrain * 0.38, 0.0, 0.9));
      col = lin;
      alpha = dens * along * uBodyAlpha;
    } else {
      dens = smoothstep(0.16, 0.52, core + (sand - 0.5) * 0.6);
      dens *= 0.84 + 0.3 * sand;

      /* 바탕 — 레퍼런스의 면은 옅지만 씻겨 있지 않다. 흰 섞음을 절반으로. */
      col = mix(wash, uWhite, 0.18);

      /* 패널 색. 1 = 지금 화면, 올리면 그 색으로, 0이면 그 색을 뺀다.
         레이어 값은 띠마다 가산. 흰·파랑 띠(rose=0)도 전체 배율은 먹는다. */
      rosePush = (uRoseMul - 1.0) * 0.48 + uRose * uRoseMul * 0.22;
      goldPush = (uGoldMul - 1.0) * 0.48 + uGold * uGoldMul * 0.22;
      bluePush = (uBlueMul - 1.0) * 0.48 + uBlue * uBlueMul * 0.22;
      col = mix(col, uRoseC, clamp(rosePush, 0.0, 0.92));
      col = mix(col, uGoldC, clamp(goldPush, 0.0, 0.92));
      col = mix(col, uBlueC, clamp(bluePush, 0.0, 0.92));
      col = mix(col, mix(col, uWhite, 0.7), clamp(-rosePush, 0.0, 0.7) * 0.45);
      col = mix(col, mix(col, uWhite, 0.7), clamp(-goldPush, 0.0, 0.7) * 0.35);
      col = mix(col, mix(col, uWhite, 0.7), clamp(-bluePush, 0.0, 0.7) * 0.4);

      iridPush = (uIrid - 1.0) * 0.4;
      irid = vec3(
        0.55 + 0.45 * sin(vAcross * 6.2832 + uTime * 0.18),
        0.55 + 0.45 * sin(vAcross * 6.2832 + 2.094 + uTime * 0.14),
        0.55 + 0.45 * sin(vAcross * 6.2832 + 4.189 + uTime * 0.16)
      );
      col = mix(col, irid, clamp(iridPush, 0.0, 0.7) * (0.28 + fold * 0.55));

      /* 골 쐐기 — 같은 스톱을 제곱해 채도를 몰아넣는다(색상은 디자인 그대로,
         레퍼런스의 파랑 쐐기 역할). 골일수록 깊은 색이 이긴다. */
      deep = wash * wash * vec3(1.15, 1.05, 1.35);
      deep = mix(deep, uBlueC, clamp(bluePush * 0.55, 0.0, 0.75));
      deep = mix(deep, uRoseC, clamp(rosePush * 0.35, 0.0, 0.55));
      col = mix(col, deep, fold * 0.85);
      /* 마루 하이라이트 — 능선에서 흰빛이 선다 */
      col = mix(col, uWhite, crest * 0.55);

      alpha = dens * along * uBodyAlpha * (1.0 + fold * 0.22);
    }

    alpha = clamp(alpha, 0.0, 1.0);
    gl_FragColor = vec4(col * alpha, alpha);
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
      <Ribbons />
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
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function RibbonCamera() {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const applied = useRef({ w: 0, h: 0 });

  useFrame(() => {
    if (applied.current.w === size.width && applied.current.h === size.height) return;
    applied.current = { w: size.width, h: size.height };
    fitRibbonCamera(get().camera as THREE.OrthographicCamera, size.width, size.height);
  });

  return null;
}

/**
 * 세로 화면에서 띠 **폭**에만 곱하는 값.
 *
 * 띠 폭은 1920 시안 좌표(`TOWER_LINES[].h`)에서 온다. 세로 화면은 가로가
 * 1/5 로 줄어드는데 띠는 그대로라 화면을 통째로 덮고, 그 아래 뒤판
 * (`img_01_bg02_mo.webp` — 타워·BGN·띠가 이미 구워져 있다)과 그 위 카피를
 * 같이 지운다. 시안 68:3415 대비 실측으로 하늘 y140 이 +31, 카피 바로 위가
 * +44 만큼 하얗게 떠 있었다.
 *
 * **셰이더·색·꼬임·그레인은 손대지 않는다.** 지오메트리 폭만 줄인다.
 */
const MOBILE_THIN = 0.62;
const RIBBON_FILL_REV = 11;

function Ribbons() {
  const groupRef = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  /* 두 값(0.62 / 1)만 오가므로 리사이즈마다 items 가 다시 만들어지지 않는다 */
  const thin = size.width <= 768 ? MOBILE_THIN : 1;

  const items = useMemo(() => {
    const membraneVert = COMMON_GLSL + MEMBRANE_VERT_BODY;

    return CONFS.flatMap((conf, ci) => {
      const sprite = TOWER_LINES[conf.slot];
      if (!sprite) return [];
      const len = (sprite.w + EDGE_BLEED * 2) * PX;
      const halfW = ((sprite.h * PX) / 2) * thin;
      const cx = sprite.x + sprite.w / 2;
      const cy = sprite.y + sprite.h / 2;
      const rotZ = -(sprite.rotate ?? 0) * DEG;
      /* 비트맵 시안의 flipY 는 PNG 결 방향용. 절차 메시는 rotZ 만으로 기울인다. */

      return Array.from({ length: conf.copies }, (_, copy) => {
        const phase = conf.phase + copy * 0.38;
        const wave = WAVE_STOPS[(conf.wave + copy) % WAVE_STOPS.length] ?? WAVE_STOPS[0];
        const fill = FIGMA_FILLS[ci] ?? FIGMA_FILLS[0];
        return {
          key: `rb-${ci}-${copy}`,
          ci,
          copyIndex: copy,
          conf,
          len,
          halfW,
          pos: [(cx - 960) * PX, (460 - cy) * PX, 0] as const,
          rotZ,
          flip: 1,
          membraneVert,
          membraneUniforms: {
            uTime: { value: 0 },
            uPhase: { value: phase },
            uAmp: { value: conf.amp },
            uTwAmp: { value: conf.twAmp },
            uTwFreq: { value: conf.twFreq },
            uTwistDir: { value: conf.twistDir },
            uLen: { value: len },
            uHalfW: { value: halfW },
            uBodyAlpha: { value: conf.bodyAlpha * (copy === 1 ? 0.7 : 1) },
            uGrain: { value: 1 },
            uSeed: { value: ci * 17.3 + copy * 4.1 },
            uStreak: { value: conf.streak },
            uRose: { value: 0 },
            uGold: { value: 0 },
            uBlue: { value: 0 },
            uRoseMul: { value: 1 },
            uGoldMul: { value: 1 },
            uBlueMul: { value: 1 },
            uIrid: { value: 1 },
            uWhite: { value: WHITE },
            uStopA: { value: fill.a.clone() },
            uStopB: { value: fill.b.clone() },
            uStopC: { value: fill.c.clone() },
            uRoseC: { value: WAVE_PINK.clone() },
            uGoldC: { value: WAVE_CREAM.clone() },
            uBlueC: { value: WAVE_BLUE.clone() },
            uMid: { value: wave.mid },
            uSpecialFill: { value: 1 },
            uGradAngle: { value: (fill.angle * Math.PI) / 180 },
            uStopT: { value: new THREE.Vector3(fill.t[0], fill.t[1], fill.t[2]) },
            uRadACenter: { value: new THREE.Vector2(fill.radA.cx, fill.radA.cy) },
            uRadARadii: { value: new THREE.Vector2(fill.radA.rx, fill.radA.ry) },
            uRadBCenter: { value: new THREE.Vector2(fill.radB.cx, fill.radB.cy) },
            uRadBRadii: { value: new THREE.Vector2(fill.radB.rx, fill.radB.ry) },
          },
        };
      });
    });
  }, [thin]);

  const matRefs = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const itemGroupRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    const tune = getRibbonTune();
    const t = state.clock.elapsedTime * tune.timeScale;
    const group = groupRef.current;
    if (group) {
      /* 등장 스케일은 타워 래퍼가 맡는다. 여기까지 줄이면 전환이 끝난 뒤
         한 번 더 줄어 띠가 틱한다. */
      group.position.set(tune.posX, tune.posY, 0);
      group.rotation.z = 0;
      group.scale.setScalar(tune.groupScale);
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      const layerId = RIBBON_LAYER_IDS[item.ci];
      const layer = layerId ? tune[layerId] : undefined;
      const shown = Boolean(
        layer && tune[`show${item.ci}` as "show0" | "show1" | "show2" | "show3"],
      );
      const wrap = itemGroupRefs.current[i];
      if (wrap) wrap.visible = shown && tune.showMembrane;
      if (!layer || !shown) continue;

      const mMat = matRefs.current[i];
      const amp = layer.amp * tune.ampMul;
      const twAmp = layer.twAmp * tune.twistMul;
      const twistDir = layer.twistDir;
      const phase = layer.phase + item.copyIndex * 0.38;
      const tt = t * layer.speed * tune.speedMul;
      const bodyAlpha = layer.bodyAlpha * tune.bodyAlphaMul * (item.copyIndex === 1 ? 0.7 : 1);

      if (!mMat) continue;
      mMat.uniforms.uTime!.value = tt;
      mMat.uniforms.uPhase!.value = phase;
      mMat.uniforms.uAmp!.value = amp;
      mMat.uniforms.uTwAmp!.value = twAmp;
      mMat.uniforms.uTwFreq!.value = layer.twFreq;
      mMat.uniforms.uTwistDir!.value = twistDir;
      mMat.uniforms.uBodyAlpha!.value = bodyAlpha;
      mMat.uniforms.uGrain!.value = tune.grainMul;
      mMat.uniforms.uStreak!.value = layer.streak;
      mMat.uniforms.uRose!.value = layer.rose;
      mMat.uniforms.uGold!.value = layer.gold;
      mMat.uniforms.uBlue!.value = layer.blue;
      mMat.uniforms.uRoseMul!.value = tune.roseMul;
      mMat.uniforms.uGoldMul!.value = tune.goldMul;
      mMat.uniforms.uBlueMul!.value = tune.blueMul;
      mMat.uniforms.uIrid!.value = tune.iridMul;
      if (mMat.uniforms.uSpecialFill) {
        mMat.uniforms.uSpecialFill.value = 1;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {items.map((it, i) => (
        <group
          key={it.key}
          ref={(g) => {
            itemGroupRefs.current[i] = g;
          }}
          position={[it.pos[0], it.pos[1], it.pos[2]]}
          rotation={[0, 0, it.rotZ]}
          scale={[1, it.flip, 1]}
        >
          <mesh renderOrder={i} frustumCulled={false}>
            <planeGeometry args={[it.len, it.halfW * 2, SEG_X, SEG_Y]} />
            <shaderMaterial
              key={`mem-${RIBBON_FILL_REV}`}
              ref={(m) => {
                matRefs.current[i] = m;
              }}
              vertexShader={it.membraneVert}
              fragmentShader={MEMBRANE_FRAG}
              uniforms={it.membraneUniforms}
              transparent
              depthTest={false}
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.NormalBlending}
              premultipliedAlpha
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
