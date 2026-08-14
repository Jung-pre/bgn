"use client";

import { useRef } from "react";
import Link from "next/link";
import clsx from "clsx";
import { gsap, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync, useIsMobileLayout } from "@/shared/lib/use-media-query";
import { VideoSlot } from "@/components/video-slot/video-slot";
import type { BlogPostMessages, BlogSectionMessages } from "@/shared/i18n/messages";
import styles from "./web-blog-section.module.css";

/**
 * Web blog — 진입 fade in-out → pinned 가로 스크롤 트랙.
 * 시안 p1_16 ~ p1_20 (5프레임이 전부 이 한 섹션).
 *
 * ## Figma 주석 원문 (`docs/plan/07-interactions.md`)
 *   2:2401  `해당 영역 진입시 fade in-out 후 하단 고정 가로 스크롤 영역으로 진입`
 *   2:2401  `영상에 색상블러 넣어두었습니다`
 *   2:2571  `배경 요소에 마스크(뚫려있는)된 글자로 영상의 움직임이 글자 사이로 보이도록함`
 *   2:2561  `최신 블로그 게시글이 3개 연결되어 보여짐`
 *
 * ## 레이어 순서 (아래 → 위)
 *   ① `.bgVideo`    2:2400 — 원본 영상
 *   ② `.colorBlur`  2:2401 — backdrop-blur 75px + rgba(0,114,236,0.2) "색상블러"
 *   ③ `.maskStage`  2:2571 — **글자 모양으로 뚫린 덮개판**
 *   ④ `.track`               다크 타일 ↔ 화이트 카드 교차
 *
 * ## 왜 `background-clip: text` 가 아니라 마스크인가
 * `background-clip: text` 는 "글자 **안쪽에** 배경을 칠하는" 기능이다.
 * 그러려면 영상이 그 텍스트 요소의 background 여야 하는데 배경은 `<video>`
 * 엘리먼트라 불가능하고, 무엇보다 **나머지 영역을 덮지 못한다** — 주석이 말하는
 * "뚫려있는" 의 정반대다. 필요한 건 *덮개에 구멍*이므로 마스크가 맞다.
 *
 * 마스크 방식 중에서도 CSS `mask-image: url("data:image/svg+xml,…")` 은 쓰지
 * 않는다. CSS 로 불러온 SVG 는 **문서의 웹폰트(Belleza)에 접근하지 못해**
 * 글자꼴이 폴백 세리프로 바뀐다. 그래서 문서 안에 인라인 `<svg><mask>` 를 두고
 * 흰 사각형(=보임) 위에 검은 글자(=구멍)를 얹어 덮개 rect 를 뚫는다.
 * 인라인 SVG 의 `<text>` 는 페이지 폰트를 그대로 쓴다.
 * 접근성: 이 SVG 는 순수 장식이라 `aria-hidden`, 실제 제목은 `.sr-only` h2 로 낸다.
 *
 * ## 스크롤 구간 분배
 * pin 한 개가 [인트로 fade out] + [가로 이동] 을 모두 소비한다.
 * 두 구간의 **비율**을 상수로 고정하고 end 를 `distance / (1 - INTRO_RATIO)`
 * 로 유도하면, 리사이즈로 트랙 폭이 바뀌어도 `invalidateOnRefresh` 가
 * 재계산해 끝점이 항상 맞는다. (fade **in** 은 pin 이전 구간이라 별도 트리거)
 *
 * ## 모바일은 가로 스크롤을 쓰지 않는다
 * 시안 p4_14~19 는 **카드 1장 = 1화면 세로 스택**이다. pin 을 걸지 않는다.
 */
export interface WebBlogSectionProps {
  messages: BlogSectionMessages;
}

/** 주석 `2:2561` — 최신 3건만 노출한다 */
const MAX_POSTS = 3;

/** 다크 타일 심볼 종류 수. 랜덤이 아니라 인덱스로 고정 배정한다 */
const SYMBOL_COUNT = 4;

/** pin 구간 중 인트로(타이틀 fade out)가 가져가는 비율 */
const INTRO_RATIO = 0.22;

/** 인트로가 끝난 뒤 남기는 덮개 농도 — 가로 트랙의 배경 요소로 계속 존재한다 */
const STAGE_BG_ALPHA = 0.4;

/** 한 페이지에 이 섹션은 하나뿐이다. useId 의 특수문자를 url(#…) 에 넣지 않는다 */
const MASK_ID = "web-blog-letter-hole";

/** 인라인 SVG 좌표계. slice 로 덮으므로 글자는 가운데 안전영역에만 둔다 */
const VB_W = 1200;
const VB_H = 900;

type TrackItem =
  | { kind: "tile"; key: string; symbol: number }
  | { kind: "post"; key: string; post: BlogPostMessages };

export function WebBlogSection({ messages }: WebBlogSectionProps) {
  const isMobile = useIsMobileLayout();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (isMobile) return;
      const section = sectionRef.current;
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!section || !track || !stage) return;

      if (prefersReducedMotionSync()) {
        /* 동작 줄이기: pin·가로이동을 걸지 않고 **직접 가로 스크롤되는 트랙**으로
           둔다. early-return 이 아니라 최종 상태를 확정하는 것이 중요하다 —
           아래 fromTo 의 시작값(autoAlpha 0)이 남으면 덮개가 사라져 버린다. */
        gsap.set(stage, { autoAlpha: 1, clearProps: "transform" });
        track.style.overflowX = "auto";
        /* ★ 여기서만 data-lenis-prevent 를 단다.
           이 트랙이 "내부 가로 스크롤 영역"이 되는 건 이 분기뿐이다.
           평상시엔 GSAP 이 transform 으로 밀 뿐 스크롤 컨테이너가 아니고,
           그때 prevent 를 달면 Lenis 가 트랙 위 wheel 을 통째로 넘겨버려
           pin 구간 전체가 네이티브 스크롤로 튄다. */
        track.setAttribute("data-lenis-prevent", "");
        return;
      }

      /** 트랙이 실제로 밀려야 하는 거리(px). 뷰포트에 비례하지 않는다 */
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      /** 인트로 비율만큼 스크롤 예산을 더 준다 */
      const total = () => Math.max(1, distance() / (1 - INTRO_RATIO));

      // ── 진입 fade in — pin 이 시작되기 전 구간에서 처리한다 ────────────
      const fadeIn = gsap.fromTo(
        stage,
        { autoAlpha: 0, scale: 1.14 },
        {
          autoAlpha: 1,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "top top",
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );

      // ── pin: 앞 INTRO_RATIO 는 fade out, 나머지는 가로 이동 ────────────
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          // 함수형 end — refresh 마다 트랙 실측을 다시 한다
          end: () => `+=${total()}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });

      tl.to(
        stage,
        { autoAlpha: STAGE_BG_ALPHA, scale: 0.9, ease: "none", duration: INTRO_RATIO },
        0,
      ).to(track, { x: () => -distance(), ease: "none", duration: 1 - INTRO_RATIO }, INTRO_RATIO);

      return () => {
        fadeIn.scrollTrigger?.kill();
        fadeIn.kill();
        /* `kill(true)` — revert 를 안 하면 pin-spacer 가 DOM 에 남는다.
           이 훅은 isMobile 이 하이드레이션 직후 뒤집힐 때 다시 도는데,
           그때마다 스페이서가 쌓여 아래 섹션이 한 화면씩 밀린다. */
        tl.scrollTrigger?.kill(true);
        tl.kill();
      };
    },
    { scope: sectionRef, dependencies: [isMobile, messages.posts.length] },
  );

  const posts = messages.posts.slice(0, MAX_POSTS);

  /** 카드 사이에 브랜드 타일을 끼우고, 마지막에도 타일로 닫는다(심볼 4종 전부 노출) */
  const items: TrackItem[] = [
    ...posts.flatMap((post, i): TrackItem[] => [
      { kind: "tile", key: `tile-${i}`, symbol: i % SYMBOL_COUNT },
      { kind: "post", key: post.href, post },
    ]),
    { kind: "tile", key: `tile-${posts.length}`, symbol: posts.length % SYMBOL_COUNT },
  ];

  /** "BGN Web blog" → ["BGN", "Web blog"] 2줄. 폭이 좁아도 잘리지 않는다 */
  const [firstWord = messages.title, ...restWords] = messages.title.split(" ");
  const lines = restWords.length > 0 ? [firstWord, restWords.join(" ")] : [firstWord];

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="blog-title">
      {/* ① Figma 2:2400 — 배경 영상 */}
      <VideoSlot decorative className={styles.bgVideo} rootMargin="400px 0px" />
      {/* ② Figma 2:2401 — 색상블러. blur 75 + 블루 0.2 오버레이 */}
      <div className={styles.colorBlur} aria-hidden />

      {/* ③ Figma 2:2571 — 글자 모양으로 뚫린 덮개. 구멍 사이로 ①②가 비친다 */}
      <div ref={stageRef} className={styles.maskStage} aria-hidden>
        <svg
          className={styles.maskSvg}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          /* slice = background-size:cover. 덮개가 항상 화면을 다 덮는다 */
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
        >
          <defs>
            <mask id={MASK_ID} maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
              {/* 흰색 = 덮개가 남는 영역 */}
              <rect x="0" y="0" width={VB_W} height={VB_H} fill="#fff" />
              {/* 검은색 = 뚫리는 영역(글자) */}
              {lines.map((line, i) => (
                <text
                  key={line}
                  className={styles.maskText}
                  x={VB_W / 2}
                  y={VB_H / 2 - 60 + i * 150}
                  textAnchor="middle"
                  fill="#000"
                >
                  {line}
                </text>
              ))}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width={VB_W}
            height={VB_H}
            className={styles.maskPlate}
            mask={`url(#${MASK_ID})`}
          />
        </svg>
      </div>

      {/* 마스크는 장식이므로 제목 텍스트는 반드시 여기로 노출한다 */}
      <h2 id="blog-title" className="sr-only" lang="en">
        {messages.title}
      </h2>

      {/* ④ 가로 트랙 — GSAP 이 x 를 트윈한다 */}
      <div ref={trackRef} className={styles.track}>
        {items.map((item) =>
          item.kind === "tile" ? (
            <div key={item.key} className={styles.tile} aria-hidden>
              <span className={styles.tileTop} lang="en">
                Eye Clinic Jamsil
              </span>
              {/* 심볼은 인덱스로 지정된 에셋. 랜덤 금지 — 시안에서 순서가 정해져 있다. */}
              <span className={clsx(styles.tileSymbol, styles[`symbol${item.symbol}`])} />
              <span className={styles.tileBrand} lang="en">
                BGN
              </span>
            </div>
          ) : (
            <article key={item.key} className={styles.card}>
              <Link href={item.post.href} className={styles.cardLink}>
                <div className={styles.thumb} aria-hidden />
                <ul className={styles.tags}>
                  {item.post.tags.map((t) => (
                    <li key={t} className={styles.tag}>
                      {t}
                    </li>
                  ))}
                </ul>
                <h3 className={styles.cardTitle}>{item.post.title}</h3>
              </Link>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
