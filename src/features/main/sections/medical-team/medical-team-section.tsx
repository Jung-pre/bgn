"use client";

import Link from "next/link";
import clsx from "clsx";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import type { MedicalTeamSectionMessages } from "@/shared/i18n/messages";
import { crossLayout, useCrossCarousel } from "./use-cross-carousel";
import styles from "./medical-team-section.module.css";

/**
 * 의료진 — Figma `2:995` (1920×969) / 주석 `2:1016`.
 *
 * ## 시안 실측 (2:995 는 플랫 이미지라 육안 계측이다)
 * 카드 320×400, gap 32, 홀/짝 42px 지그재그, **겹침·회전·축소 없음**.
 * 활성 카드는 파랑→보라 링 2px 로만 구분되고, 이름은 카드 하단에 얹힌다.
 * 좌우 끝 카드는 페이드가 아니라 뷰포트에 **잘려** 나간다.
 * 배치 계산은 `crossLayout()`, 실제 길이는 CSS 토큰이 정한다.
 *
 * ## 입력
 * 도트 8개 + 좌우 셰브론 + **포인터 드래그**. 드래그 중의 x 는 state 가
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

/**
 * 시안 타이틀은 "BGN"(민글씨) + 파란 사각 테두리로 감싼 "의료진" 두 덩어리다.
 * messages 에 분리 필드가 없어 **첫 공백**을 기준으로 나눈다 — 브랜드 토큰이 항상
 * 맨 앞에 오는 구조라 4개국어 모두에서 성립한다. 공백이 없으면 통째로 감싸지 않고
 * 그대로 둔다(테두리가 문장 전체를 두르는 사고를 막는다).
 */
function renderBoxedTitle(title: string) {
  const at = title.indexOf(" ");
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className={styles.titleBox}>{title.slice(at + 1)}</span>
    </>
  );
}

/** 시안 화살표는 ←/→ 가 아니라 셰브론이다. */
function Chevron({ dir }: { dir: -1 | 1 }) {
  return (
    <svg viewBox="0 0 8 14" fill="none" aria-hidden focusable="false">
      <path
        d={dir === -1 ? "M7 1 1 7l6 6" : "M1 1l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
            {renderBoxedTitle(messages.title)}
          </h2>
          {/* 시안 2:995 는 타이틀 아래에 한 줄 설명이 있다.
              i18n 에 값이 채워지기 전에는 렌더하지 않는다(빈 여백만 남는다). */}
          {messages.description ? (
            <p className={`section-desc ${styles.desc}`}>{messages.description}</p>
          ) : null}
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
                    {/* 시안은 이름이 카드 밖이 아니라 사진 하단에 얹혀 있고,
                        활성 카드만이 아니라 **모든 카드**에 붙어 있다. */}
                    <span className={styles.portrait}>
                      <span className={styles.caption}>
                        <span className={styles.name}>{doctor.name}</span>
                        <span className={styles.role}>{doctor.title}</span>
                      </span>
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
          <Chevron dir={-1} />
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
          <Chevron dir={1} />
        </button>
      </div>
    </section>
  );
}
