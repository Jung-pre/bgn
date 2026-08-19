"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap, ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync, useIsMobileLayout } from "@/shared/lib/use-media-query";
import { VideoSlot } from "@/components/video-slot/video-slot";
import type { BlogPostMessages, BlogSectionMessages } from "@/shared/i18n/messages";
import styles from "./web-blog-section.module.css";

/**
 * Web blog — 진입 fade in-out → pinned 가로 스크롤 트랙.
 * 시안 `2:2399` ~ `2:2739` (5프레임이 전부 이 한 섹션).
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
 * ## 트랙 구성 — 시안 실측
 * 타일과 카드는 **각 960px(= 화면 절반)** 이고 이렇게 이어진다.
 *   타일 → 브랜드 컷(2:2457) → 타일 → 글1 → 타일 → 글2 → 타일 → 글3
 * 타일 칸에는 배경을 칠하지 않는다. 시안에서 이 칸은 **배경 영상이 그대로
 * 비치는 창**이라 트랙이 밀릴 때마다 영상의 다른 부분이 보인다.
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

/** pin 구간 중 인트로(타이틀 fade out)가 가져가는 비율 */
const INTRO_RATIO = 0.22;

/** 한 페이지에 이 섹션은 하나뿐이다. useId 의 특수문자를 url(#…) 에 넣지 않는다 */
const MASK_ID = "web-blog-letter-hole";

/**
 * 인라인 SVG 좌표계 = 시안 프레임 실측.
 *
 * ⚠️ PC 값을 모바일에서 그대로 쓰면 안 된다. 덮개는 `preserveAspectRatio="slice"`
 * (= background-size: cover)라 375×812 화면에서는 세로에 맞춰 확대되고,
 * 그 배율이면 1920 폭이 1016px 로 그려져 **글자가 좌우로 잘려 나간다.**
 * (실제로 모바일에서 "BGN Web blog" 의 양 끝이 화면 밖으로 나가 있었다)
 *
 * 그래서 뷰포트별로 좌표계를 갈아 끼운다. 모바일 시안(`8:4891`)은
 * 375×812 풀스크린에 **2줄**로 앉는다.
 */
const VIEWBOX = {
  pc: { w: 1920, h: 920 },
  mo: { w: 375, h: 812 },
} as const;

/** 카드 하단 대형 워터마크. 시안 문구는 섹션 타이틀과 다르다(2:2457) */
const WATERMARK = "BGN AI Web blog";

/**
 * 브랜드 컷(2:2457)의 사진. 게시글이 아니라 고정 배너라 messages 에 없다.
 * 시안은 이 자리에 수술 현미경 컷(post-1)을 쓰는데, 그건 messages.posts[0] 이
 * 이미 쓰고 있어 바로 옆 카드와 같은 사진이 두 번 나온다.
 * → 시안에서 마지막 카드에 쓰인 접수 사인 컷(post-4)으로 돌린다.
 */
const BRAND_IMAGE = "/main/blog/post-4.webp";

/**
 * 썸네일 폭 = `.thumb` 40rem. root font-size 가 뷰포트 비례(1920→16px)라
 * 데스크톱 전 구간에서 실측이 33vw 로 떨어진다. 모바일은 카드 폭 100%.
 */
const THUMB_SIZES = "(max-width: 768px) 92vw, 33vw";

/** 태그 색 팔레트 개수(`.tone0`~`.tone3`) */
const TONE_COUNT = 4;

type TrackItem =
  | { kind: "tile"; key: string; symbol: number }
  | { kind: "brand"; key: string }
  | { kind: "post"; key: string; post: BlogPostMessages };

export function WebBlogSection({ messages }: WebBlogSectionProps) {
  const isMobile = useIsMobileLayout();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      const stage = stageRef.current;
      if (!section || !track || !stage) return;

      if (isMobile) {
        /*
          ⚠️ 이 분기는 "아무것도 안 함"이 아니라 **치우는 일**을 해야 한다.

          `useIsMobileLayout` 은 `useSyncExternalStore` 라 하이드레이션 첫 렌더에서
          **서버 스냅샷(=false, 데스크톱)** 을 쓴다. 실제 로그로 확인한 실행 순서:

              effect(isMobile=false) → cleanup → effect(isMobile=false) → effect(isMobile=true)
                                                                          ↑ cleanup 이 없다

          즉 모바일 기기에서도 데스크톱 분기가 먼저 돌고, 그 ScrollTrigger 가
          **정리되지 않은 채 살아남는다.** 살아 있는 scrub 트리거는 스크롤·refresh 마다
          덮개에 `autoAlpha: 0 / scale: 1.14`(fromTo 의 from 값)를 다시 써 넣기 때문에,
          여기서 `gsap.set(clearProps)` 로 지워 봐야 곧바로 되돌아온다.
          (모바일에서 타이틀 덮개가 `visibility: hidden` 으로 굳어 있던 원인)

          그래서 **이 섹션에 걸린 ScrollTrigger 를 직접 찾아 revert 시킨다.**
          `kill(true)` 의 revert 가 pin-spacer 까지 DOM 에서 걷어낸다.
          그 뒤 남은 인라인 스타일은 `removeAttribute` 로 확실히 턴다 —
          GSAP 경유로 지우면 다음 refresh 에 또 덮어써진다.
        */
        for (const st of ScrollTrigger.getAll()) {
          const trigger = st.trigger;
          if (trigger instanceof Node && section.contains(trigger)) st.kill(true);
        }
        stage.removeAttribute("style");
        track.removeAttribute("style");
        return;
      }

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

      /* 주석 원문이 "fade in-**out**" 이고, 시안 2:2457 이후 프레임에는 이 글자가
         전혀 남아 있지 않다. 예전 구현처럼 0.4 로 남겨 두면 가로 트랙 위에
         시안에 없는 덮개가 계속 깔린다 → 완전히 걷어낸다. */
      tl.to(stage, { autoAlpha: 0, scale: 0.9, ease: "none", duration: INTRO_RATIO }, 0)
        /* 시안 2:2399 는 **화면 전체가 배경 영상 + 타이틀뿐**이다. 트랙을 x=0 에
           두면 인트로 내내 오른쪽 절반이 흰 카드로 덮여 시안과 달라진다.
           → 트랙은 화면 밖(오른쪽)에서 대기하다가 타이틀이 사라지는 동안 들어온다. */
        .fromTo(
          track,
          { x: () => window.innerWidth },
          { x: 0, ease: "none", duration: INTRO_RATIO },
          0,
        )
        .to(track, { x: () => -distance(), ease: "none", duration: 1 - INTRO_RATIO }, INTRO_RATIO);

      return () => {
        /* `kill()` 이 아니라 `revert()` 다.
           kill 은 트윈을 멈추기만 하고 **마지막에 적용된 인라인 스타일을 남긴다.**
           scrub 트윈은 진행도 0 에서 from 값(autoAlpha 0)이 박혀 있으므로,
           kill 로 끝내면 요소가 안 보이는 채로 굳는다. revert 는 원래 상태로 되돌린다.
           ScrollTrigger 도 `kill(true)` 로 revert 해야 pin-spacer 가 DOM 에서 빠진다. */
        fadeIn.scrollTrigger?.kill(true);
        fadeIn.revert();
        tl.scrollTrigger?.kill(true);
        tl.revert();
      };
    },
    { scope: sectionRef, dependencies: [isMobile, messages.posts.length] },
  );

  const posts = messages.posts.slice(0, MAX_POSTS);

  /*
    시안은 카테고리마다 태그 색이 다른데(블루·핑크·올리브·민트) messages 에는
    색 정보가 없다. **처음 나온 순서**로 팔레트를 배정하면 시안 2:2550/2:2739 의
    색 순서와 그대로 맞고, 같은 태그는 항상 같은 색이 된다.
    (`Math.random()` 금지 — React Compiler 가 불순 함수로 잡는다)
  */
  const tagTone = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tagTone.has(tag)) tagTone.set(tag, tagTone.size % TONE_COUNT);
    }
  }

  /* 시안 순서: 타일 → 브랜드 컷 → (타일 → 글) × 3 */
  const items: TrackItem[] = [
    { kind: "tile", key: "tile-0", symbol: 0 },
    { kind: "brand", key: "brand" },
    ...posts.flatMap((post, i): TrackItem[] => [
      { kind: "tile", key: `tile-${i + 1}`, symbol: (i + 1) % SYMBOLS.length },
      { kind: "post", key: post.href, post },
    ]),
  ];

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="blog-title">
      {/* ① Figma 8:2268 — 배경 영상. 영상 도착 전에는 poster 가 화면을 채운다.
          **원본 컷(bg.webp)** 을 쓴다. 시안의 배경은 이 컷에 ②의 blur 75 가 먹은
          모습이라, 이미 블러된 `video-poster.webp` 를 넣으면 두 번 흐려지면서
          시안보다 밝고 밋밋해진다(왼쪽 금빛 덩어리가 사라진다). */}
      <VideoSlot
        decorative
        className={styles.bgVideo}
        poster="/main/blog/bg.webp"
        rootMargin="400px 0px"
      />
      {/* ② Figma 2:2401 — 색상블러. blur 75 + 블루 0.2 오버레이 */}
      <div className={styles.colorBlur} aria-hidden />

      {/* ③ Figma 2:2571 / 8:4891 — 글자 모양으로 뚫린 덮개. 구멍 사이로 ①②가 비친다 */}
      <div ref={stageRef} className={styles.maskStage} aria-hidden>
        <MaskPlate title={messages.title} mobile={isMobile} />
      </div>

      {/* 마스크는 장식이므로 제목 텍스트는 반드시 여기로 노출한다 */}
      <h2 id="blog-title" className="sr-only" lang="en">
        {messages.title}
      </h2>

      {/* ④ 가로 트랙 — GSAP 이 x 를 트윈한다 */}
      <div ref={trackRef} className={styles.track}>
        {items.map((item) => {
          if (item.kind === "tile") {
            return (
              <div key={item.key} className={styles.tile} aria-hidden>
                <span className={styles.tileTop} lang="en">
                  BGN
                </span>
                {/* 장식은 인덱스로 지정된 도형. 랜덤 금지 — 시안에서 순서가 정해져 있다 */}
                <span className={styles.tileSymbol}>{SYMBOLS[item.symbol]}</span>
                <span className={styles.tileBrand} lang="en">
                  Eye Clinic Jamsil
                </span>
              </div>
            );
          }

          if (item.kind === "brand") {
            /* 시안 2:2457 — 태그도 제목도 없는 브랜드 컷 */
            return (
              <div key={item.key} className={`${styles.card} ${styles.brandCard}`} aria-hidden>
                <Image
                  src={BRAND_IMAGE}
                  alt=""
                  width={640}
                  height={400}
                  className={styles.thumb}
                  sizes={THUMB_SIZES}
                />
                <p className={styles.watermark} lang="en">
                  {WATERMARK}
                </p>
              </div>
            );
          }

          return (
            <article key={item.key} className={styles.card}>
              <Link href={item.post.href} className={styles.cardLink}>
                {/* 제목이 바로 아래 h3 로 나오므로 썸네일은 장식으로 넘긴다 */}
                <Image
                  src={item.post.image}
                  alt=""
                  aria-hidden
                  width={640}
                  height={400}
                  className={styles.thumb}
                  sizes={THUMB_SIZES}
                />
                <ul className={styles.tags}>
                  {item.post.tags.map((t) => (
                    <li key={t} className={`${styles.tag} ${styles[`tone${tagTone.get(t) ?? 0}`]}`}>
                      {t}
                    </li>
                  ))}
                </ul>
                <h3 className={styles.cardTitle}>{item.post.title}</h3>
              </Link>
              <p className={styles.watermark} lang="en" aria-hidden>
                {WATERMARK}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* --- 타일 장식 4종 -------------------------------------------------------------
   시안 2:2457 / 2:2550 / 2:2634 / 2:2739 순서. 전부 가는 흰 선의 아웃라인이다.
   회전 각도는 상수 배열로 미리 계산한다(렌더마다 같은 값이어야 한다). */
const BURST_RAYS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i * Math.PI) / 8;
  const inner = i % 2 === 0 ? 6 : 10;
  const outer = i % 2 === 0 ? 48 : 34;
  return {
    x1: 50 + Math.cos(angle) * inner,
    y1: 50 + Math.sin(angle) * inner,
    x2: 50 + Math.cos(angle) * outer,
    y2: 50 + Math.sin(angle) * outer,
  };
});

const PETALS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i * Math.PI) / 3;
  return { cx: 50 + Math.cos(angle) * 17, cy: 50 + Math.sin(angle) * 17 };
});

/**
 * 글자 구멍이 뚫린 덮개판.
 *
 * PC 는 한 줄, 모바일은 **2줄**이다 — 시안이 그렇게 나뉘어 있고(`8:4891`),
 * 375 폭에 "BGN Web blog" 를 한 줄로 넣으면 글자가 읽을 수 없을 만큼 작아진다.
 * 줄 나눔은 첫 어절(BGN) 기준 — 사전 문구가 바뀌어도 규칙이 유지된다.
 */
function MaskPlate({ title, mobile }: { title: string; mobile: boolean }) {
  const vb = mobile ? VIEWBOX.mo : VIEWBOX.pc;
  const [head = title, ...rest] = title.split(" ");
  const lines = mobile && rest.length > 0 ? [head, rest.join(" ")] : [title];
  const cx = vb.w / 2;
  /* 여러 줄일 때 블록 전체를 세로 중앙에 두려면 첫 줄을 (n-1)/2 만큼 끌어올려야 한다.
     70 = 모바일 글자 56px(뷰박스 단위) × 행간 1.25 */
  const lineH = mobile ? 70 : 0;
  const top = vb.h / 2 + (mobile ? 12 : 40) - ((lines.length - 1) * lineH) / 2;

  const rows = (extra?: string) =>
    lines.map((line, i) => (
      <text
        key={line}
        className={extra ? `${styles.maskText} ${extra}` : styles.maskText}
        x={cx}
        y={top + i * lineH}
        textAnchor="middle"
        {...(extra ? {} : { fill: "#000" })}
      >
        {line}
      </text>
    ));

  return (
    <svg
      className={styles.maskSvg}
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      /* slice = background-size:cover. 덮개가 항상 화면을 다 덮는다 */
      preserveAspectRatio="xMidYMid slice"
      focusable="false"
    >
      <defs>
        <mask id={MASK_ID} maskUnits="userSpaceOnUse" x="0" y="0" width={vb.w} height={vb.h}>
          {/* 흰색 = 덮개가 남는 영역 / 검은색 = 뚫리는 영역(글자) */}
          <rect x="0" y="0" width={vb.w} height={vb.h} fill="#fff" />
          {rows()}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width={vb.w}
        height={vb.h}
        className={styles.maskPlate}
        mask={`url(#${MASK_ID})`}
      />
      {/*
        시안 2:2399 의 글자는 **밝은 흰색**이다. 구멍만 뚫어 두면 배경이 어두운
        구간에서 글자가 거의 안 보인다. 같은 좌표에 옅은 흰 글자를 한 장 더 얹어
        밝기를 확보한다 — 반투명이라 구멍 아래 영상의 움직임은 그대로 비친다.
      */}
      {rows(styles.maskShine)}
    </svg>
  );
}

const SYMBOLS = [
  // ① 가는 빛살 별 (2:2457)
  <svg key="burst" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.9">
    {BURST_RAYS.map((r) => (
      <line key={`${r.x1}-${r.y1}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
    ))}
  </svg>,
  // ② 겹친 꽃잎 (2:2550)
  <svg key="flower" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.9">
    {PETALS.map((p) => (
      <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r="20" />
    ))}
  </svg>,
  // ③ 4각 스파클 (2:2634)
  <svg key="sparkle" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.9">
    <path d="M50 2C52 32 68 48 98 50C68 52 52 68 50 98C48 68 32 52 2 50C32 48 48 32 50 2Z" />
    <path d="M20 20 80 80M80 20 20 80" strokeWidth="0.6" />
  </svg>,
  // ④ 생명의 꽃 (2:2739)
  <svg key="seed" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.9">
    <circle cx="50" cy="50" r="20" />
    {PETALS.map((p) => (
      <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r="20" />
    ))}
  </svg>,
];
