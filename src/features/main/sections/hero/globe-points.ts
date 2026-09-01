/**
 * 히어로 지도 구체의 파티클 좌표 생성.
 *
 * three 를 import 하지 않는다 — 순수 계산만 있어야 3D 청크 밖에서도(테스트 등)
 * 돌릴 수 있고, 무엇보다 `hero-assets.ts` 와 같은 이유로 의존성을 안 늘린다.
 *
 * 좌표계
 * ------
 *   +Y = 북극,  +Z = 카메라 방향(경도 0°),  경도는 +X 쪽으로 증가
 * 이 규약 때문에 `lon = atan2(x, z)` 다. (일반적인 `atan2(z, x)` 가 아니다)
 */
import { LAND_MASK_BASE64, LAND_MASK_HEIGHT, LAND_MASK_WIDTH } from "./land-mask.generated";

/**
 * 구체 반지름(월드 단위).
 *
 * 카메라 z=6 / fov 38 → 화면 높이의 절반이 월드 2.066 이다.
 * 시안(`2:416`)에서 구체 지름은 프레임 높이(920)의 약 82% 를 차지하므로
 *   R = 0.82 × (2 × 2.066) / 2 = 1.69
 * 카메라·fov 를 건드리면 이 값도 같이 다시 잡아야 한다.
 */
export const GLOBE_RADIUS = 1.69;

/**
 * 정면에 오는 경도·위도. 서울(127.0E, 37.5N).
 *
 * 카피가 "세계를 향한 BGN의 도약" 이라 한반도가 정면에서 빛나는 구도가 맞다.
 * 다른 지점을 정면에 두고 싶으면 여기만 바꾸면 된다 — 회전 오프셋과 코어 글로우
 * 위치가 전부 이 값에서 파생된다.
 */
export const FOCUS_LON = 127.0;
export const FOCUS_LAT = 37.5;

const DEG = Math.PI / 180;

/** 시드 기반 결정론적 PRNG (mulberry32). 같은 시드 → 항상 같은 분포. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 1비트 마스크 해제. 모듈 로드 시 딱 한 번.
 *
 * `atob` 이 없는 환경(서버)에서는 빈 마스크를 돌려준다 — 이 모듈은
 * `ssr: false` 인 3D 청크에서만 쓰이므로 실제로 걸릴 일은 없지만,
 * 여기서 던지면 원인 찾기 어려운 하이드레이션 오류로 번진다.
 */
const LAND_MASK: Uint8Array = (() => {
  if (typeof atob !== "function") return new Uint8Array(0);
  const bin = atob(LAND_MASK_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
})();

/* ==========================================================================
   한반도 확대(돋보기) — 수정요청 6차 1p
   ==========================================================================
   지구본 위에 잠실·부산 마커를 얹으려면 한반도가 손가락으로 누를 만해야 한다.
   실제 축척이면 한반도는 구체 지름의 3% 도 안 돼서 두 점이 붙어 버린다.
   기획안 원문도 "한반도가 조금 작아서 건물을 표현하기 어려울것같아서
   한반도를 지구상에서 조금 확대해서" 라고 적고 있다.

   ## 왜 "한반도만 크게 그리기"가 아니라 돋보기인가
   한반도 폴리곤만 키우면 일본·중국과 **겹친다**. 대신 초점(서울) 둘레
   `ZOOM_RADIUS_DEG` 원판 안에서 각거리를 다시 매핑한다.
     · 중심 가까이(한반도)  → 밖으로 밀려나며 커진다
     · 원판 바깥쪽(일본)    → 그만큼 눌리면서 옆으로 밀린다
     · 원판 경계            → 그대로 (바깥 세계와 이음매가 없다)
   덕분에 일본을 지우지 않아도 자리가 비고, 대륙 실루엣도 안 깨진다.

   ## 매핑 함수 — 3차 에르미트
   t = d / R 에 대해  f(t) = (M−1)t³ + (2−2M)t² + M·t,  d' = R·f(t)
     f(0)=0, f(1)=1, f'(0)=M, **f'(1)=1**

   ⚠️ 마지막 조건이 핵심이다. 처음엔 뫼비우스형 `M·t/(1+(M−1)t)` 를 썼는데
   그건 f'(1)=1/M 이라 원판 **경계에 점이 M 배로 몰려** 지구본에 밝은 고리가
   하나 생겼다(캡처로 확인). 경계에서 미분이 1 이면 바깥 세계와 밀도가
   이어져서 고리가 안 생긴다.

   단조성 조건은 f'(t)=3(M−1)t²+2(2−2M)t+M ≥ 0 → **M ≤ 4**.
   4 를 넘기면 중간에서 접혀(fold) 대륙이 뒤집힌다.

   ## 왜 벡터로 푸는가
   경위도로 하면 고위도에서 경도 간격이 좁아져 원판이 타원으로 찌그러진다.
   초점 F 에서 목표점 쪽 접선 u 를 구해 `F·cos d' + u·sin d'` 로 다시 세우면
   큰 원(great circle)을 따라 정확히 각거리만 늘린다.
   ========================================================================== */

/** 돋보기 반경(도). 이 밖은 손대지 않는다. 28° ≈ 서울에서 상하이·삿포로. */
export const ZOOM_RADIUS_DEG = 28;
/** 중심 배율. 단조성 한계가 **정확히 4** 다. 3.9 면 한반도 세로가 약 3 배가 된다. */
export const ZOOM_POWER = 3.9;

const ZOOM_R = ZOOM_RADIUS_DEG * (Math.PI / 180);

/** 돋보기 중심 — 초점(서울)에서 부산 쪽으로 조금 내린다. 두 마커가 함께 커진다. */
const ZOOM_CENTER: [number, number, number] = (() => {
  const la = 36.4 * (Math.PI / 180);
  const lo = 127.9 * (Math.PI / 180);
  const c = Math.cos(la);
  return [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)];
})();

/** f(t) = (M−1)t³ + (2−2M)t² + M·t */
function zoomF(t: number): number {
  const a = ZOOM_POWER - 1;
  const b = 2 - 2 * ZOOM_POWER;
  return ((a * t + b) * t + ZOOM_POWER) * t;
}

/** f'(t). 단조 구간에서 최솟값 0.2 정도라 뉴턴법이 안정적이다. */
function zoomFPrime(t: number): number {
  const a = ZOOM_POWER - 1;
  const b = 2 - 2 * ZOOM_POWER;
  return 3 * a * t * t + 2 * b * t + ZOOM_POWER;
}

/**
 * f 의 역함수. 뉴턴법 10회.
 *
 * f 가 [0,1] 에서 단조 증가하고 f(t) ≥ t 이므로 시작점 t=y 가 항상 해의
 * 오른쪽이다. f' 이 0.2 아래로 안 내려가서 발산하지 않는다.
 */
function zoomFInverse(y: number): number {
  if (y <= 0) return 0;
  if (y >= 1) return 1;
  let t = y;
  for (let i = 0; i < 10; i += 1) {
    const e = zoomF(t) - y;
    if (e > -1e-7 && e < 1e-7) break;
    t -= e / zoomFPrime(t);
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  return t;
}

/** 초점 F 를 기준으로 각거리를 `remap` 으로 갈아 끼운다. 원판 밖이면 그대로. */
function warpAroundCenter(
  x: number,
  y: number,
  z: number,
  remap: (t: number) => number,
): [number, number, number] {
  const [fx, fy, fz] = ZOOM_CENTER;
  let dot = x * fx + y * fy + z * fz;
  dot = dot < -1 ? -1 : dot > 1 ? 1 : dot;
  const d = Math.acos(dot);
  if (d >= ZOOM_R || d < 1e-6) return [x, y, z];

  const nd = ZOOM_R * remap(d / ZOOM_R);

  /* F 에 수직인 성분 = 초점에서 목표점으로 향하는 접선 */
  let ux = x - fx * dot;
  let uy = y - fy * dot;
  let uz = z - fz * dot;
  const ul = Math.hypot(ux, uy, uz);
  if (ul < 1e-9) return [x, y, z];
  ux /= ul;
  uy /= ul;
  uz /= ul;

  const c = Math.cos(nd);
  const sn = Math.sin(nd);
  return [fx * c + ux * sn, fy * c + uy * sn, fz * c + uz * sn];
}

/**
 * 확대: 원래 좌표 → 화면에 그릴 좌표.
 * **마커 좌표도 반드시 이걸 거쳐야** 지도와 어긋나지 않는다.
 */
export function magnifyKorea(x: number, y: number, z: number): [number, number, number] {
  return warpAroundCenter(x, y, z, zoomF);
}

/**
 * 축소: 화면 좌표 → 원래 좌표. **점을 뿌릴 때 쓰는 건 이쪽이다.**
 *
 * ## 왜 역함수로 뿌리나 — 중국이 원형으로 파이던 이유
 * 처음엔 "균일하게 뽑아서 → 확대" 순서였다. 그러면 **모양만 커지는 게 아니라
 * 밀도까지 같이 늘어난다.** 면적 배율 J = (f/t)·f' 을 실제로 찍어 보면
 *   중심 t=0.05 → J 9.3 (밀도 0.11배, 텅 빔)
 *   t≈0.70    → J 0.25 (밀도 3.95배, 밝은 고리)
 * 이 고리가 지구본에 동그란 테두리로 보이고, 그 안쪽이 성겨서 중국이 원형으로
 * 파인 것처럼 읽혔다.
 *
 * 그래서 순서를 뒤집는다. **출력 공간에서 균일하게 뽑고, 역변환한 자리가
 * 육지인지 묻는다.** 밀도는 어디서나 1 로 유지되고 모양만 늘어난다.
 */
export function unmagnifyKorea(x: number, y: number, z: number): [number, number, number] {
  return warpAroundCenter(x, y, z, zoomFInverse);
}


/* ==========================================================================
   일본 — 축소해서 한반도 오른쪽 아래에 다시 놓기
   ==========================================================================
   돋보기만으로는 일본이 같이 커진다. 후쿠오카가 돋보기 중심에서 2.5° 밖에
   안 떨어져 있어서(부산이 1.6°) **핵심 확대 구간 안**이기 때문이다.
   중심을 옮기거나 반경을 줄여도 둘을 갈라놓을 수 없다 — 실제로 붙어 있다.

   그래서 일본은 렌즈를 태우지 않고 **따로 떼어 닮음변환**한다.
     1) 자기 중심 `JAPAN_FROM` 둘레로 각거리를 `JAPAN_SCALE` 배 (제자리 축소)
     2) 중심을 `JAPAN_AT` 으로 옮기는 고정 회전 (최종 자리로 이동)
   섬이라 사방이 바다다 — 줄이고 옮겨도 대륙과 찢어질 이음매가 없다.

   ## ⚠️ 렌즈 **뒤**가 아니라 렌즈를 **안 거친다**
   예전엔 (축소 → 밀기 → 돋보기) 순서였다. 그러면 렌즈가 한 번 더 밀어내는
   바람에 최종 위치를 값으로 못 잡는다 — 실제로 24.6° 까지 밀려나 구체
   가장자리에서 원근으로 눌려 거의 안 보였다. 지금은 `JAPAN_AT` 이 곧
   **화면에 찍히는 자리**다. 실제 지리 위치가 아니어도 된다는 전제다.

   원래 자리의 일본은 세계 마스크에서 **빼고**(`isJapanSource`), 새 자리에만
   그린다. 둘 다 같은 표집 루프에서 처리하므로 밀도는 저절로 맞는다.
   ========================================================================== */

/**
 * 축소 배율. 렌즈를 안 거치므로 **이 값이 곧 화면 배율**이다.
 * 규슈↔홋카이도 14.10° × 0.62 = 8.7°. 확대된 한반도 남북이 18.9° 이므로
 * 열도가 한반도의 46% 길이로 들어온다 — 확실히 작다.
 */
export const JAPAN_SCALE = 0.62;
/** 일본 열도의 원래 중심 — 축소 기준점 */
const JAPAN_FROM: [number, number] = [137.5, 37.5];
/**
 * 화면에 놓을 자리. **실제 지리 위치가 아니다.**
 * 돋보기 중심(127.9E/36.4N)에서 남동쪽(방위 135°)으로 13° 떨어진 점이라
 * 확대된 한반도(반경 ~9.5°) 바로 **오른쪽 아래**에 붙는다.
 */
const JAPAN_AT: [number, number] = [138.7, 27.2];

const JAPAN_FROM_V = (() => {
  const la = JAPAN_FROM[1] * (Math.PI / 180);
  const lo = JAPAN_FROM[0] * (Math.PI / 180);
  const c = Math.cos(la);
  return [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)] as [number, number, number];
})();

/** `JAPAN_FROM` → `JAPAN_AT` 회전축(정규화)과 각도 */
const JAPAN_PUSH = (() => {
  const la = JAPAN_AT[1] * (Math.PI / 180);
  const lo = JAPAN_AT[0] * (Math.PI / 180);
  const c = Math.cos(la);
  const to: [number, number, number] = [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)];
  const [ax, ay, az] = JAPAN_FROM_V;
  let kx = ay * to[2] - az * to[1];
  let ky = az * to[0] - ax * to[2];
  let kz = ax * to[1] - ay * to[0];
  const kl = Math.hypot(kx, ky, kz);
  kx /= kl;
  ky /= kl;
  kz /= kl;
  const dot = ax * to[0] + ay * to[1] + az * to[2];
  return { kx, ky, kz, angle: Math.acos(dot < -1 ? -1 : dot > 1 ? 1 : dot) };
})();

/** 로드리게스 회전. `sign` 이 −1 이면 역회전. */
function rotateAroundAxis(
  x: number,
  y: number,
  z: number,
  sign: number,
): [number, number, number] {
  const { kx, ky, kz, angle } = JAPAN_PUSH;
  const a = angle * sign;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dot = kx * x + ky * y + kz * z;
  const cx = ky * z - kz * y;
  const cy = kz * x - kx * z;
  const cz = kx * y - ky * x;
  return [
    x * c + cx * s + kx * dot * (1 - c),
    y * c + cy * s + ky * dot * (1 - c),
    z * c + cz * s + kz * dot * (1 - c),
  ];
}

/** `JAPAN_FROM` 둘레로 각거리에 `k` 를 곱한다. k<1 이면 축소. */
function scaleAboutJapan(
  x: number,
  y: number,
  z: number,
  k: number,
): [number, number, number] {
  const [fx, fy, fz] = JAPAN_FROM_V;
  let dot = x * fx + y * fy + z * fz;
  dot = dot < -1 ? -1 : dot > 1 ? 1 : dot;
  const d = Math.acos(dot);
  if (d < 1e-6) return [x, y, z];
  let ux = x - fx * dot;
  let uy = y - fy * dot;
  let uz = z - fz * dot;
  const ul = Math.hypot(ux, uy, uz);
  if (ul < 1e-9) return [x, y, z];
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const nd = d * k;
  const c = Math.cos(nd);
  const sn = Math.sin(nd);
  return [fx * c + ux * sn, fy * c + uy * sn, fz * c + uz * sn];
}

/** 원래 좌표 → 화면에 찍을 좌표 (돋보기를 거치지 않는다) */
export function shrinkJapan(x: number, y: number, z: number): [number, number, number] {
  const [sx, sy, sz] = scaleAboutJapan(x, y, z, JAPAN_SCALE);
  return rotateAroundAxis(sx, sy, sz, 1);
}

/** 화면 좌표 → 원래 좌표 */
function unshrinkJapan(x: number, y: number, z: number): [number, number, number] {
  const [rx, ry, rz] = rotateAroundAxis(x, y, z, -1);
  return scaleAboutJapan(rx, ry, rz, 1 / JAPAN_SCALE);
}

/**
 * 원래 좌표가 일본 열도인가.
 *
 * 캡(중심 9°)만으로는 부산(7.2°)이 걸린다. 동해를 가르는 사선을 하나 더 둔다.
 *   경도 > 129.6 + 0.35·(위도 − 33)
 * 부산 129.06 / 두만강 130.4(문턱 132.9) / 블라디보스토크 131.9(문턱 133.1) 는
 * 빠지고, 규슈 서안 129.7(문턱 129.6) 과 홋카이도 142.5(문턱 133.2) 는 들어온다.
 */
function isJapanSource(x: number, y: number, z: number): boolean {
  const [fx, fy, fz] = JAPAN_FROM_V;
  let dot = x * fx + y * fy + z * fz;
  dot = dot < -1 ? -1 : dot > 1 ? 1 : dot;
  if (Math.acos(dot) > 9 * DEG) return false;
  const lat = Math.asin(y < -1 ? -1 : y > 1 ? 1 : y) / DEG;
  const lon = Math.atan2(x, z) / DEG;
  return lon > 129.6 + 0.35 * (lat - 33);
}

/** 단위 방향벡터가 육지인가 */
function isLand(x: number, y: number, z: number): boolean {
  if (LAND_MASK.length === 0) return true; // 마스크가 없으면 균일 분포로 폴백
  const lat = Math.asin(y < -1 ? -1 : y > 1 ? 1 : y) / DEG;
  const lon = Math.atan2(x, z) / DEG;
  let col = ((lon + 180) / 360) * LAND_MASK_WIDTH;
  let row = ((90 - lat) / 180) * LAND_MASK_HEIGHT;
  col = col < 0 ? 0 : col >= LAND_MASK_WIDTH ? LAND_MASK_WIDTH - 1 : Math.floor(col);
  row = row < 0 ? 0 : row >= LAND_MASK_HEIGHT ? LAND_MASK_HEIGHT - 1 : Math.floor(row);
  const i = row * LAND_MASK_WIDTH + col;
  return (((LAND_MASK[i >> 3] ?? 0) >> (i & 7)) & 1) === 1;
}

/**
 * 한반도 해안선 (경도, 위도). 시계 방향.
 *
 * 세계 마스크는 한국을 몇 픽셀짜리 네모로 뭉갠다. 그 위에 해안선 안 점만
 * 소량 더 심어 밀도만 살짝 올린다. 색·레이어는 바꾸지 않는다.
 */
const KOREA_MAIN: readonly [number, number][] = [
  [124.4, 40.05],
  [125.35, 40.55],
  [126.15, 41.05],
  [126.95, 41.42],
  [127.7, 41.7],
  [128.25, 41.98],
  [128.85, 42.18],
  [129.55, 42.38],
  [130.35, 42.28],
  [130.15, 41.65],
  [129.7, 40.85],
  [129.35, 40.15],
  [128.95, 39.55],
  [127.55, 39.18],
  [127.85, 38.72],
  [128.45, 38.25],
  [128.85, 37.7],
  [129.15, 37.15],
  [129.4, 36.45],
  [129.42, 35.85],
  [129.22, 35.35],
  [129.04, 35.08],
  [128.55, 34.88],
  [127.95, 34.72],
  [127.35, 34.55],
  [126.85, 34.35],
  [126.42, 34.27],
  [126.18, 34.55],
  [126.28, 34.95],
  [126.48, 35.55],
  [126.58, 36.05],
  [126.32, 36.55],
  [126.22, 36.95],
  [126.52, 37.38],
  [126.22, 37.72],
  [125.75, 37.95],
  [125.35, 38.35],
  [125.12, 38.85],
  [124.72, 39.35],
  [124.42, 39.75],
];

const KOREA_JEJU: readonly [number, number][] = [
  [126.16, 33.32],
  [126.3, 33.16],
  [126.55, 33.1],
  [126.82, 33.22],
  [126.96, 33.48],
  [126.78, 33.56],
  [126.48, 33.5],
  [126.26, 33.4],
];

function pointInRing(lon: number, lat: number, ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isKoreaLonLat(lon: number, lat: number): boolean {
  return pointInRing(lon, lat, KOREA_MAIN) || pointInRing(lon, lat, KOREA_JEJU);
}

/**
 * 구 표면 균일 분포 1점.
 *
 * `acos(2v - 1)` 을 쓰는 이유: 위도를 그냥 균등 난수로 뽑으면 극에 몰린다.
 * (구면의 면적 요소가 sin φ 라서)
 */
function randomDirection(rand: () => number, out: [number, number, number]) {
  const theta = 2 * Math.PI * rand();
  const phi = Math.acos(2 * rand() - 1);
  const s = Math.sin(phi);
  out[0] = s * Math.cos(theta);
  out[1] = Math.cos(phi);
  out[2] = s * Math.sin(theta);
}

export interface PointCloud {
  positions: Float32Array;
  /** 파티클별 밝기 배수(0~1). 균일하면 프린트한 것처럼 납작해 보인다. */
  scales: Float32Array;
}

/**
 * 육지 레이어 — 대륙 위에만 밀집.
 *
 * 기각 표집(rejection sampling)이다. 육지는 구면의 약 29% 라 평균 3.4회면
 * 1점이 통과한다. 2만 점이면 약 7만 회 — 1ms 대다.
 * `maxTries` 는 마스크가 깨졌을 때 무한루프로 탭을 얼리지 않기 위한 안전장치.
 */
export function makeLandPoints(count: number, seed: number): PointCloud {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const dir: [number, number, number] = [0, 0, 0];

  let written = 0;
  let tries = 0;
  const maxTries = count * 40;

  while (written < count && tries < maxTries) {
    tries += 1;
    /**
     * ⚠️ 순서가 중요하다. `dir` 은 **화면에 그릴 자리**이고, 육지인지 묻는 건
     * 그 자리를 되돌린 좌표다. 반대로 하면(뽑고 나서 확대) 밀도까지 같이
     * 늘어나 원형 고리가 생긴다 — `unmagnifyKorea` 주석 참고.
     */
    randomDirection(rand, dir);
    const [sx, sy, sz] = unmagnifyKorea(dir[0], dir[1], dir[2]);

    /**
     * 두 갈래를 한 루프에서 본다 — 그래야 세계와 일본의 밀도가 자동으로 맞는다.
     *   1) 원래 자리 육지. 단 **일본은 뺀다**(자기 자리엔 안 그린다).
     *   2) 일본 변환을 되돌린 자리가 일본 육지라면 여기에 그린다.
     */
    let ok = isLand(sx, sy, sz) && !isJapanSource(sx, sy, sz);
    if (!ok) {
      /* ⚠️ `sx` 가 아니라 `dir` 이다 — 일본은 돋보기를 거치지 않는다.
         렌즈를 태우면 최종 위치를 값으로 못 잡는다(위 주석 참고). */
      const [jx, jy, jz] = unshrinkJapan(dir[0], dir[1], dir[2]);
      ok = isJapanSource(jx, jy, jz) && isLand(jx, jy, jz);
    }
    if (!ok) continue;

    // 껍질에 두께를 준다. 완전히 같은 반지름이면 실루엣 가장자리가 칼같이 잘려
    // 시안의 "흩어지는" 느낌이 안 난다.
    const r = GLOBE_RADIUS * (1 + (rand() - 0.35) * 0.018);
    positions[written * 3] = dir[0] * r;
    positions[written * 3 + 1] = dir[1] * r;
    positions[written * 3 + 2] = dir[2] * r;
    scales[written] = 0.55 + rand() * 0.45;
    written += 1;
  }

  const worldPos = positions.subarray(0, written * 3);
  const worldScale = scales.subarray(0, written);
  /**
   * 세계 마스크 한국(~370점)에 더할 보강 점.
   *
   * 예전엔 0.35% 였다. 돋보기(`magnifyKorea`)가 중심부를 배율의 제곱만큼
   * **성기게** 만들기 때문에(면적이 M² 로 늘어난다) 같은 밀도로 보이려면
   * 그만큼 더 심어야 한다. 2.6² ≈ 6.8 배지만 세계 마스크 점도 같이 늘어나
   * 오므로 1.2% 로 둔다. 더 올리면 가운데가 타 버린다.
   */
  const korea = makeKoreaPoints(Math.max(260, Math.round(count * 0.012)), seed ^ 0x51ed);
  const mergedPos = new Float32Array(worldPos.length + korea.positions.length);
  const mergedScale = new Float32Array(worldScale.length + korea.scales.length);
  mergedPos.set(worldPos);
  mergedPos.set(korea.positions, worldPos.length);
  mergedScale.set(worldScale);
  mergedScale.set(korea.scales, worldScale.length);
  return { positions: mergedPos, scales: mergedScale };
}

/**
 * 돋보기 중심 둘레 `capDeg` 안에서 **균일하게** 방향 하나를 뽑는다.
 *
 * `cos θ` 를 균등하게 뽑아야 구면에서 균일하다(θ 를 균등하게 뽑으면 중심에 몰린다).
 * 로컬 프레임(t1, t2, F)에서 만든 뒤 그대로 월드로 쓴다.
 */
function randomInZoomCap(rand: () => number, capDeg: number, out: [number, number, number]) {
  const [fx, fy, fz] = ZOOM_CENTER;
  /* 접선 기저 — 보조축은 F 와 가장 덜 나란한 좌표축으로 고른다 */
  const hx = Math.abs(fy) < 0.9 ? 0 : 1;
  const hy = Math.abs(fy) < 0.9 ? 1 : 0;
  const hz = 0;
  let t1x = hy * fz - hz * fy;
  let t1y = hz * fx - hx * fz;
  let t1z = hx * fy - hy * fx;
  const l1 = Math.hypot(t1x, t1y, t1z);
  t1x /= l1;
  t1y /= l1;
  t1z /= l1;
  const t2x = fy * t1z - fz * t1y;
  const t2y = fz * t1x - fx * t1z;
  const t2z = fx * t1y - fy * t1x;

  const cosCap = Math.cos(capDeg * DEG);
  const cosT = cosCap + (1 - cosCap) * rand();
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = 2 * Math.PI * rand();
  const cp = Math.cos(phi) * sinT;
  const sp = Math.sin(phi) * sinT;
  out[0] = fx * cosT + t1x * cp + t2x * sp;
  out[1] = fy * cosT + t1y * cp + t2y * sp;
  out[2] = fz * cosT + t1z * cp + t2z * sp;
}

/**
 * 해안선 안 흰 가루. 육지와 같은 크기·밝기.
 *
 * 세계 육지와 **같은 방식**으로 뽑는다 — 확대된 한반도를 덮는 캡(16°)에서
 * 균일하게 뽑고, 역변환한 자리가 해안선 안인지 묻는다. 예전처럼 경위도 상자에서
 * 뽑아 확대하면 중심이 성겨져 가운데가 비어 보인다.
 */
function makeKoreaPoints(count: number, seed: number): PointCloud {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const dir: [number, number, number] = [0, 0, 0];

  let written = 0;
  let tries = 0;
  const maxTries = count * 80;

  while (written < count && tries < maxTries) {
    tries += 1;
    /* 신의주가 중심에서 5.6° → 확대 후 14.9°. 16 이면 제주까지 다 덮는다. */
    randomInZoomCap(rand, 16, dir);
    const [sx, sy, sz] = unmagnifyKorea(dir[0], dir[1], dir[2]);
    const lat = Math.asin(sy < -1 ? -1 : sy > 1 ? 1 : sy) / DEG;
    const lon = Math.atan2(sx, sz) / DEG;
    if (!isKoreaLonLat(lon, lat)) continue;
    const r = GLOBE_RADIUS * (1 + (rand() - 0.35) * 0.018);
    positions[written * 3] = dir[0] * r;
    positions[written * 3 + 1] = dir[1] * r;
    positions[written * 3 + 2] = dir[2] * r;
    scales[written] = 0.55 + rand() * 0.45;
    written += 1;
  }

  return { positions: positions.subarray(0, written * 3), scales: scales.subarray(0, written) };
}

/**
 * 베이스 레이어 — 바다까지 포함한 옅은 구면.
 *
 * 이게 없으면 대륙만 공중에 떠 있어 "구"로 안 읽힌다. 시안에서도 원반 전체가
 * 옅게 차 있고 그 위에 대륙이 밝게 얹혀 있다.
 */
export function makeShellPoints(count: number, seed: number): PointCloud {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const dir: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < count; i += 1) {
    randomDirection(rand, dir);
    const r = GLOBE_RADIUS * (1 + (rand() - 0.5) * 0.012);
    positions[i * 3] = dir[0] * r;
    positions[i * 3 + 1] = dir[1] * r;
    positions[i * 3 + 2] = dir[2] * r;
    scales[i] = 0.25 + rand() * 0.35;
  }
  return { positions, scales };
}

/**
 * 헤일로 — 구 바깥으로 흩날리는 입자.
 *
 * 시안 구체는 경계가 딱 떨어지지 않고 바깥으로 번진다.
 * 반지름을 `1 + u³ × 0.3` 로 뽑아 안쪽에 몰리고 바깥으로 갈수록 성기게 만든다.
 */
export function makeHaloPoints(count: number, seed: number): PointCloud {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const dir: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < count; i += 1) {
    randomDirection(rand, dir);
    const u = rand();
    const t = u * u * u;
    const r = GLOBE_RADIUS * (1 + t * 0.16);
    positions[i * 3] = dir[0] * r;
    positions[i * 3 + 1] = dir[1] * r;
    positions[i * 3 + 2] = dir[2] * r;
    // 바깥으로 갈수록 어두워진다
    scales[i] = (1 - t) * (0.3 + rand() * 0.5);
  }
  return { positions, scales };
}

/** 경위도 → 단위 방향벡터 (위 좌표계 규약) */
export function lonLatToVector(lon: number, lat: number): [number, number, number] {
  const la = lat * DEG;
  const lo = lon * DEG;
  const c = Math.cos(la);
  return [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)];
}

/**
 * `FOCUS_LON` 을 카메라 정면(+Z)으로 가져오는 Y축 회전량(라디안).
 *
 * three 의 R_y(θ) 는 `atan2(x, z)` 를 θ 만큼 **더한다**. 정면은 각 0 이므로
 * 경도 φ 를 정면에 두려면 −φ 를 걸어야 한다.
 */
export const FOCUS_ROTATION_Y = -FOCUS_LON * DEG;

/* ==========================================================================
   결(flow line) — 시안 구체의 "지문 무늬"
   ========================================================================== */

/**
 * 구면 위 접선 벡터장. 여러 소용돌이 축을 겹쳐 지문 같은 소용돌이를 만든다.
 *
 * 균등 난수 껍질만으로는 시안의 화려함이 안 나온다. 시안 구체를 보면 입자가
 * **곡선 띠를 따라 줄지어** 있다(등고선/지문 무늬). 그건 분포가 아니라 **흐름**이라
 * 난수로는 못 만들고 벡터장을 따라 걸어야 한다.
 *
 * `cross(axis, p)` 는 axis 를 중심으로 도는 접선이다. 여기에 다른 축과의 내적으로
 * 만든 사인파를 곱해 띠를 만들고, 축을 여러 개 겹쳐 소용돌이가 갈라지게 한다.
 */
function flowTangent(p: readonly [number, number, number], out: [number, number, number]) {
  const [x, y, z] = p;
  // 축 3개(무리수 방향이라 패턴이 반복되지 않는다)
  const a1: [number, number, number] = [0.577, 0.577, 0.577];
  const a2: [number, number, number] = [-0.707, 0.5, 0.5];
  const a3: [number, number, number] = [0.267, -0.802, 0.535];

  const d2 = x * a2[0] + y * a2[1] + z * a2[2];
  const d3 = x * a3[0] + y * a3[1] + z * a3[2];

  // cross(a1, p) — a1 축 회전 접선
  const c1x = a1[1] * z - a1[2] * y;
  const c1y = a1[2] * x - a1[0] * z;
  const c1z = a1[0] * y - a1[1] * x;
  // cross(a2, p)
  const c2x = a2[1] * z - a2[2] * y;
  const c2y = a2[2] * x - a2[0] * z;
  const c2z = a2[0] * y - a2[1] * x;

  const w1 = Math.sin(d2 * 7.4) * 0.95 + 0.3;
  const w2 = Math.cos(d3 * 5.2) * 0.85;

  let tx = c1x * w1 + c2x * w2;
  let ty = c1y * w1 + c2y * w2;
  let tz = c1z * w1 + c2z * w2;

  // 접평면으로 투영(수치오차로 구면을 벗어나는 걸 막는다)
  const dp = tx * x + ty * y + tz * z;
  tx -= x * dp;
  ty -= y * dp;
  tz -= z * dp;

  const len = Math.hypot(tx, ty, tz) || 1;
  out[0] = tx / len;
  out[1] = ty / len;
  out[2] = tz / len;
}

/**
 * 결 입자 — 스트림라인을 따라 점을 늘어놓는다.
 * `lines` 개의 선을 각각 `count / lines` 걸음씩 걷는다.
 */
export function makeFlowPoints(count: number, seed: number, lines = 420): PointCloud {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const dir: [number, number, number] = [0, 0, 0];
  const tan: [number, number, number] = [0, 0, 0];

  const perLine = Math.max(2, Math.floor(count / lines));
  /**
   * ⚠️ 스텝이 곧 **점 사이 간격**이다. 0.024rad 로 두면 화면에서 점 간격이 8px 이라
   * 선이 아니라 그냥 흩뿌린 점으로 읽힌다(실제로 그렇게 만들어서 무늬가 안 보였다).
   * 0.007 이면 ~2px 라 점들이 이어져 **실 한 올**이 된다.
   */
  const step = 0.007;
  let i = 0;

  for (let l = 0; l < lines && i < count; l += 1) {
    randomDirection(rand, dir);
    /* 선마다 밝기를 다르게 — 균일하면 격자처럼 보인다 */
    const lineScale = 0.22 + rand() * 0.4;
    for (let j = 0; j < perLine && i < count; j += 1) {
      flowTangent(dir, tan);
      dir[0] += tan[0] * step;
      dir[1] += tan[1] * step;
      dir[2] += tan[2] * step;
      const inv = 1 / (Math.hypot(dir[0], dir[1], dir[2]) || 1);
      dir[0] *= inv;
      dir[1] *= inv;
      dir[2] *= inv;

      const r = GLOBE_RADIUS * (1 + (rand() - 0.5) * 0.01);
      positions[i * 3] = dir[0] * r;
      positions[i * 3 + 1] = dir[1] * r;
      positions[i * 3 + 2] = dir[2] * r;
      scales[i] = lineScale;
      i += 1;
    }
  }
  return { positions, scales };
}

/**
 * 궤도 링 — 구 바깥을 도는 점선 고리. 시안에 3~4 개 보인다.
 * 원을 그린 뒤 임의의 3D 자세로 돌린다(로드리게스 회전).
 */
export function makeOrbitPoints(count: number, seed: number, rings = 3): PointCloud {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const axis: [number, number, number] = [0, 0, 0];
  const perRing = Math.max(2, Math.floor(count / rings));
  let i = 0;

  for (let k = 0; k < rings && i < count; k += 1) {
    randomDirection(rand, axis);
    const radius = GLOBE_RADIUS * (1.08 + rand() * 0.3);
    // 축에 수직인 기저 두 개
    const helper: [number, number, number] =
      Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = axis[1] * helper[2] - axis[2] * helper[1];
    let uy = axis[2] * helper[0] - axis[0] * helper[2];
    let uz = axis[0] * helper[1] - axis[1] * helper[0];
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = axis[1] * uz - axis[2] * uy;
    const vy = axis[2] * ux - axis[0] * uz;
    const vz = axis[0] * uy - axis[1] * ux;

    for (let j = 0; j < perRing && i < count; j += 1) {
      /* 균등 간격 + 흔들기. 완전 균등이면 점선이 기계적으로 보인다 */
      const a = ((j + rand() * 0.6) / perRing) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rr = radius * (1 + (rand() - 0.5) * 0.02);
      positions[i * 3] = (ux * c + vx * s) * rr;
      positions[i * 3 + 1] = (uy * c + vy * s) * rr;
      positions[i * 3 + 2] = (uz * c + vz * s) * rr;
      scales[i] = 0.3 + rand() * 0.5;
      i += 1;
    }
  }
  return { positions, scales };
}
