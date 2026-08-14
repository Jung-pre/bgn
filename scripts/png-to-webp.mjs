#!/usr/bin/env node
/**
 * public/ 하위 PNG/JPG 를 WebP 로 일괄 변환한다.
 *
 * next/image 가 런타임에 AVIF/WebP 협상을 해주긴 하지만,
 *  - 3D 텍스처처럼 next/image 를 안 거치는 자산
 *  - 배포 이미지 자체의 용량
 * 때문에 원본을 미리 줄여두는 편이 낫다.
 *
 * 사용: node scripts/png-to-webp.mjs [디렉터리] [--quality 88]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "public");
const qIdx = args.indexOf("--quality");
const quality = qIdx >= 0 ? Number(args[qIdx + 1]) : 88;

if (!fs.existsSync(dir)) {
  console.error(`디렉터리 없음: ${dir}`);
  process.exit(1);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : /\.(png|jpe?g)$/i.test(p) ? [p] : [];
  });

const files = walk(dir);
if (files.length === 0) {
  console.log("변환할 파일이 없습니다.");
  process.exit(0);
}

let before = 0;
let after = 0;

for (const src of files) {
  const out = src.replace(/\.(png|jpe?g)$/i, ".webp");
  if (fs.existsSync(out)) {
    console.log(`skip  ${path.relative(dir, out)} (이미 존재)`);
    continue;
  }
  await sharp(src).webp({ quality, effort: 4 }).toFile(out);
  const a = fs.statSync(src).size;
  const b = fs.statSync(out).size;
  before += a;
  after += b;
  console.log(
    `ok    ${path.relative(dir, out)}  ${(a / 1024).toFixed(0)}kB → ${(b / 1024).toFixed(0)}kB  (-${(100 - (b / a) * 100).toFixed(0)}%)`,
  );
}

if (before > 0) {
  console.log(
    `\n합계 ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB  (-${(100 - (after / before) * 100).toFixed(0)}%)`,
  );
  console.log("원본 PNG 는 확인 후 직접 삭제하세요 (덮어쓰지 않습니다).");
}
