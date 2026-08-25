/**
 * 히어로 에셋 경로 + 타워 씬(메인_02) 레이어 실측값.
 *
 * ⚠️ **three 를 절대 import 하지 않는다.** 이 모듈은 섹션 컴포넌트가 static import
 * 하므로, 여기서 three 를 건드리면 3D 청크가 초기 로드로 새어 나온다.
 * (`npm run analyze:chunk` 가 이걸 잡는다)
 *
 * ## 왜 좌표가 코드에 있는가
 * `public/main/img_01_*.webp` 는 Figma **업로드 원본**이다. 시안에서 걸린
 * 크롭·회전·플립·블렌드·투명도가 파일에는 남아 있지 않아서, 그 합성 정보를
 * 여기서 다시 들고 있어야 한다. 숫자는 전부
 * fileKey `2xzudppVSWEHbxVdzofgn3` / 타워 씬 프레임 `8:2877`(1920×920) 기준
 * `get_design_context` 실측이고, 각 스프라이트에 출처 노드 ID 를 박아 뒀다.
 *
 * ## 에셋 ↔ 노드 대응
 * | 파일             | Figma 레이어      | 비고                                    |
 * | ---------------- | ----------------- | --------------------------------------- |
 * | bg-1             | 프레임 fill(하늘) | bg-2 는 거의 동일한 컷이라 미사용       |
 * | particles        | `twi001t3387211`  | soft-light 50%                          |
 * | tower            | `TOWER (2) 2`     | opacity 65%                             |
 * | cloud-1~4        | 구름 스프라이트   | cloud-5/6 은 cloud-4/1 의 1/4·1/7 축소본 |
 * | line-3           | `line_1 1`        | 옅은 파란 웨이브                        |
 * | line-1           | `sdkosad 1`       | 채도 높은 리본                          |
 * | line-2           | `line-3 1`        | 파스텔 리본 (2겹)                       |
 * | line-9           | `line-4 1`        | 점묘 웨이브                             |
 *
 * line-4/6 은 line-3 의 흰 배경본, line-5/7/8 은 line-2/3/1 의 저해상도 중복본이라
 * 쓰지 않는다. cloud-dark-1/2·glow·orb·wave·sphere 는 이 프레임의 합성에 없다.
 */

export const HERO_ASSETS = {
  /** 프레임 fill 로 깔린 하늘. 그라데이션이라 풀블리드 cover 로 늘려도 안 깨진다 */
  sky: "/main/img_01_bg01.webp",
  /**
   * 타워 씬 뒤판 — 하늘·구름·타워·워터마크를 한 장으로 구운 플레이트.
   * 납품본은 `img_02_bg01.png` 3840×1840(시안 2배). 의료진이 이미
   * `img_02_bg01.webp` 를 쓰므로 히어로 네이밍으로 바꿔 넣었다.
   * 모바일은 375×812(2x 750×1624) 전용판 — PC 플레이트를 cover 하면 4배 확대된다.
   */
  backdrop: "/main/img_01_bg02.webp",
  backdropMo: "/main/img_01_bg02_mo.webp",
  /** 8:2880 — soft-light 50% 로 깔리는 파티클 텍스처 */
  particles: "/main/img_01_particles01.webp",
} as const;

/** 파일이 `public/main/` 에 모두 들어와 있다. */
export const HERO_ASSETS_READY = true;

/** 시안 좌표계 — 메인_02(8:2877) 프레임 크기. 모든 스프라이트 좌표의 기준. */
export const TOWER_STAGE = { width: 1920, height: 920 } as const;

export interface TowerSprite {
  /** 실측 출처 Figma 노드 ID */
  node: string;
  src: string;
  /** 시안 px. 회전 **전** 박스의 좌상단/크기 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** deg. CSS `rotate()` 와 같은 부호(양수 = 시계방향) */
  rotate?: number;
  /** 상하 반전. Figma 의 `rotate180 + flipX` / `flipY` 를 합친 결과 */
  flipY?: boolean;
  /** 좌우 반전 */
  flipX?: boolean;
  opacity?: number;
  /** Figma 가 이미지를 박스에 늘려 넣었으면 fill(기본), 잘라 넣었으면 cover */
  fit?: "cover";
  objectPosition?: string;
}

const CLOUD = [
  "/main/img_01_cloud01.webp",
  "/main/img_01_cloud02.webp",
  "/main/img_01_cloud03.webp",
  "/main/img_01_cloud04.webp",
] as const;

/**
 * 상단 구름 덩어리 (8:2881).
 *
 * Figma 에서 네 장이 전부 `rotate 180° + flipX`(= 상하 반전) 로 뒤집혀 있고
 * opacity 40%, 블렌드는 normal 이다. 프레임 위쪽(y −134 ~ 293)에 걸쳐 있어
 * 타워 첨탑 주변 하늘을 뿌옇게 만든다.
 *
 * 같은 덩어리가 8:2892 로 한 번 더 있다 — 위치만 (−55.31, +2) 만큼 옮긴
 * 완전한 복사본이라 마크업을 재사용하고 오프셋만 준다(`TOWER_CLOUD_TOP_OFFSET`).
 *
 * 8:2887(마스크 걸린 다섯 번째 장)은 뺐다. 원본 업로드 중에 대응되는 파일이
 * 없고 opacity 36% 라 눈에 띄지 않는다.
 */
export const TOWER_CLOUDS_TOP: readonly TowerSprite[] = [
  {
    node: "8:2888",
    src: CLOUD[0],
    x: 1145.09,
    y: -91.82,
    w: 748.47,
    h: 305.77,
    flipY: true,
    opacity: 0.4,
  },
  {
    node: "8:2889",
    src: CLOUD[1],
    x: 969.98,
    y: -65.5,
    w: 606.01,
    h: 278.49,
    flipY: true,
    opacity: 0.4,
  },
  {
    node: "8:2890",
    src: CLOUD[2],
    x: 1470.34,
    y: -134.04,
    w: 606.34,
    h: 278.49,
    flipY: true,
    opacity: 0.4,
  },
  {
    node: "8:2891",
    src: CLOUD[3],
    x: 1355.33,
    y: -1.47,
    w: 652.3,
    h: 294.45,
    flipY: true,
    opacity: 0.4,
  },
];

/** 8:2892 = 8:2881 의 평행이동 복사본 (시안 px) */
export const TOWER_CLOUD_TOP_OFFSET = { x: -55.31, y: 2 } as const;

/**
 * 하단 구름 띠 (8:2904) — 세 덩어리.
 *
 * 세 덩어리 모두 `mix-blend-mode: soft-light`, 스프라이트 opacity 90% 다.
 * 소프트라이트라 화면에서는 "구름"이라기보다 지평선 근처를 데우는 안개로 보인다.
 * 각 덩어리에 다른 패럴랙스 속도를 물려서 깊이를 만든다.
 *
 * 각 덩어리의 다섯 번째(마스크) 스프라이트는 top 98~99% 라 프레임 밖이라 뺐다.
 */
export const TOWER_CLOUD_BANDS: readonly (readonly TowerSprite[])[] = [
  // 8:2905 — 좌측 덩어리. 네 장 모두 좌우 반전.
  [
    {
      node: "8:2912",
      src: CLOUD[0],
      x: -193.34,
      y: 677.86,
      w: 1036.43,
      h: 494.74,
      flipX: true,
      opacity: 0.9,
    },
    {
      node: "8:2913",
      src: CLOUD[1],
      x: 246.34,
      y: 679.51,
      w: 839.17,
      h: 450.6,
      flipX: true,
      opacity: 0.9,
    },
    {
      node: "8:2914",
      src: CLOUD[2],
      x: -446.98,
      y: 790.28,
      w: 839.62,
      h: 450.6,
      flipX: true,
      opacity: 0.9,
    },
    {
      node: "8:2915",
      src: CLOUD[3],
      x: -351.36,
      y: 549.98,
      w: 903.27,
      h: 476.42,
      flipX: true,
      opacity: 0.9,
    },
  ],
  // 8:2916 — 우측 덩어리
  [
    { node: "8:2923", src: CLOUD[0], x: 1074.05, y: 596.62, w: 799.58, h: 381.68, opacity: 0.9 },
    { node: "8:2924", src: CLOUD[1], x: 887.04, y: 597.91, w: 647.39, h: 347.62, opacity: 0.9 },
    { node: "8:2925", src: CLOUD[2], x: 1421.76, y: 683.38, w: 647.74, h: 347.62, opacity: 0.9 },
    { node: "8:2926", src: CLOUD[3], x: 1298.69, y: 498.0, w: 696.84, h: 367.54, opacity: 0.9 },
  ],
  // 8:2927 — 중앙 덩어리
  [
    { node: "8:2934", src: CLOUD[0], x: 377.86, y: 685.22, w: 884.15, h: 457.5, opacity: 0.9 },
    { node: "8:2935", src: CLOUD[1], x: 171.07, y: 686.78, w: 715.87, h: 416.68, opacity: 0.9 },
    { node: "8:2936", src: CLOUD[2], x: 762.05, y: 789.18, w: 716.25, h: 416.68, opacity: 0.9 },
    { node: "8:2937", src: CLOUD[3], x: 626.11, y: 566.99, w: 770.55, h: 440.56, opacity: 0.9 },
  ],
];

/**
 * 광선/웨이브 (8:2949) — 아래에서 위 순서.
 *
 * 전부 프레임(1920×920)에 마스크로 잘려 있어서 렌더할 때 스테이지에 clip 한다.
 * 회전각·박스는 Figma 가 내준 `rotate(...)` 와 컨테이너 중심에서 역산했다.
 *
 * `8:2956` 은 시안에서 **같은 이미지를 두 장 겹쳐** 놨다(밀도 2배).
 * `repeat: 2` 로 그대로 재현한다.
 */
export const TOWER_LINES: readonly (TowerSprite & { repeat?: number })[] = [
  {
    node: "8:2952",
    src: "/main/img_01_line03.webp",
    x: -234.81,
    y: 352.4,
    w: 3566.9,
    h: 384.0,
    rotate: -14.29,
    fit: "cover",
  },
  {
    node: "8:2955",
    src: "/main/img_01_line01.webp",
    x: 378.72,
    y: 531.07,
    w: 1705.02,
    h: 230.85,
    rotate: -20.71,
    fit: "cover",
    objectPosition: "bottom",
  },
  {
    node: "8:2956",
    src: "/main/img_01_line02.webp",
    x: 98.22,
    y: 325.3,
    w: 2584.15,
    h: 296.75,
    rotate: 18.3,
    flipY: true,
    fit: "cover",
    repeat: 2,
  },
  {
    node: "8:2957",
    src: "/main/img_01_line09.webp",
    x: 450.46,
    y: 544.84,
    w: 2212.91,
    h: 111.18,
    rotate: -7.71,
    fit: "cover",
  },
];

/**
 * 타워(8:2946) / 파티클(8:2880) 은 스프라이트가 한 장뿐이라 CSS 클래스가
 * 직접 좌표를 들고 있다 — `.towerCrop` / `.towerPic` / `.particlesBox` 주석에
 * 노드 ID 와 원본 수치가 그대로 붙어 있으니 고칠 땐 그쪽을 본다.
 *
 *   타워 crop  8:2947 `bg`  x706 y56 1199×1028.03  (마스크 사각형)
 *   타워 사진  8:2948       x754 y−11 1405×1277, opacity 65%
 *   파티클     8:2880       1920×1080 박스 + height 112.02% / top 0.02%, soft-light 50%
 */
