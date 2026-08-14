/**
 * GSAP 단일 진입점.
 *
 * shin 에서는 `gsap.registerPlugin(ScrollTrigger, useGSAP)` 이 70개 파일에
 * 중복돼 있었다. 멱등이라 동작은 하지만, 플러그인을 추가/교체할 때
 * 70곳을 고쳐야 한다. 여기서 한 번만 등록하고 재-export 한다.
 *
 * 사용:
 *   import { gsap, ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// 모듈 평가 시 1회. SSR 에서도 안전(ScrollTrigger 는 window 접근을 지연시킨다).
gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

/**
 * 스크롤 인 등장 모션 공통 파라미터.
 * 섹션마다 duration/ease 를 따로 쓰면 페이지 전체 리듬이 깨진다.
 */
export const SCROLL_ENTRANCE = {
  start: "top 82%",
  y: 42,
  scale: 0.985,
  duration: 1.05,
  ease: "power3.out",
  stagger: 0.1,
} as const;

/**
 * reduced-motion 일 때의 "즉시 최종 상태" 헬퍼.
 *
 * 주의: 단순 early-return 은 위험하다. GSAP 이 미리 걸어둔
 * `autoAlpha: 0` 이 남아 콘텐츠가 영영 안 보이는 사고가 난다.
 * 반드시 최종 상태로 set + clearProps 까지 해줄 것.
 */
export function settleReducedMotion(targets: gsap.TweenTarget) {
  gsap.set(targets, {
    autoAlpha: 1,
    x: 0,
    y: 0,
    scale: 1,
    clearProps: "opacity,visibility,transform,filter",
  });
}
