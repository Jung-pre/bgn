#!/usr/bin/env node
/**
 * GLB 최적화 파이프라인: resize → webp → draco.
 *
 * ⚠️ shin 프로젝트의 함정: 이 스크립트로 draco 압축본을 만들어도
 * **런타임에 디코더 설정이 없으면 로드가 실패한다.** 산출물을 쓰려면
 * `public/draco/` 에 디코더를 두고 `useGLTF(url, "/draco/")` 로 불러야 한다.
 * (three 패키지의 examples/jsm/libs/draco/ 를 복사)
 *
 * 사용:
 *   node scripts/gltf-optimize.mjs public/main/model.glb
 *   GLTF_TEX_MAX=4096 GLTF_DRACO=0 node scripts/gltf-optimize.mjs input.glb output.glb
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TEX_MAX = process.env.GLTF_TEX_MAX ?? "2048";
const USE_DRACO = process.env.GLTF_DRACO !== "0";

const [input, explicitOutput] = process.argv.slice(2);
if (!input) {
  console.error("사용법: node scripts/gltf-optimize.mjs <input.glb> [output.glb]");
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`파일 없음: ${input}`);
  process.exit(1);
}

const dir = path.dirname(input);
const base = path.basename(input, path.extname(input));
const suffix = `_tex${TEX_MAX}_webp${USE_DRACO ? "_draco" : ""}`;
const output = explicitOutput ?? path.join(dir, `${base}${suffix}.glb`);

let cliJs;
try {
  cliJs = require.resolve("@gltf-transform/cli/bin/cli.js");
} catch {
  console.error("@gltf-transform/cli 가 설치돼 있지 않습니다. `npm i -D @gltf-transform/cli`");
  process.exit(1);
}

const tmpResize = path.join(dir, `.${base}.resize.tmp.glb`);
const tmpWebp = path.join(dir, `.${base}.webp.tmp.glb`);
const run = (...args) => execFileSync(process.execPath, [cliJs, ...args], { stdio: "inherit" });
const sizeOf = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(2);

try {
  console.log(`\n[1/3] 텍스처 리사이즈 → ${TEX_MAX}px`);
  run("resize", input, tmpResize, "--width", TEX_MAX, "--height", TEX_MAX);

  console.log("[2/3] 텍스처 WebP 변환");
  run("webp", tmpResize, tmpWebp);

  if (USE_DRACO) {
    console.log("[3/3] Draco 지오메트리 압축");
    run("draco", tmpWebp, output);
  } else {
    console.log("[3/3] Draco 생략 (GLTF_DRACO=0)");
    fs.copyFileSync(tmpWebp, output);
  }

  console.log(`\n✓ ${sizeOf(input)}MB → ${sizeOf(output)}MB`);
  console.log(`  ${output}`);
  if (USE_DRACO) {
    console.log('\n⚠️  런타임에 draco 디코더 설정 필요: useGLTF(url, "/draco/")');
  }
} finally {
  for (const t of [tmpResize, tmpWebp]) if (fs.existsSync(t)) fs.unlinkSync(t);
}
