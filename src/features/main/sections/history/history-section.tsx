"use client";

import type { CSSProperties } from "react";
import type { HistorySectionMessages } from "@/shared/i18n/messages";
import { useHistoryReveal } from "./use-history-reveal";
import styles from "./history-section.module.css";

/**
 * 병원 연혁 — 시안 p1_11 ~ p1_15 (PC) / p4_10 ~ p4_13 (모바일).
 *
 * ## ⚠️ pin 을 쓰지 않는다 (이전 구현에서 바뀐 부분)
 * 예전 구현은 `usePinnedProgress` 로 5스텝 pin + 카드 스택 회전이었다.
 * 그런데 기획안(`docs/plan/09-brief.md` — 섹션6 병원 연혁) 원문은 이렇다:
 *
 *   · 통합 스크롤 : 연도별 텍스트와 해당 이미지를 하나의 '세트'로 묶습니다.
 *     마우스 스크롤을 내리면 텍스트와 이미지가 **엇갈림 없이
 *     동시에 똑같은 속도로** 화면 위를 향해 흘러갑니다.
 *   · 부드러운 등장 : 새로운 연도 세트가 화면 하단에서 처음 시야에 들어올 때,
 *     투명도 0%에서 100%로 스르륵 선명해지며 살짝 위로 떠오르듯 등장
 *
 * "똑같은 속도로 화면 위를 향해 흘러간다" = **일반 세로 스크롤**이다.
 * pin 은 정의상 콘텐츠를 화면에 붙잡아 두고 스크롤 속도를 0으로 만드는 연출이라
 * 이 문장과 정면으로 배치된다. 또 pin + 카드 스택 회전은 "엇갈림"을 만드는
 * 연출인데 기획안은 그것을 명시적으로 금지한다.
 * → 그래서 pin 을 버리고 인트로 + 시대 세트 N개를 세로로 나열한다.
 *
 * ## 시안 요소는 살린다
 * Figma 이미지 카드(`2:2000`)에는 `rotate 9° / skewX 2.84°` 변형이 걸려 있다.
 * 이 기울임은 **정적으로만** 적용한다. 스크롤 진행도에 바인딩하면 이미지가
 * 텍스트와 다른 속도로 움직이게 되어 다시 "엇갈림"이 된다.
 * 프레임마다 기울기 방향이 달랐던 점만 세트 인덱스로 교차시킨다(`--tilt`).
 *
 * ## 반응형
 * PC 좌우 3단(이미지 · 축 · 텍스트) → 모바일 세로 스택(1시대 = 1블록).
 * DOM 은 하나뿐이고 CSS 만 바뀐다. pin 이 없어졌으므로 레이아웃 분기를
 * JS(`useIsMobileLayout`)로 할 이유가 사라졌다 — hydration 분기도 함께 사라진다.
 */
export interface HistorySectionProps {
  messages: HistorySectionMessages;
}

export function HistorySection({ messages }: HistorySectionProps) {
  const sectionRef = useHistoryReveal<HTMLElement>();
  const eras = messages.eras;

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="history-title">
      <div className="container">
        <header className={styles.intro}>
          {/* 꾸밈요소 — 주석의 "함께 꾸밈요소 배치". 헤드라인과 같은 방향으로 뻗는다 */}
          <span className={styles.deco} data-history-deco aria-hidden />
          <h2 id="history-title" className={styles.introTitle} data-history-headline>
            {renderWithMarker(messages.introTitle, messages.introTitleMarker)}
          </h2>
        </header>

        <div className={styles.timeline} data-history-axis-host>
          {/* 중앙 세로 축 — 스크롤에 따라 채워진다 */}
          <span className={styles.axis} aria-hidden>
            <span className={styles.axisFill} data-history-axis-fill />
          </span>

          <ol className={styles.eras}>
            {eras.map((era, i) => (
              <li
                key={era.period}
                className={styles.era}
                data-history-set
                /* Figma 실측 기울임의 방향만 교차. 크기(9° / 2.84°)는 고정 */
                style={{ "--tilt": i % 2 === 0 ? 1 : -1 } as CSSProperties}
              >
                {/* 이미지 카드 — 텍스트와 같은 li 안이라 항상 함께 흐른다 */}
                <div className={styles.photoFrame} aria-hidden>
                  <div className={styles.photoCard} data-asset-placeholder />
                </div>

                <span className={styles.node} aria-hidden />

                <div className={styles.copy}>
                  <p className={styles.period} lang="en">
                    {era.period}
                  </p>
                  <h3 className={styles.eraTitle}>{era.title}</h3>
                  <blockquote className={styles.quote}>
                    <p>{era.quote}</p>
                    <cite>- {era.quoteAuthor}</cite>
                  </blockquote>
                  <ul className={styles.points}>
                    {era.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/**
 * 헤드라인 일부 어절을 시안의 형광 마커로 감싼다.
 * 마커 span 에 `data-history-marker` 를 달아 좌→우 wipe 대상이 되게 한다.
 */
function renderWithMarker(text: string, marker: string) {
  if (!marker || !text.includes(marker)) return text;
  const [before, ...rest] = text.split(marker);
  return (
    <>
      {before}
      <span className="marker" data-history-marker>
        {marker}
      </span>
      {rest.join(marker)}
    </>
  );
}
