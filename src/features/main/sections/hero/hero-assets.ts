/**
 * 히어로 에셋 경로.
 *
 * ⚠️ **three 를 절대 import 하지 않는다.** 이 모듈은 섹션 컴포넌트가 static import
 * 하므로, 여기서 three 를 건드리면 3D 청크가 초기 로드로 새어 나온다.
 * (`npm run analyze:chunk` 가 이걸 잡는다)
 *
 * 파일은 아직 없다. Figma 에서 아래 노드를 PNG 로 export 해서 넣을 것:
 *
 *   구체 (PC)      2:416  1920×920   → sphere-pc.png     (2배 권장)
 *   구체 (모바일)   2:3746  375×812   → sphere-mo.png
 *   타워           2:930  1405×1277  → tower.png
 *   구름 3세트      2:863 / 2:874 등            → cloud-1~3.png
 *   광선 라인       2:934 / 2:937 / 2:938 / 2:939 → line-1~4.png
 *   배경 텍스처     2:862  1920×1080  → texture.png   (mix-blend-soft-light, opacity 50)
 *
 * Figma MCP `download_assets` 로 URL 을 받아 로컬에서 curl 하면 된다.
 * (샌드박스에서는 figma.com 이 프록시에 막혀 직접 못 받는다)
 */
export const HERO_ASSETS = {
  spherePc: "/main/hero/sphere-pc.png",
  sphereMo: "/main/hero/sphere-mo.png",
  tower: "/main/hero/tower.png",
  texture: "/main/hero/texture.png",
  clouds: ["/main/hero/cloud-1.png", "/main/hero/cloud-2.png", "/main/hero/cloud-3.png"],
  lines: [
    "/main/hero/line-1.png",
    "/main/hero/line-2.png",
    "/main/hero/line-3.png",
    "/main/hero/line-4.png",
  ],
} as const;

/** 에셋이 아직 없으므로 기본은 false. 파일을 넣은 뒤 true 로 바꾼다. */
export const HERO_ASSETS_READY = false;
