/**
 * 대륙 마스크 굽기 — Natural Earth land 폴리곤 → equirectangular 1비트 비트맵.
 *
 * 왜 이걸 빌드 타임에 굽는가
 * -------------------------
 * 히어로 구체는 "지도 구체"다(Figma 2:416). 파티클을 육지 위치에만 밀집시키려면
 * 구면 좌표 → 육지 여부 판정이 필요한데,
 *
 *   ① 런타임에 GeoJSON 을 로드해 point-in-polygon 을 돌리면 → 파싱 수백 KB + 첫 프레임 지연
 *   ② PNG 마스크를 fetch 해서 canvas 로 읽으면   → 요청 1회 + 디코드 대기 (히어로는 above the fold)
 *
 * 둘 다 "로딩 화면 없이 진입"(Figma 주석) 과 싸운다. 그래서 **1비트 비트맵을
 * base64 문자열로 구워 3D 청크에 그대로 넣는다.** 추가 요청 0회, 디코드는 atob 한 번.
 *
 * world-atlas / topojson-client 는 devDependency 다 — 이 스크립트에서만 쓰고
 * 런타임 번들에는 들어가지 않는다.
 *
 * 직접 스캔라인을 도는 이유
 * -----------------------
 * equirectangular 투영은 lon/lat 의 **선형 사상**이라 별도 투영 라이브러리도,
 * node-canvas 도 필요 없다. d3-geo 의 geoContains 로 픽셀마다 판정하면
 * 524,288 회 호출이라 수십 초가 걸린다. 스캔라인은 1초 안에 끝난다.
 *
 * 구멍(호수)은 even-odd 규칙으로 자동 처리된다 — 한 폴리곤의 외곽 링과 내부 링을
 * 같은 교차점 목록에 넣고 짝수/홀수로 채우면 내부 링이 자연히 뚫린다.
 *
 * 사용: node scripts/build-land-mask.mjs
 * 출력: src/features/main/sections/hero/land-mask.generated.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { feature } from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/**
 * 마스크 해상도.
 * 구체는 화면에서 지름 ~450px, 보이는 반구는 경도 180° 뿐이다.
 * 1024 폭이면 반구가 512px → 화면 대비 약 1.1배로 충분하고,
 * 파티클이 2만 개라 그 이상 올려도 눈에 안 보인다.
 */
const W = 1024;
const H = 512;

/** 50m = 중축척. 110m 은 한반도가 뭉개지고 10m 은 파일이 8MB 라 굽는 시간만 늘어난다. */
const SOURCE = "world-atlas/land-50m.json";

const topo = JSON.parse(readFileSync(resolve(ROOT, "node_modules", SOURCE), "utf8"));
const land = feature(topo, topo.objects.land);

/** MultiPolygon / Polygon / FeatureCollection 을 전부 "링 배열의 배열" 로 평탄화 */
function collectPolygons(geo) {
  const out = [];
  const walk = (g) => {
    if (!g) return;
    switch (g.type) {
      case "FeatureCollection":
        g.features.forEach(walk);
        return;
      case "Feature":
        walk(g.geometry);
        return;
      case "GeometryCollection":
        g.geometries.forEach(walk);
        return;
      case "Polygon":
        out.push(g.coordinates);
        return;
      case "MultiPolygon":
        g.coordinates.forEach((p) => out.push(p));
        return;
      default:
        return;
    }
  };
  walk(geo);
  return out;
}

const polygons = collectPolygons(land);

/** 픽셀 격자. 1 = 육지 */
const grid = new Uint8Array(W * H);

/** 경도 → x 픽셀(연속값). lon -180 → 0, lon +180 → W */
const lonToX = (lon) => ((lon + 180) / 360) * W;
/** 위도 → y 픽셀(연속값). lat +90 → 0, lat -90 → H */
const latToY = (lat) => ((90 - lat) / 180) * H;

let filled = 0;

for (const rings of polygons) {
  // 이 폴리곤이 닿는 y 범위만 훑는다 (전 지구를 매번 도는 것보다 훨씬 빠르다)
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [, lat] of ring) {
      const y = latToY(lat);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));

  for (let py = y0; py <= y1; py += 1) {
    // 픽셀 중심에서 판정한다. 정수 경계에서 판정하면 꼭짓점이 정확히 걸릴 때
    // 교차가 두 번 세어져 한 줄이 통째로 반전된다.
    const scanY = py + 0.5;
    const xs = [];

    for (const ring of rings) {
      for (let i = 0, n = ring.length; i < n; i += 1) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        const ay = latToY(a[1]);
        const by = latToY(b[1]);
        // 반열린 구간 [min, max) — 공유 꼭짓점이 두 번 세어지는 것을 막는다
        if (ay === by) continue;
        if (scanY < Math.min(ay, by) || scanY >= Math.max(ay, by)) continue;
        const t = (scanY - ay) / (by - ay);
        const xa = lonToX(a[0]);
        xs.push(xa + t * (lonToX(b[0]) - xa));
      }
    }

    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);

    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.max(0, Math.ceil(xs[i] - 0.5));
      const xb = Math.min(W - 1, Math.floor(xs[i + 1] - 0.5));
      for (let px = xa; px <= xb; px += 1) {
        const idx = py * W + px;
        if (!grid[idx]) filled += 1;
        grid[idx] = 1;
      }
    }
  }
}

/** 1비트 패킹 — 8픽셀당 1바이트 */
const packed = new Uint8Array(Math.ceil((W * H) / 8));
for (let i = 0; i < W * H; i += 1) {
  if (grid[i]) packed[i >> 3] |= 1 << (i & 7);
}

const b64 = Buffer.from(packed).toString("base64");
const gz = gzipSync(Buffer.from(b64)).length;

const outPath = resolve(ROOT, "src/features/main/sections/hero/land-mask.generated.ts");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `// 자동 생성 파일 — 직접 고치지 말 것. \`node scripts/build-land-mask.mjs\` 로 다시 굽는다.
// 출처: ${SOURCE} (Natural Earth, public domain)
// ${W}×${H} 1비트 equirectangular 육지 마스크. 비트 순서는 LSB first, 행 우선.
// 행 0 = 북위 90°, 열 0 = 서경 180°.

export const LAND_MASK_WIDTH = ${W};
export const LAND_MASK_HEIGHT = ${H};

/** base64(1비트 패킹). 런타임에서 \`atob\` 한 번으로 푼다. */
export const LAND_MASK_BASE64 =
  "${b64}";
`,
  "utf8",
);

const pct = ((filled / (W * H)) * 100).toFixed(1);
console.log(
  `polygons=${polygons.length}  land=${pct}%  packed=${(packed.length / 1024).toFixed(1)}kB  base64=${(b64.length / 1024).toFixed(1)}kB  gzip≈${(gz / 1024).toFixed(1)}kB`,
);
console.log(`→ ${outPath}`);
