"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ScrollHint } from "@/components/scroll-hint/scroll-hint";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import { usePrefersReducedMotion } from "@/shared/lib/use-media-query";
import type { AiStorySectionMessages } from "@/shared/i18n/messages";
import styles from "./ai-story-section.module.css";

/**
 * AI 브랜드 스토리(영상 탭) — Figma `8:1160` (구 `2:1286`) / Container `2:1938`.
 *
 * 세그먼트 탭 3개 + 대형 비디오 카드 1장(854×484).
 *
 * ## 유튜브 (기획 슬라이드 12)
 * 세 탭이 같은 클립(`1tH-JIn9oKI`)을 다른 시점부터 재생한다.
 *   0 밝은눈안과 AI 히스토리          0s
 *   1 AI 기반 맞춤형 진단 시스템     65s
 *   2 AI 기술 미래 전망             151s
 * 탭 클릭·재생 버튼이 재생을 연다. 첫 페인트에서 자동재생하지 않는다.
 *
 * ## 썸네일 = `/main/img_06_card01.webp` (854×484 — 카드와 1:1 동일 치수)
 * 시안의 카드는 **한 장의 영상 썸네일**이고 카피(아이브로우 + 2줄 타이틀)가
 * 이미지에 **구워져 있다**. 그래서 같은 문구를 DOM 텍스트로 또 얹으면 이중으로
 * 겹쳐 보인다 → 카피는 `<img alt>` 로만 전달한다. 이미지가 못 뜨면 alt 가
 * 그 자리에 그대로 노출되므로 정보 손실도 없다.
 *
 * ## 역할 분담 (CLAUDE.md "역할 경계")
 *   · GSAP(`useSectionReveal`) — 섹션 진입 등장. 대상은 **스테이지 래퍼**.
 *   · Motion(`AnimatePresence mode="wait"`) — 탭 인덱스가 바뀔 때의 카드 크로스페이드.
 *   · Motion(`layoutId`)        — 활성 탭 인디케이터 이동.
 * 등장(GSAP)과 교체(Motion)가 **같은 요소를 건드리지 않도록** 스테이지 래퍼와
 * 카드를 분리했다. 한 요소에 둘 다 걸면 GSAP 의 `clearProps` 가 Motion 이
 * 쓰고 있던 transform 을 지워 카드가 튄다.
 *
 * ## `mode="wait"` 인 이유
 * 카드가 화면에서 가장 큰 요소(860×484)라, 두 장이 겹쳐 있는 동안
 * 반투명 그라데이션 두 겹이 그대로 합성돼 색이 탁해진다. 나갈 카드를
 * 먼저 정리하고 들어오는 편이 깨끗하다.
 *
 * ## 모바일 탭 가로 스크롤
 * 시안에서 탭이 좌우로 잘린 채 노출된다(= 스크롤 가능 신호). 탭 스트립이 실제로
 * 가로 스크롤되는 건 ≤768 뿐이다.
 *
 * ⚠️ `data-lenis-prevent` 는 쓰지 않는다. 이 속성은 축을 가리지 않아서, 데스크톱처럼
 * 스크롤되지 않는 상태에서도 스트립 위의 **세로** 휠까지 네이티브로 넘겨 버린다.
 * 내부 스크롤 판별은 Lenis 의 `allowNestedScroll` 에 맡긴다
 * (`smooth-scroll-provider.tsx` 의 "## 내부 스크롤 영역" 참고).
 */
export interface AiStorySectionProps {
  messages: AiStorySectionMessages;
}

/** 기획 슬라이드 12. 번역 대상이 아니라 섹션 상수로 둔다. */
const YOUTUBE_ID = "1tH-JIn9oKI";
const TAB_STARTS = [0, 65, 151] as const;

function youtubeSrc(start: number) {
  const params = new URLSearchParams({
    autoplay: "1",
    start: String(start),
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1",
    origin: window.location.origin,
  });
  return `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?${params}`;
}

function pauseYoutube(frame: HTMLIFrameElement) {
  frame.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
    "https://www.youtube-nocookie.com",
  );
}

export function AiStorySection({ messages }: AiStorySectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const tabStripRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  // 시안 기본 활성은 2번째 탭
  const [activeTab, setActiveTab] = useState(1);
  const [playing, setPlaying] = useState(false);
  /** 같은 탭을 다시 눌러도 iframe 을 다시 심어 그 시점부터 재생한다. */
  const [playKey, setPlayKey] = useState(0);

  /**
   * 탭 전환. 같은 값이면 인덱스는 유지하되, 클릭이면 그 시점부터 다시 재생한다.
   */
  const selectTab = useCallback(
    (next: number, moveFocus: boolean) => {
      setActiveTab((prev) => (prev === next ? prev : next));
      setPlaying(true);
      setPlayKey((key) => key + 1);

      const strip = tabStripRef.current;
      const button = strip?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
      if (!strip || !button) return;

      // `scrollIntoView` 는 조상까지 스크롤해서 페이지가 통째로 튄다.
      // 탭 스트립의 scrollLeft 만 직접 옮긴다.
      strip.scrollTo({
        left: button.offsetLeft - (strip.clientWidth - button.clientWidth) / 2,
        behavior: reduceMotion ? "auto" : "smooth",
      });
      if (moveFocus) button.focus({ preventScroll: true });
    },
    [reduceMotion],
  );

  /**
   * 마운트 시 활성 탭을 스트립 가운데로 보낸다.
   *
   * 모바일 시안 `2:4009` 는 탭 줄이 화면보다 넓고 **활성 알약이 화면 중앙**
   * (x97~291, 중심 194 ≒ 375/2)에 오도록 좌우가 잘려 있다. `selectTab` 안에만
   * 센터링이 있어서 사용자가 탭을 누르기 전까지는 1번 탭부터 왼쪽 정렬로 보였다.
   * `behavior: auto` 로 첫 페인트에 바로 자리를 잡는다.
   */
  useEffect(() => {
    const strip = tabStripRef.current;
    const button = strip?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[activeTab];
    if (!strip || !button) return;
    if (strip.scrollWidth <= strip.clientWidth + 1) return;
    strip.scrollLeft = button.offsetLeft - (strip.clientWidth - button.clientWidth) / 2;
  }, [activeTab]);

  // 화면 밖으로 나가면 소리를 끊는다. 돌아오면 YouTube 컨트롤로 이어 보면 된다.
  useEffect(() => {
    if (!playing) return;
    const frame = playerRef.current;
    if (!frame || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry || entry.isIntersecting) return;
        pauseYoutube(frame);
      },
      { threshold: 0.15 },
    );
    io.observe(frame);
    return () => io.disconnect();
    /* ⚠️ `playKey` 가 있어야 한다. iframe 의 React key 에 `playKey` 가 들어 있어서
       **같은 탭을 다시 누르면** 노드가 통째로 교체되는데, 그때 이 이펙트가 다시
       돌지 않으면 옵저버가 떨어져 나간 옛 노드를 계속 본다 → 새 플레이어는
       화면 밖으로 나가도 안 멈추고 소리가 계속 난다.
       ESLint 는 이펙트 본문에 `playKey` 가 안 나와서 못 잡는다. */
  }, [playing, activeTab, playKey]);

  /** WAI-ARIA Tabs 패턴 — 좌우 화살표로 탭 이동 */
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const count = messages.tabs.length;
    if (count === 0) return;

    let next = -1;
    if (event.key === "ArrowRight") next = (activeTab + 1) % count;
    else if (event.key === "ArrowLeft") next = (activeTab - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next < 0) return;

    event.preventDefault();
    selectTab(next, true);
  };

  const startAt = TAB_STARTS[activeTab] ?? 0;

  return (
    <section ref={sectionRef} className={styles.section} aria-label="BGN AI 브랜드 스토리">
      {/* 탭 3개의 폭 합이 560 이라 375 에서 잘린다 — 시안 `124:3420` 이 탭 줄
          **위에** 가로 스크롤 인디케이터를 둔 이유다(썸 209/240 = 0.871). */}
      <ScrollHint scrollerRef={tabStripRef} thumbRatio={0.871} />
      <div
        ref={tabStripRef}
        className={styles.tabs}
        role="tablist"
        aria-label="AI 브랜드 스토리 주제"
        onKeyDown={handleTabKeyDown}
        data-reveal-item
      >
        {messages.tabs.map((tab, i) => {
          const isActive = i === activeTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`ai-story-tab-${i}`}
              aria-selected={isActive}
              aria-controls="ai-story-panel"
              /* 로빙 탭인덱스 — Tab 키 한 번에 탭 그룹을 통과한다 */
              tabIndex={isActive ? 0 : -1}
              className={clsx(styles.tab, isActive && styles.tabActive)}
              onClick={() => selectTab(i, false)}
            >
              {/* 인디케이터는 활성 탭 안에만 렌더하고 layoutId 로 '이동'시킨다.
                  좌표를 계산해 옮기면 폰트 로딩·가로 스크롤 때마다 어긋난다. */}
              {isActive ? (
                <motion.span
                  layoutId="ai-story-tab-indicator"
                  className={styles.tabIndicator}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }
                  }
                  aria-hidden
                />
              ) : null}
              <span className={styles.tabLabel}>{tab}</span>
            </button>
          );
        })}
      </div>

      {/* 스테이지 = GSAP 등장 대상. 안쪽 카드 = Motion 교체 대상.
          재생 중에는 iframe 을 크로스페이드하지 않는다 — 영상이 두 장 겹치면 소리가 두 번 난다. */}
      <div className={styles.stage} data-reveal-item>
        {playing ? (
          <div
            id="ai-story-panel"
            role="tabpanel"
            aria-labelledby={`ai-story-tab-${activeTab}`}
            className={styles.card}
          >
            <iframe
              key={`${YOUTUBE_ID}-${startAt}-${playKey}`}
              ref={playerRef}
              className={styles.player}
              src={youtubeSrc(startAt)}
              title={messages.tabs[activeTab] ?? messages.playLabel}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeTab}
              id="ai-story-panel"
              role="tabpanel"
              aria-labelledby={`ai-story-tab-${activeTab}`}
              className={styles.card}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
              transition={
                reduceMotion ? { duration: 0.2 } : { duration: 0.42, ease: [0.33, 1, 0.68, 1] }
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 카드 치수(854×484)와 1:1 인 확정 크기 에셋이라 next/image 리사이즈 이점이 없다 */}
              <img
                className={styles.cardBg}
                src="/main/img_06_card01.webp"
                alt={`${messages.videoEyebrow}. ${messages.videoTitle.replace(/\n/g, " ")}`}
                width={854}
                height={484}
                loading="lazy"
                decoding="async"
              />

              <button
                type="button"
                className={styles.play}
                aria-label={messages.playLabel}
                onClick={() => {
                  setPlaying(true);
                  setPlayKey((key) => key + 1);
                }}
              >
                {/* 글리프(▶)는 폰트마다 크기·정렬이 달라 중앙이 안 맞는다 → SVG 고정 */}
                <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                  <path d="M9 6.5 18 12l-9 5.5z" fill="currentColor" />
                </svg>
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
