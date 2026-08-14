"use client";

import Link from "next/link";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import type { EventSectionMessages } from "@/shared/i18n/messages";
import { useOneStepCarousel } from "./use-one-step-carousel";
import styles from "./event-section.module.css";

/**
 * BGN EVENT — 시안 p1_21 / p4_19~20.
 *
 * 좌측 25% 텍스트 + 우측 75% 카드 슬라이더. 카드가 우측 화면 밖으로 흘러나간다.
 * 인디케이터가 도트가 아니라 **프로그레스 바**인 게 다른 캐러셀과 다른 점.
 *
 * ## Figma 주석 (2:2852)
 *   `카드 최대 8개, 버튼 클릭시 한개씩`
 *
 * → (1) 최대 8장으로 자르고 (2) 화살표 1클릭 = 카드 1장 이동.
 *   이전 구현은 `scrollBy(clientWidth * 0.5)` 라 화면 폭에 따라 이동량이
 *   1.4~2.1장으로 달라졌다. 이동 단위 계산은 `useOneStepCarousel` 로 뺐다.
 *
 * ## 카드 크기
 * 시안 480×480 정사각. 데스크톱 root font-size 가 뷰포트 비례
 * (`clamp(10px, 0.8333vw, 16px)`, 1920 에서 16px)이므로 `30rem` 이 곧
 * 1920 기준 480px 이고, 창이 줄면 레이아웃 전체와 함께 비례 축소된다.
 * px 로 박으면 1440 에서 카드만 커 보인다.
 */
export interface EventSectionProps {
  messages: EventSectionMessages;
}

/** Figma 주석의 "카드 최대 8개" */
const MAX_EVENTS = 8;

export function EventSection({ messages }: EventSectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const events = messages.events.slice(0, MAX_EVENTS);
  const { trackRef, progressRef, index, lastIndex, step, dragProps } = useOneStepCarousel(
    events.length,
  );

  const canPrev = index > 0;
  const canNext = index < lastIndex;

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="event-title">
      <div className={styles.inner}>
        <header className={styles.copy} data-reveal-item>
          <p className="eyebrow" lang="en">
            {messages.eyebrow}
          </p>
          <h2 id="event-title" className={styles.title}>
            {messages.title}
          </h2>
          {messages.description ? <p className={styles.desc}>{messages.description}</p> : null}
          <Link href="/event" className={styles.cta}>
            {messages.cta} <span aria-hidden>→</span>
          </Link>
        </header>

        <div className={styles.sliderWrap} data-reveal-item>
          {/* 내부 가로 스크롤 영역 — data-lenis-prevent 없으면 Lenis 가
              wheel/touch 를 가로채서 트랙이 아예 움직이지 않는다. */}
          <ul
            ref={trackRef}
            className={styles.track}
            data-lenis-prevent
            aria-label="이벤트 목록"
            {...dragProps}
          >
            {events.map((ev) => (
              <li key={ev.href} className={styles.card}>
                <Link href={ev.href} className={styles.cardLink} draggable={false}>
                  <div className={styles.thumb} aria-hidden />
                  <p className={styles.cardTitle}>{ev.title}</p>
                  {ev.subtitle ? <p className={styles.cardSub}>{ev.subtitle}</p> : null}
                </Link>
              </li>
            ))}
          </ul>

          <div className={styles.controls}>
            {/* 진행률은 스크롤 프레임마다 바뀌는 값이라 state 가 아니라
                ref 로 DOM 에 직접 쓴다(`useOneStepCarousel`). */}
            <div
              className={styles.progress}
              role="progressbar"
              aria-label="이벤트 슬라이드 진행률"
              aria-valuemin={1}
              aria-valuemax={lastIndex + 1}
              aria-valuenow={index + 1}
            >
              <span ref={progressRef} className={styles.progressBar} />
            </div>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => step(-1)}
              disabled={!canPrev}
              aria-label="이전 이벤트"
            >
              ←
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => step(1)}
              disabled={!canNext}
              aria-label="다음 이벤트"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
