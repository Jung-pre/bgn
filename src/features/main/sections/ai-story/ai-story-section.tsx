"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import { usePrefersReducedMotion } from "@/shared/lib/use-media-query";
import type { AiStorySectionMessages } from "@/shared/i18n/messages";
import styles from "./ai-story-section.module.css";

/**
 * AI 브랜드 스토리(영상 탭) — Figma `8:1160` (구 `2:1286`) / Container `2:1938`.
 *
 * 세그먼트 탭 3개 + 대형 비디오 카드 1장(854×484).
 *
 * ## 썸네일 = `/main/ai/story-card.webp` (854×484 — 카드와 1:1 동일 치수)
 * 시안의 카드는 **한 장의 영상 썸네일**이고 카피(아이브로우 + 2줄 타이틀)가
 * 이미지에 **구워져 있다**. 그래서 같은 문구를 DOM 텍스트로 또 얹으면 이중으로
 * 겹쳐 보인다 → 카피는 `<img alt>` 로만 전달한다. 이미지가 못 뜨면 alt 가
 * 그 자리에 그대로 노출되므로 정보 손실도 없다.
 *
 * 탭 3개인데 썸네일 에셋은 1장뿐이다(에셋 추가 필요 — 보고 참조).
 * 지금은 세 탭이 같은 썸네일을 공유하고, 교체 크로스페이드만 돈다.
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
 * 시안에서 탭이 좌우로 잘린 채 노출된다(= 스크롤 가능 신호).
 * 내부 가로 스크롤 영역이므로 `data-lenis-prevent` 가 반드시 필요하다 —
 * 없으면 Lenis 가 wheel/touch 를 가로채 탭이 움직이지 않는다.
 */
export interface AiStorySectionProps {
  messages: AiStorySectionMessages;
}

export function AiStorySection({ messages }: AiStorySectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const tabStripRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  // 시안 기본 활성은 2번째 탭
  const [activeTab, setActiveTab] = useState(1);

  /**
   * 탭 전환. 같은 값이면 setState 를 건너뛴다 — 리렌더뿐 아니라
   * `AnimatePresence` 가 key 동일 판정을 다시 하는 비용도 없앤다.
   */
  const selectTab = useCallback(
    (next: number, moveFocus: boolean) => {
      setActiveTab((prev) => (prev === next ? prev : next));

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

  const handlePlay = () => {
    // TODO: 영상 소스가 확정되면 재생 처리.
    //   시안에는 플레이어 UI 가 없고 카드 전체가 썸네일이다 →
    //   (a) 모달 오버레이 재생 / (b) 카드 자리 인라인 <video> 교체 중
    //   어느 쪽인지 기획 확인 필요. 확정 전까지 UI 만 완성해 둔다.
  };

  return (
    <section
      ref={sectionRef}
      className={clsx(styles.section, "blend-top")}
      aria-label="BGN AI 브랜드 스토리"
      /* 앞 섹션(AI 상담 신청) 끝 색 실측값 */
      style={{ "--blend-from": "rgb(253, 254, 255)" } as React.CSSProperties}
    >
      <div
        ref={tabStripRef}
        className={styles.tabs}
        role="tablist"
        aria-label="AI 브랜드 스토리 주제"
        onKeyDown={handleTabKeyDown}
        data-reveal-item
        data-lenis-prevent
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

      {/* 스테이지 = GSAP 등장 대상. 안쪽 카드 = Motion 교체 대상. */}
      <div className={styles.stage} data-reveal-item>
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
            {/* 카피가 구워진 썸네일. 카드(854×484)와 같은 치수라 크롭 없이 딱 맞는다.
                TODO: 영상 소스가 오면 이 <img> 를 <video poster={...}> 로 바꾼다. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 카드 치수(854×484)와 1:1 인 확정 크기 에셋이라 next/image 리사이즈 이점이 없다 */}
            <img
              className={styles.cardBg}
              src="/main/ai/story-card.webp"
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
              onClick={handlePlay}
            >
              {/* 글리프(▶)는 폰트마다 크기·정렬이 달라 중앙이 안 맞는다 → SVG 고정 */}
              <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                <path d="M9 6.5 18 12l-9 5.5z" fill="currentColor" />
              </svg>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
