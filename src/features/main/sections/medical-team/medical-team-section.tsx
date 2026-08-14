"use client";

import Link from "next/link";
import clsx from "clsx";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import type { MedicalTeamSectionMessages } from "@/shared/i18n/messages";
import { crossLayout, useCrossCarousel } from "./use-cross-carousel";
import styles from "./medical-team-section.module.css";

/**
 * 의료진 — 시안 p1_05 / p1_06 상단 / p4_05.
 *
 * ## 무엇을 고쳤나
 * Figma 주석(`2:1016`): **"8명 의료진 배치, 스와이퍼 교차하며 카드 이동"**.
 * 이전 구현은 `translateX` 로 트랙을 통째로 미는 평행이동이라 "교차"가 없었다.
 *
 * 지금은 카드가 **겹쳐 쌓인 덱**이고, 각 장의 위치를 `crossLayout()` 이 계산한다:
 *   · x   — 시안 `2:3143` 실측(카드 140×200, x간격 100 = **40px 겹침**) 비율 그대로.
 *           `--card-step = --card-w × 100/140` (CSS) 로, 카드 폭이 바뀌어도 겹침 비율 유지.
 *   · y   — 카드 인덱스 홀/짝으로 **레인이 갈린다**. 이웃한 두 장이 항상 다른 높이라
 *           덱이 한 칸 밀릴 때 위·아래로 엇갈려 지나간다(= "교차").
 *   · z·scale·opacity — 활성에서 멀수록 뒤로/작게/흐리게. 겹침이 읽히게 하는 코버플로우 축.
 * 근거는 `use-cross-carousel.ts` 의 `crossLayout` 주석에 적어 뒀다.
 *
 * ## 입력
 * 도트 8개 + 좌우 화살표(기존 유지) + **포인터 드래그**. 드래그 중의 x 는 state 가
 * 아니라 ref → rAF → CSS 변수(`--drag-x`)로 흐른다. 인덱스가 바뀔 때만 리렌더된다.
 *
 * ## data-lenis-prevent 를 쓰지 않는 이유
 * 이 스테이지는 **스크롤 컨테이너가 아니다**(overflow 스크롤 없음, 포인터 드래그).
 * 스크롤이 없는 요소에 `data-lenis-prevent` 를 걸면 그 위에서 시작한 세로 스와이프가
 * Lenis 에도, 네이티브에도 걸리지 않아 페이지가 아예 안 움직인다.
 * 대신 CSS `touch-action: pan-y` 로 세로 스크롤은 브라우저에, 가로 제스처는 우리가 갖는다.
 */
export interface MedicalTeamSectionProps {
  messages: MedicalTeamSectionMessages;
}

export function MedicalTeamSection({ messages }: MedicalTeamSectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const doctors = messages.doctors;
  const { activeIndex, select, step, stageRef, dragProps } = useCrossCarousel(doctors.length);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="team-title">
      <header className={styles.header} data-reveal-item>
        <div>
          <p className="eyebrow" lang="en">
            {messages.eyebrow}
          </p>
          <h2 id="team-title" className="section-title">
            {messages.title}
          </h2>
        </div>
        <Link href="/about/doctors" className={styles.cta}>
          {messages.cta} <span aria-hidden>→</span>
        </Link>
      </header>

      <div className={styles.viewport} data-reveal-item>
        <div ref={stageRef} className={styles.stage} {...dragProps}>
          <ul className={styles.deck}>
            {doctors.map((doctor, i) => {
              const { style, hidden } = crossLayout(i, activeIndex, doctors.length);
              const label = doctor.name || `${i + 1}번째 의료진`;
              return (
                <li
                  key={i}
                  className={clsx(styles.card, i === activeIndex && styles.cardActive)}
                  style={style}
                  aria-hidden={hidden || undefined}
                >
                  {/* 옆 카드를 눌러 그 카드로 이동한다. 활성 카드는 이동할 곳이 없으므로
                      버튼을 비활성화해 탭 순서에서도 빠지지 않게 aria-current 만 남긴다. */}
                  <button
                    type="button"
                    className={styles.cardButton}
                    aria-label={label}
                    aria-current={i === activeIndex ? "true" : undefined}
                    tabIndex={hidden ? -1 : undefined}
                    onClick={() => select(i)}
                  >
                    <span className={styles.portrait} aria-hidden />
                    <span className={styles.name}>
                      {doctor.name}
                      <span className={styles.role}>{doctor.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className={styles.controls} data-reveal-item>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => step(-1)}
          aria-label="이전 의료진"
        >
          ←
        </button>
        <ul className={styles.dots}>
          {doctors.map((doctor, i) => (
            <li key={i}>
              <button
                type="button"
                className={clsx(styles.dot, i === activeIndex && styles.dotActive)}
                aria-label={doctor.name || `${i + 1}번째 의료진`}
                aria-current={i === activeIndex ? "true" : undefined}
                onClick={() => select(i)}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => step(1)}
          aria-label="다음 의료진"
        >
          →
        </button>
      </div>
    </section>
  );
}
