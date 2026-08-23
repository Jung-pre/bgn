"use client";

import Image from "next/image";
import Link from "next/link";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import type { EventSectionMessages } from "@/shared/i18n/messages";
import { useOneStepCarousel } from "./use-one-step-carousel";
import styles from "./event-section.module.css";

/**
 * BGN EVENT — 시안 `2:2832` (PC) / p4_19~20.
 *
 * 좌측 카피 408 + 간격 128 + 우측 슬라이더(시안 2:2833 실측).
 * 카드가 우측 화면 밖으로 흘러나간다. 인디케이터가 도트가 아니라
 * **프로그레스 바**인 게 다른 캐러셀과 다른 점.
 *
 * ## Figma 주석 (2:2852)
 *   `카드 최대 8개, 버튼 클릭시 한개씩`
 *
 * → (1) 최대 8장으로 자르고 (2) 화살표 1클릭 = 카드 1장 이동.
 *   이동 단위 계산은 `useOneStepCarousel` 로 뺐다.
 *
 * ## 카드는 이미지 한 장뿐이다
 * 시안 `2:2854`~`2:2856` 은 480×480 이미지 3장이고 **아래에 제목·부제가 없다**.
 * 이벤트 배너 안에 이미 카피가 들어 있기 때문이다. 이전 구현은 카드 밑에
 * 제목/부제를 그려서 시안보다 카드 한 장이 훨씬 길었다.
 * 링크 접근성은 `.sr-only` 텍스트로 유지한다.
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
          <p className={`eyebrow ${styles.eyebrow}`} lang="en">
            {messages.eyebrow}
          </p>
          <h2 id="event-title" className={styles.title}>
            {renderAccent(messages.title, ACCENT)}
          </h2>
          {messages.description ? (
            <p className={styles.desc}>
              {renderStrong(messages.description, messages.descriptionStrong)}
            </p>
          ) : null}
          <Link href="/event" className={styles.cta}>
            {messages.cta}
            {/* 시안 2:2849 arrow-detail — 원 안의 화살표 */}
            <svg
              className={styles.ctaIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9.25" />
              <path d="M9 12h6M12.6 9.2 15.4 12l-2.8 2.8" />
            </svg>
          </Link>
        </header>

        <div className={styles.sliderWrap} data-reveal-item>
          {/* 내부 가로 스크롤 영역.
              ⚠️ 예전엔 `data-lenis-prevent` 를 달았다. 트랙이 진짜 가로 스크롤
              컨테이너인 건 맞지만, 이 속성은 축을 가리지 않아서 480px 높이의 이 띠
              위를 지나가는 **세로** 휠까지 네이티브로 넘겨 버린다. 캐러셀을 지날
              때마다 스무스 스크롤이 끊기고 GNB 가 깜빡이던 원인이다.
              지금은 Lenis 의 `allowNestedScroll` 이 휠 방향을 보고 가로일 때만
              트랙에 넘긴다 (`smooth-scroll-provider.tsx`). */}
          <ul ref={trackRef} className={styles.track} aria-label="이벤트 목록" {...dragProps}>
            {events.map((ev) => (
              <li key={ev.href} className={styles.card}>
                <Link href={ev.href} className={styles.cardLink} draggable={false}>
                  {/*
                    배너 안에 카피가 이미 그려져 있어 alt 를 달면 아래 .sr-only 와
                    링크 이름이 두 번 읽힌다 → 이미지는 장식으로 넘긴다.
                    sizes: 카드 폭은 30rem 인데 root 가 뷰포트 비례(1920→16px)라
                    데스크톱에서는 사실상 25vw 고정, 1024 이하는 root 16px 이라 480/240px.
                  */}
                  <Image
                    src={ev.image}
                    alt=""
                    aria-hidden
                    width={480}
                    height={480}
                    className={styles.thumb}
                    sizes="(max-width: 768px) 240px, (max-width: 1024px) 480px, 25vw"
                    draggable={false}
                  />
                  {/* 시안 카드에는 텍스트가 없다. 링크 이름만 보조기기에 남긴다 */}
                  <span className="sr-only">
                    {ev.title}
                    {ev.subtitle ? ` — ${ev.subtitle}` : ""}
                  </span>
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
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => step(-1)}
                disabled={!canPrev}
                aria-label="이전 이벤트"
              >
                <ChevronIcon direction="left" />
              </button>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => step(1)}
                disabled={!canNext}
                aria-label="다음 이벤트"
              >
                <ChevronIcon direction="right" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 시안 2:2845 — 타이틀 중 이 토큰만 primary/700 + 형광 마커가 걸린다 */
const ACCENT = "EVENT";

/** 타이틀의 영문 포인트 어절을 시안대로 강조한다 */
function renderAccent(title: string, accent: string) {
  if (!title.endsWith(accent)) return title;
  return (
    <>
      {title.slice(0, -accent.length)}
      {/* 시안 2:2832 의 EVENT 는 밑줄형 하이라이트(.marker)가 아니라
         **선택 커서 모티프**(.title-mark)다 — 상자 y186~238(53) 로 줄상자
         전체 높이고 좌우에 세로 바가 선다. .marker 는 0.45em(18px) 밑줄이라
         시안의 1/3 높이였다. */}
      <span className={`title-mark ${styles.titleAccent}`} lang="en">
        {accent}
      </span>
    </>
  );
}

/**
 * 본문 중 한 구간만 굵게 — 시안 `2:2846` 은 "BGN의 특별한 혜택"만 SemiBold 다.
 *
 * 문구를 `<strong>` 이 박힌 JSX 로 사전에 넣지 않고 **부분 문자열 매칭**으로 처리한다.
 * 번역마다 굵기 구간이 달라져도 사전(`descriptionStrong`)만 고치면 되고,
 * 사전이 순수 문자열로 남아야 번역 도구에 그대로 넘길 수 있기 때문이다.
 *
 * 매칭 실패(번역이 아직 안 됐거나 오타)면 조용히 원문 그대로 낸다 — 문구가
 * 사라지는 것보다 굵기가 빠지는 쪽이 훨씬 낫다.
 */
function renderStrong(text: string, strong: string) {
  if (!strong) return text;
  const at = text.indexOf(strong);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className={styles.descStrong}>{strong}</strong>
      {text.slice(at + strong.length)}
    </>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={direction === "left" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5"} />
    </svg>
  );
}
