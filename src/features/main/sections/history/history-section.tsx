"use client";

import type { CSSProperties } from "react";
import type { HistorySectionMessages } from "@/shared/i18n/messages";
import { useHistoryReveal } from "./use-history-reveal";
import styles from "./history-section.module.css";

/**
 * 병원 연혁 — 시안 `2:1989` ~ `2:2315` (PC) / p4_10 ~ p4_13 (모바일).
 *
 * ## ⚠️ pin 을 쓰지 않는다 — 시안 5프레임으로 재확인함
 * 5프레임(인트로 + 시대 4개)을 나란히 보면 이렇다.
 *  · 각 프레임에서 이전 시대의 사진이 **위로 빠져나가는 중**이고 동시에
 *    다음 시대의 사진이 **아래에서 들어오는 중**이다.
 *  · pin 이라면 한 화면 안에서 카드가 제자리 교체돼야 하므로 위·아래에
 *    이웃 카드가 동시에 걸릴 수 없다.
 *  → 프레임 5장은 "각 시대가 화면 중앙에 왔을 때"를 찍은 컷이고,
 *    구조는 **1시대 = 1화면 높이의 일반 세로 스크롤**이다.
 *
 * 기획안(`docs/plan/09-brief.md` 섹션6)도 같은 말을 한다:
 *   · 통합 스크롤 : 텍스트와 이미지가 **엇갈림 없이 동시에 똑같은 속도로** 흐른다.
 *   · 부드러운 등장 : 화면 하단 진입 시 투명도 0→100 + 살짝 떠오름.
 * 시안과 기획안이 일치하므로 pin 은 넣지 않는다.
 *
 * ## 인트로도 "세트"다
 * 시안 `2:1989` 는 별도 섹션 헤더가 아니라 **의료진 사진(좌) + 헤드라인(우)** 으로
 * 시대 세트와 완전히 같은 3단 그리드다. 축과 노드도 이미 그려져 있다.
 * 그래서 인트로를 타임라인 안의 첫 행으로 넣는다.
 * (이전 구현의 좌측 그라데이션 바 `.deco` 는 시안에 없어서 지웠다.
 *  주석 2:1990 의 "꾸밈요소"는 배경 웨이브와 사진 카드로 해석한다.)
 *
 * ## 이미지 카드
 * 시안 카드는 **판 한 장**이다 — 뒤에 깔린 보조 판도, skewX 도 없다.
 * 기울기는 스크롤에 물려 8° → 2° 로 정돈된다(Figma 주석 `2:2000` → skazy.ai).
 * 회전은 세로 이동 속도를 바꾸지 않으므로 기획안이 금지한 "엇갈림"이 아니다.
 * 프레임마다 기울기 방향이 달랐던 점만 세트 인덱스로 교차시킨다(`--tilt`).
 *
 * ## 반응형
 * PC 좌우 3단(이미지 · 축 · 텍스트) → 모바일 세로 스택(1시대 = 1블록).
 * DOM 은 하나뿐이고 CSS 만 바뀐다.
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
        <div className={styles.timeline} data-history-axis-host>
          {/* 중앙 세로 축 — 스크롤에 따라 채워진다 */}
          <span className={styles.axis} aria-hidden>
            <span className={styles.axisFill} data-history-axis-fill />
          </span>

          {/* 인트로 — 시안 2:1989. 시대 세트와 같은 3단 그리드다.
              시안에서 이 행의 노드는 이미 활성(파란 점)이라 상태를 고정해 둔다 */}
          <div className={styles.era} data-visible="true">
            <div className={styles.photoFrame} aria-hidden>
              {/* 시안은 의료진 단체 사진. 인트로 카드만 기울기가 크다(≈9°) */}
              <div
                className={styles.photoCard}
                style={{ "--tilt-rest": "9deg" } as CSSProperties}
                data-asset-placeholder
                data-history-photo
              />
            </div>

            <span className={styles.node} aria-hidden />

            <div className={styles.copy}>
              <h2 id="history-title" className={styles.introTitle} data-history-headline>
                {renderWithMarker(messages.introTitle, messages.introTitleMarker)}
              </h2>
            </div>
          </div>

          <ol className={styles.eras}>
            {eras.map((era) => (
              <li key={era.period} className={styles.era} data-history-set>
                {/* 이미지 카드 — 텍스트와 같은 li 안이라 항상 함께 흐른다 */}
                <div className={styles.photoFrame} aria-hidden>
                  <div className={styles.photoCard} data-asset-placeholder data-history-photo />
                </div>

                <span className={styles.node} aria-hidden />

                <div className={styles.copy}>
                  <p className={styles.period} lang="en">
                    {era.period}
                  </p>
                  <h3 className={styles.eraTitle}>{era.title}</h3>
                  {/* 시안은 인용과 발화자가 **한 줄**이고 박스가 글자 폭에 붙는다 */}
                  <blockquote className={styles.quote}>
                    <p>&ldquo;{era.quote}&rdquo;</p>
                    {" - "}
                    <cite>{era.quoteAuthor}</cite>
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
