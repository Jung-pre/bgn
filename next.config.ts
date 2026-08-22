import type { NextConfig } from "next";

/**
 * 로컬 포트는 **3100** (`package.json --port` + `.env PORT`).
 * Next 기본 3000 으로 되돌리지 말 것 — 다른 프로젝트와 충돌한다.
 */
const nextConfig: NextConfig = {
  /**
   * Docker 단독 실행용 standalone 번들.
   * Next 16.3 + Vercel 어댑터는 standalone 일 때 `.next/next-server.js.nft.json` 을
   * 안 만들고, onBuildComplete 가 그 파일을 찾아 ENOENT 로 죽는다.
   * Vercel 빌드(`VERCEL=1`)에서는 플랫폼 출력만 쓴다.
   */
  output: process.env.VERCEL ? undefined : "standalone",
  /** 개발 배지가 좌하단 레이아웃을 가려 디자인 검수를 방해해서 끔. */
  devIndicators: false,

  /**
   * 같은 LAN 의 실기기(모바일)에서 dev 서버에 붙을 때 HMR WebSocket 이 막히지 않게 함.
   * 실제 개발 PC IP 로 교체.
   */
  allowedDevOrigins: ["192.168.0.0/16"],

  experimental: {
    /**
     * 배럴 export 가 큰 패키지들. 이게 없으면 drei 하나만 import 해도
     * 초기 chunk 에 drei 전체가 딸려온다. `npm run analyze:chunk` 로 검증할 것.
     */
    optimizePackageImports: ["@react-three/drei", "motion", "gsap"],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    /** Next 16 부터 qualities 기본값이 [75] 로 제한 — 쓰는 값을 화이트리스트에 등록. */
    qualities: [50, 75, 85, 90, 95, 100],
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2560],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      // 백엔드 업로드 경로가 생기면 여기에 추가
      // { protocol: "https", hostname: "**", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
