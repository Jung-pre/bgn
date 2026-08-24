"use client";

import type { CSSProperties } from "react";
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

/**
 * 확장 카드 배경 사진의 크롭/톤 — Figma `center card` 컴포넌트(`205:5345`) IMAGE fill.
 *
 * 시안은 `object-fit: cover` + 한 점 앵커가 아니다. 카드마다 scaleMode=CROP 의
 * imageTransform 으로 **보이는 창**을 잘라 쓴다. 그 행렬을 카드 % 로 풀면
 *   width  = 1/sx · height = 1/sy · left = −tx/sx · top = −ty/sy
 * `object-position` 으로 환산하면 줌이 사라져 얼굴·장비가 밀린다.
 *
 * pc = 상태=on / 1120×600, mo = 상태=on / 240×480.
 */
type PhotoCrop = { w: string; h: string; x: string; y: string };

const CENTER_PHOTO: Record<
  string,
  { src?: string; pc: PhotoCrop; mo: PhotoCrop; tone?: "dark"; cover?: boolean }
> = {
  "/center/smile": {
    pc: { w: "100%", h: "124.44%", x: "0%", y: "-5.2%" },
    mo: { w: "300%", h: "100%", x: "-165.66%", y: "0%" },
  },
  "/center/vision-correction": {
    pc: { w: "116.1%", h: "147.31%", x: "-0.36%", y: "-6.06%" },
    mo: { w: "277.96%", h: "100%", x: "-71.85%", y: "0%" },
  },
  "/center/cataract": {
    pc: { w: "110.88%", h: "124.88%", x: "0.06%", y: "-10.76%" },
    mo: { w: "364.64%", h: "110%", x: "-113.48%", y: "-9.96%" },
  },
  "/center/dream-lens": {
    pc: { w: "100%", h: "100%", x: "0%", y: "0%" },
    mo: { w: "246.82%", h: "100.06%", x: "-109.26%", y: "-0.06%" },
    tone: "dark",
    cover: true,
  },
  "/center/dry-eye": {
    pc: { w: "101.68%", h: "116.25%", x: "0.05%", y: "-2.79%" },
    mo: { w: "326.54%", h: "100%", x: "-142.0%", y: "0%" },
  },
  "/center/examination": {
    pc: { w: "147.35%", h: "206.29%", x: "-11.17%", y: "-96.99%" },
    mo: { w: "340.23%", h: "130.05%", x: "-103.75%", y: "-30.12%" },
  },
};

/**
 * 축소 카드 실크 텍스처 — Figma `center card` off (`205:5352`~`205:5376`).
 * 같은 `/main/img_07_bg01.webp` 를 카드마다 CROP 좌표가 다르다.
 * 건성안만 imageTransform sx 가 음수라 좌우 반전(`flip`).
 */
type TexCrop = { w: string; h: string; x: string; y: string; cover?: boolean; flip?: boolean };

const CARD_TEXTURE: Record<string, TexCrop> = {
  "/center/smile": { w: "426.06%", h: "127.56%", x: "-223.61%", y: "-13.82%" },
  "/center/vision-correction": { w: "100%", h: "100%", x: "0%", y: "0%", cover: true },
  "/center/cataract": { w: "381.94%", h: "111.41%", x: "-140.96%", y: "0.07%" },
  "/center/dream-lens": { w: "381.94%", h: "111.41%", x: "-105.79%", y: "0.07%" },
  "/center/dry-eye": { w: "406.13%", h: "108.27%", x: "152.14%", y: "0.05%", flip: true },
  "/center/examination": { w: "497.92%", h: "111.67%", x: "-303.53%", y: "0%" },
};

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
  const {
    activeIndex,
    groupOpen,
    trackRef,
    isExpanded,
    isVisible,
    select,
    step,
    toggleGroup,
    dragProps,
  } = useCentersAccordion(centers.length);

  /* 창(window)으로 접는 건 PC 아코디언에서만이다. 태블릿은 3열 그리드,
     모바일은 스와이퍼라 6장이 전부 보인다 — 거기서 창 밖 카드를
     aria-hidden 처리하면 실제로 보이는 카드가 스크린리더에서 사라진다. */
  const windowed = !isMobile;

  return (
    <section
      ref={sectionRef}
      className={clsx(styles.section, "blend-top")}
      aria-labelledby="centers-title"
      /* 앞 섹션(AI 브랜드 스토리) 끝 색 실측값 */
      style={{ "--blend-from": "rgb(226, 239, 254)" } as CSSProperties}
    >
      {/* 시안에는 헤더가 없다. 문서 개요용으로만 남긴다. */}
      <h2 id="centers-title" className="sr-only">
        {messages.title}
      </h2>

      <div className={styles.trackWrap} data-reveal-item>
        <ul
          ref={trackRef}
          className={styles.track}
          data-edge={
            isMobile && activeIndex === 0
              ? "start"
              : isMobile && activeIndex === centers.length - 1
                ? "end"
                : undefined
          }
          {...dragProps}
          /* ⚠️ `data-lenis-prevent` 를 달지 않는다.
             예전에는 모바일에서 트랙을 `overflow-x: auto` 스크롤 컨테이너로 만들어
             이 속성이 필요했지만, 시안(`8:4549`)은 스크롤이 아니라 **3장 창**이다
             (64 + 16 + 240 + 16 + 64 = 400, 375 프레임에서 좌우 12.5 씩 블리드).
             스크롤 컨테이너가 아닌 요소에 prevent 를 달면 Lenis 가 이 위의
             wheel·touch 를 통째로 네이티브로 흘려보내 세로 스크롤이 튄다. */
        >
          {centers.map((center, i) => {
            const expanded = isExpanded(i);
            const collapsed = windowed && !isVisible(i);
            const photo = CENTER_PHOTO[center.href];
            const texture = CARD_TEXTURE[center.href];
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
                <div
                  className={styles.card}
                  data-tone={photo?.tone}
                  data-photo-cover={photo?.cover || undefined}
                  data-tex-cover={texture?.cover || undefined}
                  style={
                    {
                      "--tex-w": texture?.w,
                      "--tex-h": texture?.h,
                      "--tex-x": texture?.x,
                      "--tex-y": texture?.y,
                      "--tex-flip": texture?.flip ? "scaleX(-1)" : "none",
                      "--photo-w": photo?.pc.w,
                      "--photo-h": photo?.pc.h,
                      "--photo-x": photo?.pc.x,
                      "--photo-y": photo?.pc.y,
                      "--photo-w-mo": photo?.mo.w,
                      "--photo-h-mo": photo?.mo.h,
                      "--photo-x-mo": photo?.mo.x,
                      "--photo-y-mo": photo?.mo.y,
                    } as CSSProperties
                  }
                >
                  {/* 확장(1120) 상태의 배경 사진 + 좌측 워시 (Figma 8:5199~8:5229).
                      카드 링크가 이미 센터명을 읽어주므로 사진은 순수 장식이다. */}
                  <span className={styles.media} aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 카드를 꽉 채우는
                        배경 사진이라 next/image 의 리사이즈 이점이 없고, 폭이 아코디언
                        상태에 따라 240↔1120 으로 계속 바뀌어 sizes 를 확정할 수 없다 */}
                    <img
                      className={styles.photo}
                      src={photo?.src ?? center.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </span>

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

                  {/**
                   * 역할 분리 — 이게 이 컴포넌트의 핵심 규칙이다.
                   *
                   * 예전에는 카드 전체가 하나의 `<Link>` 였고 "1탭 펼치기 / 2탭 이동"
                   * 이었다. 그런데 펼쳐진 뒤에는 카드 아무 데나 눌러도 페이지가 넘어가서,
                   * 사진을 보려고 클릭했다가 이동해 버린다. 시안이 `+` 를 크게 그려 둔
                   * 이유가 있다 — **이동 버튼은 `+` 다.**
                   *
                   *   접힌 카드  → 카드 전체가 "펼치기" 버튼
                   *   펼친 카드  → `+` 만 상세로 가는 링크, 나머지는 아무 동작 없음
                   *
                   * 두 요소가 배타적으로만 렌더되므로 같은 자리에서 포커스가 겹치지 않는다.
                   */}
                  {expanded ? (
                    <Link
                      href={center.href}
                      className={styles.plus}
                      aria-label={`${center.name} 자세히 보기`}
                      tabIndex={collapsed ? -1 : undefined}
                    >
                      <svg viewBox="0 0 48 48" aria-hidden focusable="false">
                        <path
                          d="M24 10v28M10 24h28"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={styles.selectHit}
                      aria-label={`${center.name} 펼치기`}
                      aria-expanded={false}
                      tabIndex={collapsed ? -1 : undefined}
                      /* 키보드 tab 이동만으로도 카드가 펼쳐져야 내용을 읽을 수 있다 */
                      onFocus={() => select(i)}
                      onClick={() => select(i)}
                    />
                  )}
                </div>
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
