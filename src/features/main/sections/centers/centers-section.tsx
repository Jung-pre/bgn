"use client";

import clsx from "clsx";
import Link from "next/link";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import type { CentersSectionMessages } from "@/shared/i18n/messages";
import { useCentersAccordion, GROUP_REVEAL_AFTER } from "./use-centers-accordion";
import styles from "./centers-section.module.css";

/**
 * 진료 센터 — 가로 아코디언. Figma `2:1950` / Container `2:1951`.
 *
 * 시안 구조가 살아 있는 몇 안 되는 프레임이라 수치는 전부 실측이다.
 *
 *   섹션      2:1950  bg white, pt 120 / pb 96 / px 80
 *   트랙      2:1952  height 600, gap 32, width 1760
 *               240(이전) + 1120(선택) + 240(다음) + 64(`≡`) + 32×3 = 1760
 *   컨트롤    2:1966  가운데 정렬. ‹ 40 + 도트(20, dot 6) + › 40, gap 32
 *
 * ## 6장을 다 늘어놓지 않는 이유
 * CLAUDE.md 에는 "확장 1120 + 축소 64×5 + 갭 32×5 = 1600" 으로 적혀 있는데,
 * 이건 조립 전 컴포넌트(p3/p5)만 보고 세운 가설이다. 실제 조립 프레임
 * `2:1952` 는 **[이전 · 선택 · 다음] 3장 + `≡` 스트립**만 보여준다(합 1760).
 * 시안 > 주석 > 기획안 우선순위대로 조립 프레임을 따랐다.
 * 창 밖 카드는 DOM 에 남긴 채 폭 0 으로 접는다 — 키보드 포커스로 들어오면
 * `select()` 가 창을 옮기므로 접근성이 끊기지 않는다.
 *
 * ## 시안에 없어서 뺀 것
 * 섹션 헤더(eyebrow + 타이틀 + 설명)와 하단 프로그레스 바.
 * `2:1950` 은 y=120 부터 바로 트랙이고 헤더가 없다. 문서 구조가 무너지지
 * 않도록 h2 는 `.sr-only` 로 남긴다.
 *
 * ## 클릭 아코디언인 이유
 * Figma Dev Mode 주석(`2:1961` = 트랙 우측 끝 64px `≡` 스트립) 원문:
 *   "해당 영역 클릭시 현재 선택된 센터 이후의 3가지 영역이 펼쳐짐(모바일에선 제거)"
 * 선택의 확정은 hover 가 아니라 **클릭**이다. hover 로 확정하면 마우스가
 * 트랙을 지나가기만 해도 카드가 요동치고, 터치 노트북에서 조작이 막힌다.
 */
export interface CentersSectionProps {
  messages: CentersSectionMessages;
}

/** arrow-detail 48×48 (Figma 2:5403) — 원형 배경 없는 가는 선 화살표 */
function ArrowDetailIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        d="M8 24h32m-12-12 12 12-12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 좌우 컨트롤 화살표 24×24 (Figma 2:1968 / 2:1982) */
function ChevronIcon({ direction }: { direction: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d={direction === -1 ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CentersSection({ messages }: CentersSectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const isMobile = useIsMobileLayout();
  const centers = messages.centers;
  const { activeIndex, groupOpen, trackRef, isExpanded, isVisible, select, step, toggleGroup } =
    useCentersAccordion(centers.length);

  /* 창(window)으로 접는 건 PC 아코디언에서만이다. 태블릿은 3열 그리드,
     모바일은 스와이퍼라 6장이 전부 보인다 — 거기서 창 밖 카드를
     aria-hidden 처리하면 실제로 보이는 카드가 스크린리더에서 사라진다. */
  const windowed = !isMobile;

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="centers-title">
      {/* 시안에는 헤더가 없다. 문서 개요용으로만 남긴다. */}
      <h2 id="centers-title" className="sr-only">
        {messages.title}
      </h2>

      <div className={styles.trackWrap} data-reveal-item>
        <ul
          ref={trackRef}
          className={styles.track}
          /* 모바일에서 트랙이 실제 가로 스크롤 영역이 된다.
             Lenis 가 wheel/touch 를 가로채므로 반드시 opt-out. */
          data-lenis-prevent
        >
          {centers.map((center, i) => {
            const expanded = isExpanded(i);
            const collapsed = windowed && !isVisible(i);
            return (
              <li
                key={center.href}
                className={clsx(
                  styles.item,
                  !isVisible(i) && styles.itemHidden,
                  expanded && styles.itemExpanded,
                  expanded && groupOpen && styles.itemGrouped,
                  i === activeIndex && styles.itemActive,
                )}
                /* 창 밖 카드는 폭 0 이라 화면에 없는 것과 같다. 도트로 도달할 수
                   있으므로 AT 에서 빼도 정보가 사라지지 않는다. */
                aria-hidden={collapsed || undefined}
              >
                <Link
                  href={center.href}
                  className={styles.card}
                  aria-current={i === activeIndex ? "true" : undefined}
                  tabIndex={collapsed ? -1 : undefined}
                  /* 키보드 tab 이동만으로도 카드가 펼쳐져야 내용을 읽을 수 있다 */
                  onFocus={() => select(i)}
                  /* 1탭 = 펼치기, 2탭 = 이동. 포인터 종류와 무관하게 같은 규칙이라
                     마우스/터치/키보드가 전부 동일하게 동작한다. */
                  onClick={(e) => {
                    if (i !== activeIndex) {
                      e.preventDefault();
                      select(i);
                    }
                  }}
                >
                  {/* 기본(240) 상태: 상단 가로쓰기 라벨 + 하단 화살표 (Figma 2:5393) */}
                  <span className={styles.shortLabel} aria-hidden={expanded || undefined}>
                    {center.shortName}
                  </span>

                  {/* 확장(1120) 상태: 영문 아이브로우 + 국문명 + 설명 (Figma 2:1955) */}
                  <span className={styles.expanded}>
                    <span className={styles.nameEn} lang="en">
                      {center.nameEn}
                    </span>
                    <span className={styles.nameBlock}>
                      <span className={styles.name}>{center.name}</span>
                      {center.description ? (
                        <span className={styles.desc}>{center.description}</span>
                      ) : null}
                    </span>
                  </span>

                  <span className={styles.arrow} aria-hidden>
                    <ArrowDetailIcon />
                  </span>

                  {/* Figma 2:1984 — 펼친 카드 위에 뜨는 96px 유리 `+` */}
                  <span className={styles.plus} aria-hidden>
                    <svg viewBox="0 0 48 48" focusable="false">
                      <path
                        d="M24 10v28M10 24h28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}

          {/* `≡` — Figma 2:1961. 떠 있는 버튼이 아니라 트랙의 마지막 칸(64×600)이다.
              트랙 폭 산술(1760)에 포함되므로 반드시 트랙 안에 있어야 한다.
              모바일에서는 주석대로 제거 — CSS 로 숨기는 게 아니라 아예 렌더하지 않는다. */}
          {isMobile ? null : (
            <li className={styles.groupToggleItem}>
              <button
                type="button"
                className={styles.groupToggle}
                aria-pressed={groupOpen}
                aria-label={
                  groupOpen
                    ? "펼친 센터 접기"
                    : `선택한 센터 이후 ${GROUP_REVEAL_AFTER}개 센터 함께 펼치기`
                }
                onClick={toggleGroup}
              >
                <span className={styles.groupToggleIcon} aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            </li>
          )}
        </ul>

        {/* Figma 2:1966 — 트랙 아래 가운데. 프로그레스 바가 아니라 도트다. */}
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => step(-1)}
            aria-label="이전 센터"
          >
            <ChevronIcon direction={-1} />
          </button>

          <ol className={styles.dots}>
            {centers.map((center, i) => (
              <li key={center.href}>
                <button
                  type="button"
                  className={clsx(styles.dot, i === activeIndex && styles.dotActive)}
                  aria-label={center.name}
                  aria-current={i === activeIndex ? "true" : undefined}
                  onClick={() => select(i)}
                />
              </li>
            ))}
          </ol>

          <button
            type="button"
            className={styles.navButton}
            onClick={() => step(1)}
            aria-label="다음 센터"
          >
            <ChevronIcon direction={1} />
          </button>
        </div>
      </div>
    </section>
  );
}
