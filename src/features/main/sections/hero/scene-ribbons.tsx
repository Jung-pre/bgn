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
const SEG_Y = 28;

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
  /**
   * ⚠️ 아래 셋은 **결(필라멘트) 전용**이라 위의 두 색보다 진하다.
   *
   * 평균값(v 0.95 / s 0.07)은 띠 **전체**를 평균 낸 값이다. 그 색으로 결을 그리면
   * 은백 바탕과 구분이 안 돼서 선이 사라진다 — 실제로 처음에 그렇게 만들었다가
   * 색이 하나도 안 보였다. 시안 아트의 채도 분포는 p99 0.465, 최대 0.788 이고
   * 그 상위 대역이 곧 결이다. 그래서 결 색은 그 대역에서 뽑는다.
   */
  srgb("#f2a3b8"), // 장미 — s 0.33
  srgb("#7ba7de"), // 깊은 남색 — s 0.45
  srgb("#efc98c"), // 황금 — s 0.41
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
  /**
   * ⚠️ width 는 판을 세운 뒤로 **화면 세로 점유율**이 됐다(카메라 세로 2단위).
   * 2.0 은 화면 전체다 — 실제로 그렇게 뒀더니 커버리지 92% 로 하늘이 사라졌다.
   * 시안 실측 커버리지는 **23%** 라, 띠가 지나가고 나머지는 하늘이어야 한다.
   */
  { length: 6.4, width: 1.72, rotate: -0.22, y: 0.06, opacity: 0.94, phase: 0, scale: 1 },
  { length: 5.6, width: 1.24, rotate: 0.13, y: -0.32, opacity: 0.66, phase: 2.1, scale: 0.9 },
];

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uTwistDir;
  varying vec2 vUv;
  varying float vTwist;

  /**
   * ## 판을 **정면으로 세운다** — 여기가 "띠가 실처럼 얇던" 진짜 원인이었다
   *
   * 이전 정점 셰이더는 이랬다:
   *     vec3 p = vec3(a, s + o, (r - 0.5) * 1.5);
   * uv.y(=r)를 **z(깊이)** 에 꽂았다. 즉 판이 x–z 평면에 **눕는다**. 카메라가
   * 정사영이라 눕힌 판은 화면에 **선으로 투영된다** — 화면에서 보이는 두께가
   * 판 두께가 아니라 잔물결의 r 의존 항(±0.23) 뿐이었다.
   *
   * 그래서 프래그먼트에서 아무리 실크 겹을 잘 그려도 전부 한 줄로 눌려서
   * 실오라기처럼 보였다. 판을 x–y 로 세우면 uv.y 가 화면 세로에 대응하고,
   * 프래그먼트가 그린 겹·결이 그대로 보인다.
   *
   * ## 대신 **비틀림(twist)** 으로 3D 감을 만든다
   * 그냥 세우면 직사각 판이라 리본이 아니다. 길이를 따라 축을 비틀면
   * cos(tw) 만큼 화면 높이가 줄었다 늘었다 하면서 **면이 돌아가는** 실크가 된다.
   * cos 이 0 에 가까운 자리가 리본이 옆으로 서는 지점이다.
   */
  void main() {
    vUv = uv;
    float a = position.x;
    float yy = position.y;        // 판의 세로 좌표 (±width/2)
    float t = uTime * 0.7 + uPhase;

    /* 척추 파동 — 띠가 그리는 큰 S 자 */
    float s = 0.44 * (
      0.50 * sin(0.9 * a + 0.4 + 0.10 * t) +
      0.30 * sin(1.7 * a - 0.6 + 0.07 * t) +
      0.20 * sin(2.8 * a + 1.0 + 0.05 * t)
    );

    /* 잔물결 — 판이 세워졌으므로 예전만큼 셀 필요가 없다. 크게 주면 겹이 끊긴다. */
    float o =
      0.070 * sin(1.4 * a + 0.2 + 0.40 * t) +
      0.040 * sin(2.5 * a - 0.5 + 0.28 * t) +
      0.020 * sin(3.8 * a + 0.8 + 0.18 * t);

    /**
     * ## 비틀림 — **π 를 넘겨야 진짜로 꼬인다**
     *
     * 앞 버전은 진폭이 1.05 + 0.45 = 1.5 rad 였다. cos 의 부호가 바뀌려면 |tw| 가
     * π/2(1.571) 를 넘어야 하는데 최대치가 딱 그 문턱 아래라, 판이 **얇아지기만
     * 하고 한 번도 뒤집히지 않았다.** 실타래가 아니라 그냥 리본 띠였던 이유다.
     *
     * 2.6 rad 까지 밀면 cos 이 확실히 음수 구간을 지난다 = 면이 뒤집혀 뒷면이
     * 보인다. 공간 주파수는 오히려 낮춰서(0.62 → 0.5) 길이당 꼬임이 1~2번만
     * 생기게 한다 — 자주 꼬면 실타래가 아니라 주름이 된다.
     *
     * uTwistDir 로 두 판이 **반대로** 꼬인다. 하나가 벌어질 때 다른 하나가
     * 조여지면서 두 가닥이 서로를 감는 것처럼 읽힌다.
     */
    float tw = uTwistDir * (
      1.95 * sin(0.44 * a + 0.9 + 0.09 * t) +
      0.45 * sin(1.05 * a - 0.5 + 0.06 * t)
    )
    /* 꼬임 위치를 판 폭 방향으로 살짝 기울인다. a 에만 의존시키면 꼬이는 자리가
       정확히 세로선이 돼서 접힘이 아니라 잘린 것처럼 보인다. */
    + 0.22 * yy;
    vTwist = cos(tw);

    /**
     * ⚠️ 폭에 바닥(floor)을 깔면 안 된다.
     * sign(c) * mix(0.28, 1.0, abs(c)) 로 최소 폭을 보장해 봤더니, c 가 0 을
     * 지날 때 +0.28 → −0.28 로 **불연속 점프**가 생겨 꼬이는 자리마다
     * 자로 그은 듯한 세로 이음매가 남았다. 실제 천에는 그런 선이 없다.
     *
     * 그냥 cos 를 쓴다 — 꼬이는 순간 띠가 한 줄로 조여지는 게 물리적으로 맞고,
     * 아래 grazing 항이 그 자리를 밝게 만들어 "면이 옆으로 섰다"로 읽힌다.
     * 띠 전체가 동시에 조여지던 문제는 시간 항을 0.20 → 0.09 로 늦춰 해결했다.
     */
    float wid = cos(tw);

    vec3 p = vec3(
      a,
      s + o + yy * wid,
      yy * sin(tw) * 0.9
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uPhase;
  uniform float uLineGain;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  varying vec2 vUv;
  varying float vTwist;

  /**
   * ## 왜 도메인워프 노이즈 판을 버렸나 — 실측이 반대를 가리켰다
   *
   * 이전 프래그먼트는 simplex 도메인워프로 **등방성(isotropic) 얼룩**을 만들고
   * 거기에 그레인을 곱했다. 결과를 시안 원본 아트(img_01_line02.webp)와 같은
   * 배율로 놓고 재보니 정반대였다:
   *
   *              라플라시안 평균   |d/dy| 강한경계 비율
   *   시안 아트      0.0072            7.7%
   *   이전 구현      0.0274           14.6%      ← 3.8배 거칠고 2배 잘게 부서짐
   *
   * 즉 "노이즈가 부족"한 게 아니라 **알갱이는 넘치고 선이 없었다.** 시안 띠는
   * 매끈한 실크 판 위에 **가늘고 선명한 결(필라멘트)** 몇 가닥이 흐르는 구조다.
   * 그래서 얼룩을 만들지 않고, 결을 **직접 그린다**.
   *
   * ## 구조
   *  ① 접힘(fold) — u(띠 길이) 방향으로만 느리게 변하는 값. v 를 거의 안 타서
   *    여기서 나온 선이 **길게 이어진다**. 잘게 흔들면 다시 얼룩이 된다.
   *  ② 몸통(body) — 가운데가 두껍고 가장자리로 얇아지는 반투명 판.
   *  ③ 결(filament) — 7가닥. 각자 v 위치가 u 를 따라 흐르고, 굵기·밝기가 다르다.
   *    색은 시안 실측 분포 그대로 — 채도 있는 픽셀의 93.8%가 파랑, 금 2.8%,
   *    분홍 2.5%. 그래서 파랑 계열이 5가닥, 금 1, 장미 1이고 금·장미는 더 가늘다.
   *  ④ 알갱이 — **가장자리에서만** 세게. handhold.io 처럼 경계가 점으로 흩어져
   *    풀리되, 심(core)은 매끈하게 남는다. 전면에 곱하면 ②의 실측값처럼 거칠어진다.
   */

  /** 해시 화이트노이즈 — 픽셀마다 독립이라 아무리 잘게 써도 셀 무늬가 안 생긴다 */
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

  /** 2옥타브면 충분하다 — 더 쌓으면 ①이 잘게 흔들려 선이 끊긴다 */
  float fbm(vec2 p) {
    return 0.66 * snoise(p) + 0.34 * snoise(p * 2.13 + 5.7);
  }

  /** 한 판이 그리는 실크 겹 수. 시안 띠는 2~3겹이 겹쳐 지나간다 */
  const int SHEETS = 2;

  void main() {
    float u = vUv.x;                 // 띠를 따라
    float v = vUv.y;                 // 띠를 가로질러 (0 = 위, 1 = 아래)
    float t = uTime * uSpeed;
    float seed = uPhase * 3.1;

    /* ① 접힘 — v 성분을 아주 약하게(0.35)만 준다. 0 이면 완전한 세로 줄무늬가 되고,
       크게 주면 다시 얼룩이 된다. 이 사이가 "흐르는 결"이다. */
    float fold =
      0.62 * fbm(vec2(u * 2.3 + seed, v * 0.35 + t * 0.30)) +
      0.24 * fbm(vec2(u * 5.4 - seed, v * 0.30 - t * 0.21));

    /**
     * ② 실크 겹.
     *
     * 판 하나에 넓은 띠 하나를 깔았더니 **구름**이 됐다. 반폭이 화면 높이의 30%
     * 라 경계가 수백 px 에 걸쳐 풀리니 실크가 아니라 안개다.
     * 시안 띠는 1920 폭 기준 두께가 200~300px — 화면 높이의 25% 안쪽이고,
     * 그런 얇은 겹이 **2~3장 겹쳐** 지나간다. 그래서 겹 단위로 그린다.
     *
     * 각 겹은 가장자리 한쪽에 밝은 림(rim)을 갖는다. 이게 있어야 판이 "끝나는
     * 자리"가 보이고 실크로 읽힌다 — 양쪽 다 부드럽게 죽이면 다시 안개가 된다.
     */
    float dens = 0.0;
    vec3 col = vec3(0.0);
    float wsum = 0.0;

    for (int k = 0; k < SHEETS; k++) {
      float fk = float(k);
      float r1 = fract(sin(fk * 12.9898 + seed) * 43758.5453);
      float r2 = fract(sin(fk * 78.2330 + seed) * 43758.5453);

      /* 겹의 중심선 — 서로 어긋난 위상으로 흘러서 교차한다 */
      float c = 0.5
        + (fk - 0.5) * 0.40
        + 0.14 * sin(1.55 * u + r1 * 6.2832 + t * 0.42)
        + 0.06 * sin(3.10 * u - r2 * 6.2832 - t * 0.27)
        + fold * 0.09;

      /* 반폭 — 화면 높이의 6~13%. 길이 방향으로 두꺼워졌다 얇아진다 */
      float hw = mix(0.21, 0.40, r2)
        * (0.72 + 0.42 * (0.5 + 0.5 * fbm(vec2(u * 1.9 + fk * 3.3 + seed, t * 0.2))));

      float dv = (v - c) / max(hw, 0.001);
      float m = clamp(1.0 - abs(dv), 0.0, 1.0);
      if (m <= 0.0) continue;

      /**
       * 면이 뒤집힌 구간에서는 겹 좌표의 **위아래가 실제로 반대**다.
       * 이걸 반영해야 림(밝은 가장자리)과 금색 모서리가 꼬임을 따라 넘어가면서
       * "돌아갔다"가 읽힌다. 안 하면 아무리 꼬아도 무늬는 그대로라 평평해 보인다.
       */
      float face = vTwist >= 0.0 ? 1.0 : -1.0;
      float dvo = dv * face;

      /* 겹의 밝기 — 안쪽은 고르게, 한쪽 가장자리에 림 */
      /* 안쪽은 평평하고 가장자리만 세운다 — pow(m,0.34) 는 경계가 너무 완만해서
         시안 대비 강한경계 비율이 절반밖에 안 나왔다(3.2% vs 5.1%). */
      float sheet = smoothstep(0.0, 0.44, m);
      /* 한쪽 가장자리의 밝은 림 — 판이 "끝나는 자리"를 만든다 */
      float rim = pow(clamp(1.0 - abs(dvo + 0.72) / 0.20, 0.0, 1.0), 1.3);
      /* 실루엣 하이라이트 — 시안 띠는 윤곽을 따라 가는 밝은 선이 지나간다 */
      float silh = pow(clamp(1.0 - abs(abs(dv) - 0.88) / 0.09, 0.0, 1.0), 1.2);
      sheet += rim * 0.5 + silh * 0.55;

      /* 길이 방향 존재감 — 겹이 화면 밖에서 들어와 지나간다 */
      float along = smoothstep(0.0, 0.13, u) * smoothstep(1.0, 0.87, u);
      along *= 0.42 + 0.58 * clamp(0.5 + 0.75 * fbm(vec2(u * 2.2 + fk * 5.0 + seed, t * 0.24)), 0.0, 1.0);
      sheet *= along;

      /**
       * ③ 결 — 겹 **안에서만** 그린다. 겹 밖에 그리면 판 위에 인쇄한 줄이 된다.
       * 겹마다 2가닥. 색은 시안 실측 분포대로 파랑이 주(4가닥)이고 금·장미가
       * 각 1가닥이다(채도 픽셀 기준 파랑 93.8% / 금 2.8% / 분홍 2.5%).
       */
      float lineSum = 0.0;
      vec3 lineCol = vec3(0.0);
      for (int j = 0; j < 7; j++) {
        float fj = float(j);
        float q = fract(sin((fk * 7.0 + fj) * 45.233 + seed) * 24634.6345);
        int gi = int(fk) * 7 + j;
        bool warm = (gi == 3 || gi == 9);   // 장미 · 황금
        bool navy = (gi == 0);

        /* 결의 자리 — 겹 좌표(dv) 기준이라 겹과 함께 휜다 */
        float lc = mix(-0.78, 0.72, fract(q * 3.7)) + 0.13 * sin(2.6 * u + q * 6.2832 + t * 0.5);
        /* 색 결만 굵다. 흰 결은 아주 가늘어서 실크의 결처럼 보인다. */
        /* 겹이 두꺼워지면 같은 비율의 결도 px 로는 뭉툭해진다 — 실제로 두께를
           1.5배 키웠더니 강한경계가 3.1% → 1.1% 로 주저앉았다. 비율을 줄여 보정. */
        float sig = (warm || navy) ? mix(0.042, 0.090, q) : mix(0.008, 0.022, q);
        float ld = (dvo - lc) / sig;
        float line = exp(-ld * ld);

        /* 길이 방향 존재감 */
        float along2 = 0.42 + 0.58 * clamp(0.5 + 0.85 * fbm(vec2(u * 3.4 + q * 9.0, t * 0.3)), 0.0, 1.0);
        if (warm || navy) {
          /**
           * 색 결은 **구간**이어야 한다. 끝에서 끝까지 그으면 붓으로 그은 선이 되고,
           * 실제로 그렇게 뒀더니 분홍 줄 하나가 화면을 가로질렀다.
           * 시안에서는 접힘이 깊은 자리에만 짧게 나타난다.
           */
          float ctr = fract(q * 5.31 + t * 0.02);
          float span = 0.09 + 0.10 * fract(q * 11.7);
          along2 *= smoothstep(span, span * 0.35, abs(u - ctr));
        }
        /* 색 결은 밝기도 올린다. 실측 따뜻한 픽셀 비율이 시안 0.48% 인데
           1.0 배로 두면 0.10% 밖에 안 나온다 — 눈으로도 색이 거의 안 보인다. */
        /* 2.2 로 뒀더니 따뜻한 픽셀이 2.85% — 시안(0.48%)의 6배라 분홍이 붓으로
           그은 줄처럼 보였다. 1.35 가 실측 대역이다. */
        if (warm) line *= 1.35;
        else if (navy) line *= 1.2;
        line *= along2;

        vec3 fcol = (j == 1 || j == 4 || j == 6) ? uColor0 : uColor1;   // 아이스블루 / 은백
        if (navy) fcol = uColor3;
        else if (gi == 3) fcol = uColor2;                      // 장미
        else if (gi == 9) fcol = uColor4;                      // 황금

        lineSum += line;
        lineCol += fcol * line;
      }
      lineCol = lineSum > 0.0001 ? lineCol / lineSum : uColor1;
      lineSum = clamp(lineSum * uLineGain, 0.0, 1.0);

      /* 겹의 색 — 은백 바탕에 접힘만큼 아이스블루, 그 위에 결 색 */
      vec3 base = mix(uColor1, uColor0, 0.08 + 0.18 * (0.5 + 0.5 * fold));
      vec3 sc = mix(base, lineCol, lineSum * 0.85);

      /**
       * ## 색 **구역** — 얇은 결만으로는 색이 안 보인다
       *
       * 시안 띠의 분홍·금은 실오라기가 아니라 **넓게 번지는 구역**이다. 교차부
       * 전체가 장미빛으로 물들고, 아래 모서리를 따라 금색이 길게 깔린다.
       * 결(위 lineCol)만 색을 갖게 했더니 화면에서 색이 거의 안 보였다 —
       * 알파 0.3짜리 5px 선은 하늘색에 그대로 씻겨 나간다.
       *
       * tone 은 u 를 따라 아주 느리게 변하는 값이라 색이 **덩어리로 고인다**.
       * 장미와 금은 서로 반대 부호를 써서 같은 자리에서 겹치지 않는다.
       * edgeBias 로 금은 아래 모서리, 장미는 위쪽에 붙인다(시안 배치).
       */
      float tone = fbm(vec2(u * 1.15 + seed * 0.7 + fk * 2.0, t * 0.09));
      float edgeBias = smoothstep(-0.9, 0.3, dvo);
      float goldZone = smoothstep(0.05, 0.55, tone) * edgeBias;
      float roseZone = smoothstep(0.02, 0.50, -tone) * (1.0 - edgeBias * 0.65);
      float navyZone = smoothstep(0.62, 1.00, abs(tone)) * (1.0 - edgeBias);
      sc = mix(sc, uColor4, goldZone * 0.58);
      sc = mix(sc, uColor2, roseZone * 0.62);
      sc = mix(sc, uColor3, navyZone * 0.38);

      /* 뒷면 — 빛을 등지므로 살짝 가라앉는다. 이 차이가 꼬임의 증거다. */
      if (face < 0.0) sc = mix(sc, uColor3, 0.22);

      /* 결이 밀도를 끌어올리는 비중. 0.30 이면 결이 색만 바꾸고 경계를 못 만들어
         시안 대비 강한경계가 2.2% 대 3.4% 로 모자랐다. */
      float w = sheet * (0.76 + 0.62 * lineSum);
      dens += w;
      col += sc * w;
      wsum += w;
    }

    if (wsum <= 0.0001) discard;
    col /= wsum;

    /**
     * ④ 알갱이 — 가장자리에서만 세게.
     * 심에서는 0.03, 가장자리에서는 0.20 이라 경계가 점으로 흩어지며 풀린다
     * (handhold.io 의 그 느낌). 전면에 같은 세기로 주면 시안 대비 라플라시안이
     * 3.8배로 뛴다 — 이전 구현이 정확히 그 상태였다.
     */
    float edge = smoothstep(0.0, 0.55, dens);
    float g1 = hash21(vUv * vec2(820.0, 300.0) + seed) - 0.5;
    float g2 = hash21(vUv * vec2(340.0, 128.0) + 7.7) - 0.5;
    float grain = g1 * 0.7 + g2 * 0.3;
    /* 심에도 아주 옅게 알갱이를 남긴다(0.020 → 0.052). 완전히 매끈하면 CG 판처럼
       떠 보이고, 시안 아트에도 심 안쪽에 미세한 결이 살아 있다. */
    dens += grain * mix(0.15, 0.032, edge);

    /**
     * ## 광택 — 실크 위를 **흐르는 빛 띠**
     *
     * 지금까지는 밝기가 자리마다 고정이라 천이 아니라 그림처럼 보였다. 실크는
     * 광원이 고정이어도 면이 돌아가면서 광택 띠가 표면을 훑고 지나간다.
     * u 순환 거리로 가우시안 띠를 만들어 아주 느리게(0.055) 흘려보낸다.
     *
     * 접힘이 깊은 능선에서 더 강하게 — 평평한 데서 균일하게 빛나면 형광등이 된다.
     * 가장자리에서는 죽인다(edge) — 안 그러면 띠 바깥 허공이 같이 밝아진다.
     */
    float sheenPos = fract(t * 0.055 + uPhase * 0.31);
    float du = abs(fract(u - sheenPos + 0.5) - 0.5);
    float sheen = exp(-(du * du) / 0.0056);
    sheen *= 0.5 + 0.5 * smoothstep(0.15, 0.85, abs(fold));
    col += sheen * 0.20 * edge;
    dens += sheen * 0.075 * edge;

    /**
     * 미세 반짝임 — 시안 아래쪽 점 구름과 같은 결.
     *
     * ⚠️ 처음엔 floor 로 셀을 잘라 셀당 하나씩 켰는데, 문턱이 셀마다 균일해서
     * 점이 **격자로 줄을 서** 버렸다(1:1 로 확대하니 바로 보였다).
     * 위치는 픽셀 단위 해시로 뽑아 격자를 없애고, 깜빡임만 큰 셀로 묶는다 —
     * 그래야 점 하나하나는 불규칙한데 무리 지어 켜졌다 꺼진다.
     */
    float sp = hash21(vUv * vec2(1180.0, 340.0) + seed * 2.3);
    float twk = hash21(floor(vUv * vec2(90.0, 30.0)) + floor(t * 1.2) * 5.1);
    float spark = smoothstep(0.9958, 1.0, sp) * smoothstep(0.45, 0.95, twk) * edge;
    col += spark * 0.30;
    dens += spark * 0.10;

    /* 면이 옆으로 설수록(|vTwist|→0) 같은 두께에 더 많은 실이 겹쳐 보인다 —
       실제 천이 그렇다. 그 자리에서 띠가 반짝 진해지는 게 실크로 읽히는 요소다. */
    float grazing = 1.0 + 0.55 * pow(1.0 - abs(vTwist), 2.0);

    float alpha = clamp(dens * grazing, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(col * alpha, alpha);
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
  /**
   * ⚠️ `useThree((s) => s.camera)` 로 받은 객체를 그대로 변형하면 React Compiler 린트가
   * 막는다(`react-hooks/immutability` — "훅이 돌려준 값을 고치지 말 것").
   * R3F 스토어의 `get()` 으로 **그 자리에서** 꺼내 쓰면 훅 반환값을 건드리는 게
   * 아니라서 통과하고, 동작은 동일하다. 리사이즈 감지는 `size` 로 계속 받는다.
   */
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);

  useEffect(() => {
    const camera = get().camera as THREE.OrthographicCamera;
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
  }, [get, size]);

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
          /* 두 판이 반대로 꼬인다 — 하나가 벌어질 때 다른 하나가 조여진다 */
          uTwistDir: { value: i === 0 ? 1 : -1 },
          uSpeed: { value: 0.2 },
          /* 결의 세기. 올리면 선이 도드라지고 내리면 매끈한 판이 된다.
             뒤판(i=1)은 낮춰서 앞판과 결이 겹쳐 보이지 않게 한다. */
          uLineGain: { value: i === 0 ? 1.3 : 0.92 },
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
