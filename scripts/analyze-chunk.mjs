#!/usr/bin/env node
/**
 * 무거운 3D/애니메이션 라이브러리가 **항상 로드되는 진입 청크로 샜는지** 검사한다.
 *
 * `useGLTF.preload()` 를 모듈 top-level 에 두거나, 3D 씬 모듈에서 상수 하나를
 * static import 하는 순간 three/drei 전체가 첫 로드에 딸려온다.
 * dynamic import 를 걸어놨다고 안심하지 말고 빌드마다 이걸로 확인할 것.
 *
 * 판정 기준은 `.next/build-manifest.json` 의 `rootMainFiles` —
 * 모든 라우트에서 무조건 받는 청크 목록이다. 여기에 three 가 있으면 실패.
 *
 * 사용: npm run build && npm run analyze:chunk
 */
import fs from "node:fs";
import path from "node:path";

const NEXT_DIR = path.join(process.cwd(), ".next");
const CHUNK_DIR = path.join(NEXT_DIR, "static", "chunks");
const MANIFEST = path.join(NEXT_DIR, "build-manifest.json");

/** 진입 청크에 있으면 안 되는 것들 */
const FORBIDDEN_IN_ENTRY = ["three", "@react-three/fiber", "@react-three/drei"];
/** 참고용으로만 세는 것들 */
const TRACKED = [...FORBIDDEN_IN_ENTRY, "gsap", "ScrollTrigger", "lenis", "motion"];
const TOP_N = 12;

if (!fs.existsSync(CHUNK_DIR) || !fs.existsSync(MANIFEST)) {
  console.error(`빌드 산출물이 없습니다. 먼저 \`npm run build\` 를 실행하세요.`);
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(1)}kB`;
const countMarkers = (src) =>
  TRACKED.map((m) => ({ m, n: src.split(m).length - 1 })).filter((x) => x.n > 0);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const entryFiles = (manifest.rootMainFiles ?? []).filter((f) => f.endsWith(".js"));

// ── 1. 진입 청크 검사 ────────────────────────────────────────────────────────
console.log("\n■ 진입 청크 (모든 라우트에서 무조건 로드)\n");
let entryBytes = 0;
const violations = [];

for (const rel of entryFiles) {
  const abs = path.join(NEXT_DIR, rel);
  if (!fs.existsSync(abs)) continue;
  const size = fs.statSync(abs).size;
  entryBytes += size;
  const src = fs.readFileSync(abs, "utf8");
  const hits = countMarkers(src);
  console.log(`${kb(size).padStart(9)}  ${rel}`);
  if (hits.length) console.log(`${" ".repeat(11)}↳ ${hits.map((h) => `${h.m}×${h.n}`).join("  ")}`);
  for (const h of hits) if (FORBIDDEN_IN_ENTRY.includes(h.m)) violations.push({ rel, ...h });
}
console.log(`\n  진입 청크 합계: ${kb(entryBytes)}`);

// ── 2. 전체 상위 청크 ────────────────────────────────────────────────────────
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });

const all = walk(CHUNK_DIR)
  .map((p) => ({ p, size: fs.statSync(p).size }))
  .sort((a, b) => b.size - a.size);

console.log(`\n■ 상위 ${Math.min(TOP_N, all.length)}개 청크 (전체 ${all.length}개)\n`);
for (const { p, size } of all.slice(0, TOP_N)) {
  const hits = countMarkers(fs.readFileSync(p, "utf8"));
  console.log(`${kb(size).padStart(9)}  ${path.relative(NEXT_DIR, p)}`);
  if (hits.length) console.log(`${" ".repeat(11)}↳ ${hits.map((h) => `${h.m}×${h.n}`).join("  ")}`);
}

// ── 3. 판정 ─────────────────────────────────────────────────────────────────
if (violations.length) {
  console.error("\n✖ 진입 청크에 3D 라이브러리가 포함됐습니다:");
  for (const v of violations) console.error(`   ${v.m} in ${v.rel}`);
  console.error(
    "\n   원인 1순위: 3D 씬 모듈을 static import 하는 곳이 있다.\n" +
      "   URL·숫자 상수는 three 를 import 하지 않는 별도 config 모듈로 분리하고,\n" +
      "   씬 자체는 next/dynamic(..., { ssr: false }) 로만 불러올 것.\n",
  );
  process.exit(1);
}

console.log("\n✓ 진입 청크에 three/drei 없음\n");
