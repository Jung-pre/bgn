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

const WHITE = srgb("#ffffff");
const ROSE = srgb("#eba0b8");
const LAV = srgb("#a394d0");
const BLUE = srgb("#7eb6ef");
const GOLD = srgb("#f3d0b0");
/** 2번 시안 컷 샘플 */
const CYAN = srgb("#ccdcf0");
const DEEP = srgb("#6aa2c9");
/** 3번 시안 컷 샘플 */
const PEACH = srgb("#f0e7de");
const PINK3 = srgb("#eccfda");
const MID3 = srgb("#94a3cd");
const END3 = srgb("#8ba9d0");

const PX = 1 / 460;
const DEG = Math.PI / 180;

type RibbonConf = {
  slot: number;
  amp: number;
  twAmp: number;
  twFreq: number;
  twistDir: 1 | -1;
  phase: number;
  speed: number;
  bodyAlpha: number;
  blue: number;
  rose: number;
  gold: number;
  streak: number;
  copies: number;
  /** 0 흰·파랑 / 1 띠2 램프 / 2 띠3 워시 위치 */
  wash: 0 | 1 | 2;
};

const CONFS: readonly RibbonConf[] = [
  {
    slot: 0,
    amp: 0.2,
    twAmp: 2.6,
    twFreq: 0.95,
    twistDir: 1,
    phase: 0.0,
    speed: 0.55,
    bodyAlpha: 0.62,
    blue: 0.95,
    rose: 0,
    gold: 0,
    streak: 0.2,
    copies: 1,
    wash: 0,
  },
  {
    slot: 1,
    amp: 0.15,
    twAmp: 2.8,
    twFreq: 1.45,
    twistDir: 1,
    phase: 2.1,
    speed: 0.62,
    bodyAlpha: 0.66,
    blue: 0.88,
    rose: 1.05,
    gold: 0.55,
    streak: 0.42,
    copies: 1,
    wash: 1,
  },
  {
    slot: 2,
    amp: 0.16,
    twAmp: 2.5,
    twFreq: 1.05,
    twistDir: -1,
    phase: 4.4,
    speed: 0.5,
    bodyAlpha: 0.58,
    blue: 0.78,
    rose: 0.82,
    gold: 0.62,
    streak: 0.55,
    copies: 2,
    wash: 2,
  },
  {
    slot: 3,
    amp: 0.09,
    twAmp: 2.1,
    twFreq: 1.2,
    twistDir: 1,
    phase: 1.3,
    speed: 0.45,
    bodyAlpha: 0.42,
    blue: 0.92,
    rose: 0,
    gold: 0,
    streak: 0.22,
    copies: 1,
    wash: 0,
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
    float leaf = 0.22 + 0.78 * pow(sin(3.14159265 * clamp(u, 0.0, 1.0)), 0.6);
    float breathe = 0.82 + 0.18 * sin(2.6 * u * uLen * 0.55 + uPhase * 2.1 + uTime * 0.12);
    return leaf * breathe;
  }
`;

const MEMBRANE_VERT_BODY = /* glsl */ `
  varying vec2 vUv;
  varying float vTwist;
  varying float vRoll;

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
  uniform float uRose;
  uniform float uGold;
  uniform float uBlue;
  uniform float uIrid;
  uniform float uGrain;
  uniform float uSeed;
  uniform float uStreak;
  uniform float uWash;
  uniform vec3 uWhite;
  uniform vec3 uRoseC;
  uniform vec3 uGoldC;
  uniform vec3 uBlueC;
  uniform vec3 uLavC;
  uniform vec3 uCyanC;
  uniform vec3 uDeepC;
  uniform vec3 uPeachC;
  uniform vec3 uPink3C;
  uniform vec3 uMid3C;
  uniform vec3 uEnd3C;
  varying vec2 vUv;
  varying float vTwist;
  varying float vRoll;

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

  float alongBand(float p, float c, float w) {
    return 1.0 - smoothstep(w * 0.42, w, abs(p - c));
  }

  void main() {
    float u = vUv.x;
    float v = vUv.y * 2.0 - 1.0;
    float t = uTime * 0.28 + uPhase;

    /* 연속 실크. 가장자리만 부드럽게 사라지고, 안은 뚫지 않는다 */
    float body = 1.0 - smoothstep(0.62, 1.0, abs(v));
    float fold = pow(abs(vRoll), 1.6);
    float along = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);

    vec2 streak = vec2(u * uStreak + uSeed * 0.06, v * 0.18) + vec2(t * 0.012, 0.0);
    float lane = snoise(streak);
    float edge = 0.16 * snoise(vec2(u * (uStreak * 1.7) + uSeed * 0.1, v * 0.65));

    float blueStroke = 0.36 + 0.54 * smoothstep(-0.35, 0.5, lane + edge);
    vec3 mono = mix(uWhite, uBlueC, clamp(blueStroke * uBlue, 0.0, 0.86));

    /* 길이 방향 p. 브릿지가 되지 않게 U만 아주 약하게 흔든다 */
    float p = clamp(u + lane * 0.045, 0.0, 1.0);
    float amt = 0.42 + 0.48 * smoothstep(-0.28, 0.42, lane + edge);

    /* 2번: 시안 0.29 → 분홍 0.50 → 라벤더 0.63 → 진파랑 0.71 */
    vec3 wash2 = mix(uWhite, uCyanC, smoothstep(0.18, 0.36, p));
    wash2 = mix(wash2, uRoseC, smoothstep(0.40, 0.54, p));
    wash2 = mix(wash2, uLavC, smoothstep(0.56, 0.64, p));
    wash2 = mix(wash2, uDeepC, smoothstep(0.64, 0.74, p));
    wash2 = mix(wash2, mix(uBlueC, uWhite, 0.28), smoothstep(0.80, 0.96, p));
    vec3 chroma2 = mix(uWhite, wash2, clamp(amt * max(max(uRose, uGold), uBlue), 0.0, 0.9));

    /* 3번: 샘플 U 0.21 복숭아 / 0.29 분홍 / 0.38 청보라 / 0.63 라벤더 / 0.88 파랑.
       흰 배경 시안은 옅지만 하늘 위에서는 안 보이므로 채도만 조금 살린다. */
    vec3 wash3 = mix(uWhite, uCyanC, 0.16);
    wash3 = mix(wash3, mix(uPeachC, uGoldC, 0.35), 0.82 * alongBand(p, 0.21, 0.18));
    wash3 = mix(wash3, mix(uPink3C, uRoseC, 0.45), 0.88 * alongBand(p, 0.29, 0.16));
    wash3 = mix(wash3, uMid3C, 0.86 * alongBand(p, 0.38, 0.18));
    wash3 = mix(wash3, uLavC, 0.78 * alongBand(p, 0.63, 0.18));
    wash3 = mix(wash3, uEnd3C, 0.9 * alongBand(p, 0.88, 0.2));
    vec3 chroma3 = mix(uWhite, wash3, clamp(0.5 + 0.45 * amt, 0.0, 0.94));

    vec3 col = mono;
    col = mix(col, chroma2, step(0.5, uWash) * (1.0 - step(1.5, uWash)));
    col = mix(col, chroma3, step(1.5, uWash));
    col = mix(col, uWhite, 0.08 * fold);

    float fiber = snoise(vec2(u * 120.0, v * 18.0 + uSeed));
    vec2 gUv = gl_FragCoord.xy * 0.85;
    float g1 = snoise(gUv * 0.55 + vec2(uTime * 0.02, uSeed));
    float g2 = snoise(gUv * 1.05 + vec2(19.0, -uTime * 0.018));
    float grit = abs(g1 * g2);
    col += vec3(0.07, 0.07, 0.075) * grit * uGrain;
    col += vec3(0.02) * (0.5 + 0.5 * fiber) * uGrain;
    col = min(col, vec3(1.0));

    float alpha = body * along * uBodyAlpha * mix(0.95, 1.18, fold);
    alpha *= 0.97 + 0.03 * fiber;
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

function Ribbons() {
  const groupRef = useRef<THREE.Group>(null);

  const items = useMemo(() => {
    const membraneVert = COMMON_GLSL + MEMBRANE_VERT_BODY;

    return CONFS.flatMap((conf, ci) => {
      const sprite = TOWER_LINES[conf.slot];
      if (!sprite) return [];
      const len = sprite.w * PX;
      const halfW = (sprite.h * PX) / 2;
      const cx = sprite.x + sprite.w / 2;
      const cy = sprite.y + sprite.h / 2;
      const rotZ = -(sprite.rotate ?? 0) * DEG;
      /* 비트맵 시안의 flipY 는 PNG 결 방향용. 절차 메시는 rotZ 만으로 기울인다. */

      return Array.from({ length: conf.copies }, (_, copy) => {
        const phase = conf.phase + copy * 0.38;
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
            uRose: { value: conf.rose },
            uGold: { value: conf.gold },
            uBlue: { value: conf.blue },
            uIrid: { value: 1 },
            uGrain: { value: 1 },
            uSeed: { value: ci * 17.3 + copy * 4.1 },
            uStreak: { value: conf.streak },
            uWash: { value: conf.wash },
            uWhite: { value: WHITE },
            uRoseC: { value: ROSE },
            uGoldC: { value: GOLD },
            uBlueC: { value: BLUE },
            uLavC: { value: LAV },
            uCyanC: { value: CYAN },
            uDeepC: { value: DEEP },
            uPeachC: { value: PEACH },
            uPink3C: { value: PINK3 },
            uMid3C: { value: MID3 },
            uEnd3C: { value: END3 },
          },
        };
      });
    });
  }, []);

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
      const shown = Boolean(layer && tune[`show${item.ci}` as "show0" | "show1" | "show2" | "show3"]);
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
      const rose = layer.rose * tune.roseMul;
      const gold = layer.gold * tune.goldMul;
      const blue = layer.blue * tune.blueMul;

      if (!mMat) continue;
      mMat.uniforms.uTime!.value = tt;
      mMat.uniforms.uPhase!.value = phase;
      mMat.uniforms.uAmp!.value = amp;
      mMat.uniforms.uTwAmp!.value = twAmp;
      mMat.uniforms.uTwFreq!.value = layer.twFreq;
      mMat.uniforms.uTwistDir!.value = twistDir;
      mMat.uniforms.uBodyAlpha!.value = bodyAlpha;
      mMat.uniforms.uRose!.value = rose;
      mMat.uniforms.uGold!.value = gold;
      mMat.uniforms.uBlue!.value = blue;
      mMat.uniforms.uIrid!.value = tune.iridMul;
      mMat.uniforms.uGrain!.value = tune.grainMul;
      mMat.uniforms.uStreak!.value = layer.streak;
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
