"use client";

import clsx from "clsx";
import Link from "next/link";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import type { CentersSectionMessages } from "@/shared/i18n/messages";
import { useCentersAccordion, GROUP_REVEAL_AFTER } from "./use-centers-accordion";
import styles from "./centers-section.module.css";

/**
 * 진료 센터 — 가로 아코디언 (시안 p3 / p5 / p6 / p7 + 기획안 p?? 목업).
 *
 * 시안 p3·p5·p6·p7 은 서로 다른 페이지가 아니라 **같은 컴포넌트의 상태 세트**다.
 * 내부 폭이 항상 1600(콘텐츠 1760 − 갭 32×5)으로 유지되는 게 이 컴포넌트의 규칙이다.
 *
 *   기본  240 × 6            + 32 × 5 = 1600   → p6(사진) / p7(그라데이션)
 *   확장  1120 + 64 × 5      + 32 × 5 = 1600   → p3(확장) + p5(축소)
 *   그룹  328 × 4 + 64 × 2   + 32 × 5 = 1600   → `≡` 토글 상태 (아래 참고)
 *
 * ## hover 아코디언에서 클릭 아코디언으로 바꾼 이유
 * Figma Dev Mode 주석(`2:1961`) 원문:
 *
 *   "해당 영역 클릭시 현재 선택된 센터 이후의 3가지 영역이 펼쳐짐(모바일에선 제거)"
 *
 * 즉 선택의 확정은 **클릭**이다. hover 로 확정하면
 *   ① 마우스가 트랙을 지나가기만 해도 6장이 전부 요동치고,
 *   ② 터치 노트북(pointer: fine 이 아닌 1100px 기기)에서 조작이 막히며,
 *   ③ `≡` 그룹 펼침과 hover 가 같은 flex-grow 를 두고 싸운다.
 *
 * 대신 `MQ.hoverable`((hover: hover) and (pointer: fine)) 환경에서는
 * **hover 프리뷰**를 남겼다 — 축소 64px 카드를 시안 "기본" 폭 240px 까지만
 * 되돌려 "이건 누를 수 있는 것"이라는 신호를 준다. 확정 확장(1120)은 클릭에만 준다.
 * 이 프리뷰는 CSS `:hover` 로만 처리한다(→ module.css 의 `MQ.hoverable` 블록):
 * mouseenter 마다 setState 하면 마우스가 트랙을 훑는 동안 리렌더가 줄줄이 발생한다.
 *
 * ## `≡` 토글
 * 기획안 목업의 우측 끝 `≡` 가 위 주석의 "클릭 시 이후 3개 펼침"에 해당한다.
 * 켜면 [선택, 선택+1, 선택+2, 선택+3] 4장이 함께 펼쳐진다(폭 328 × 4).
 * 모바일(≤768)에서는 주석대로 **렌더 자체를 하지 않는다.**
 *
 * ## 하단 컨트롤
 * 기획안 목업: 프로그레스 6칸(활성 칸만 채움) + 좌우 원형 화살표.
 * 6칸은 센터 6개와 1:1 이므로 단순 표시가 아니라 **직접 이동 버튼**으로 뒀다.
 * 화살표만 있으면 5번 눌러야 닿는 카드가 생긴다.
 */
export interface CentersSectionProps {
  messages: CentersSectionMessages;
}

export function CentersSection({ messages }: CentersSectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const isMobile = useIsMobileLayout();
  const centers = messages.centers;
  const { activeIndex, groupOpen, trackRef, isExpanded, select, step, toggleGroup } =
    useCentersAccordion(centers.length);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="centers-title">
      <header className={styles.header} data-reveal-item>
        <p className="eyebrow" lang="en">
          {messages.eyebrow}
        </p>
        <h2 id="centers-title" className="section-title">
          {messages.title}
        </h2>
        {messages.description ? <p className="section-desc">{messages.description}</p> : null}
      </header>

      <div className={styles.trackWrap} data-reveal-item>
        <ul
          ref={trackRef}
          className={styles.track}
          /* 모바일에서 트랙이 실제 가로 스크롤 영역이 된다.
             Lenis 가 wheel/touch 를 가로채므로 반드시 opt-out. */
          data-lenis-prevent
          /* 그룹 모드에서는 hover 프리뷰를 끈다 — 이미 4장이 펼쳐진 상태라
             프리뷰까지 겹치면 남은 2장이 사라질 만큼 눌린다. (CSS 에서 참조) */
          data-group-open={groupOpen || undefined}
        >
          {centers.map((center, i) => {
            const expanded = isExpanded(i);
            return (
              <li
                key={center.href}
                className={clsx(
                  styles.item,
                  expanded && styles.itemExpanded,
                  expanded && groupOpen && styles.itemGrouped,
                  i === activeIndex && styles.itemActive,
                )}
              >
                <Link
                  href={center.href}
                  className={styles.card}
                  aria-current={i === activeIndex ? "true" : undefined}
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
                  {/* 축소 상태: 세로쓰기 라벨 (시안 p5) */}
                  <span className={styles.shortLabel} aria-hidden={expanded || undefined}>
                    {center.shortName}
                  </span>

                  {/* 확장 상태: 영문 아이브로우 + 국문명 + 설명 (시안 p3) */}
                  <span className={styles.expanded}>
                    <span className={styles.nameEn} lang="en">
                      {center.nameEn}
                    </span>
                    <span className={styles.name}>{center.name}</span>
                    {center.description ? (
                      <span className={styles.desc}>{center.description}</span>
                    ) : null}
                  </span>

                  <span className={styles.arrow} aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* `≡` — 트랙 우측 끝. 절대배치로 띄운 이유는 트랙 안에 끼워 넣으면
            6카드 + 5갭 = 1600 산술이 깨지기 때문이다. 카드 상단은 padding 64 로
            비어 있어(콘텐츠는 하단 정렬) 겹쳐도 글자를 가리지 않는다.
            모바일에서는 주석대로 제거 — CSS 로 숨기는 게 아니라 아예 렌더하지 않는다. */}
        {isMobile ? null : (
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
        )}
      </div>

      <div className={styles.controls} data-reveal-item>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => step(-1)}
          aria-label="이전 센터"
        >
          ←
        </button>

        {/* 프로그레스 6칸 — 활성 칸만 좌→우로 채워진다 */}
        <ol className={styles.progress}>
          {centers.map((center, i) => (
            <li key={center.href} className={styles.progressCell}>
              <button
                type="button"
                className={clsx(styles.progressBar, i === activeIndex && styles.progressBarActive)}
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
          →
        </button>
      </div>
    </section>
  );
}
