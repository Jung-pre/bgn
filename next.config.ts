import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Docker 단독 실행용 standalone 번들. 배포 방식이 다르면 지워도 됨. */
  output: "standalone",
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
