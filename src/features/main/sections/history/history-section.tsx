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

/**
 * 연혁 세트별 사진 — 시안 5프레임을 순서대로 읽어 맞췄다.
 * `messages.eras` 에는 이미지 필드가 없고 i18n 은 다른 담당 영역이라
 * **컴포넌트 상수**로 둔다. `eras` 와 같은 순서(2009→2024)로 1:1 대응한다.
 *
 *   8:1929  2009~2010  아이얼안과 공동 라식 전문센터 합작 체결식 단체컷
 *   8:2014  2011~2013  BGN 로고 벽 앞 인증패 수여 (ZEISS 스마일 라식 센터 선정)
 *   8:2099  2014~2023  글로벌 학회 상패 수여 (WOC TOKYO 수상)
 *   8:2184  2024~2026  ZEISS SMILE pro CENTER / SMILE CENTER 인증 엠블럼
 *
 * award.webp(401×301)·cert.webp(1231×924)는 둘 다 정확히 4:3 이라
 * 카드(640×480)에 맞춰 내보낸 컷임을 알 수 있다 — 매칭 근거 하나 더.
 */
const ERA_PHOTOS: { src: string; alt: string }[] = [
  {
    src: "/main/img_08_photo01.webp",
    alt: "2011년 아이얼안과와 체결한 공동 라식 전문센터 합작 체결식 기념 촬영",
  },
  {
    src: "/main/img_08_photo02.webp",
    alt: "ZEISS 공식 인증 스마일 라식 센터 선정 인증패를 전달받는 박세광 대표원장",
  },
  {
    src: "/main/img_08_photo03.webp",
    alt: "글로벌 학회에서 비쥬맥스 라식 부문 상패를 전달받는 모습",
  },
  {
    src: "/main/img_08_photo04.webp",
    alt: "ZEISS SMILE pro CENTER · ZEISS SMILE CENTER 인증 엠블럼",
  },
];

/**
 * 바퀴에 박히는 사진 5장 — 인트로 1 + 시대 4.
 * 텍스트 행 수(인트로 + 시대 4)와 1:1 이라 `a`(활성 인덱스)가 그대로 살 번호가 된다.
 */
const WHEEL_PHOTOS: { src: string; alt: string; variant?: "intro" }[] = [
  {
    src: "/main/img_08_photo05.webp",
    alt: "BGN 밝은눈안과 의료진 단체 사진",
    variant: "intro",
  },
  ...ERA_PHOTOS,
];

export function HistorySection({ messages }: HistorySectionProps) {
  const sectionRef = useHistoryReveal<HTMLElement>();
  const eras = messages.eras;

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="history-title">
      {/* 시안 8:1858 의 배경 = 흰 바탕 + 웨이브 텍스처(40%) + 파랑↔보라 overlay.
          블렌드가 타임라인 카피까지 물들이면 안 되므로 별도 레이어로 깔고
          `.timeline` 을 z-index 로 위에 올린다(가상요소로 하면 ::after 가
          콘텐츠보다 뒤에 그려져 오버레이가 글자를 덮는다). */}
      <div className={styles.bgWave} aria-hidden />

      <div className="container">
        <div className={styles.timeline} data-history-axis-host>
          {/* 중앙 세로 축 — 스크롤에 따라 채워진다 */}
          <span className={styles.axis} aria-hidden>
            <span className={styles.axisFill} data-history-axis-fill />
          </span>

          {/* 인트로 — 시안 2:1989. 시대 세트와 같은 3단 그리드다.
              시안에서 이 행의 노드는 이미 활성(파란 점)이라 상태를 고정해 둔다 */}
          <div className={styles.era} data-visible="true">
            {/* PC 에서 사진은 바퀴(.wheelColumn)로 빠졌지만 **그리드 첫 칸은
                남겨야 한다.** 안 남기면 노드가 1번 칸으로 올라와 카피가 축
                왼쪽으로 밀린다. 모바일에서는 이 칸이 그대로 사진 자리가 된다
                (아래 `SlotPhoto` 주석 참고). */}
            <span className={styles.photoSlot}>
              <SlotPhoto photo={WHEEL_PHOTOS[0]} />
            </span>

            <span className={styles.node} aria-hidden />

            <div className={styles.copy}>
              <h2 id="history-title" className={styles.introTitle}>
                {renderTitleLines(messages.introTitle, messages.introTitleMarker)}
              </h2>
            </div>
          </div>

          <ol className={styles.eras}>
            {eras.map((era, i) => (
              <li key={era.period} className={styles.era} data-history-set>
                <span className={styles.photoSlot}>
                  <SlotPhoto photo={ERA_PHOTOS[i]} />
                </span>

                <span className={styles.node} aria-hidden />

                <div className={styles.copy}>
                  <p className={styles.period} lang="en" data-history-line>
                    {era.period}
                  </p>
                  <h3 className={styles.eraTitle} data-history-line>
                    {era.title}
                  </h3>
                  {/* 시안은 인용과 발화자가 **한 줄**이고 박스가 글자 폭에 붙는다 */}
                  <blockquote className={styles.quote} data-history-line>
                    <p>&ldquo;{era.quote}&rdquo;</p>
                    {" - "}
                    <cite>{era.quoteAuthor}</cite>
                  </blockquote>
                  <ul className={styles.points}>
                    {era.points.map((point) => (
                      <li key={point} data-history-point>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>

          {/**
           * ## 물레방아 — 사진 5장이 **하나의 원**에 박혀 함께 돈다
           *
           * 처음엔 사진을 각 시대 `<li>` 안에 두고 지나갈 때마다 따로 기울였다.
           * 그런데 레퍼런스는 판들이 제각각 도는 게 아니라 **한 바퀴의 살**이라,
           * 앞 판이 올라가면 뒤 판이 아래에서 따라 올라온다. 그러려면 다섯 장이
           * 같은 컨테이너에 있어야 해서 사진을 여기로 모았다.
           *
           * 세로 열 전체를 덮는 절대 배치 컬럼 안에서 `sticky` 로 고정한다.
           * GSAP `pin` 을 쓰지 않는 이유: pin 은 pin-spacer 를 만들고, 이 프로젝트에서
           * 그게 겹쳐 쌓여 섹션이 통째로 밀린 적이 있다(히어로/모바일). sticky 는
           * 스페이서를 만들지 않아 그 사고가 구조적으로 불가능하다.
           */}
          <div className={styles.wheelColumn} aria-hidden>
            <div className={styles.wheel} data-history-wheel>
              {WHEEL_PHOTOS.map((photo) => (
                <div key={photo.src} className={styles.wheelItem} data-history-spoke>
                  <div className={styles.photoCard} data-variant={photo.variant}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 카드 크기에 맞춘 컷이라 리사이즈 이점이 없다 */}
                    <img
                      className={styles.photoFill}
                      src={photo.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 모바일 전용 사진 — PC 의 물레방아를 대신한다.
 *
 * 물레방아(`.wheelColumn`)는 뷰포트 중앙에 `sticky` 로 붙는 100vh 컨테이너다.
 * 좌우 2단인 PC 에서는 사진이 왼쪽 절반, 카피가 오른쪽 절반이라 서로 안 겹친다.
 * 그런데 모바일은 1단이라 같은 자리를 두고 다투게 되고, 스크롤 축도 달라서
 * (사진은 화면 중앙 고정 / 카피는 그냥 흐름) 둘이 어긋난 채 겹쳐 읽힌다.
 * 그래서 **모바일에서는 바퀴를 끄고** 원래 그리드 자리에 사진을 그대로 놓는다.
 *
 * 같은 URL 이라 브라우저 캐시가 한 번만 받아 온다. 바퀴 쪽 `<img>` 는
 * `aria-hidden` 컨테이너 안이므로 대체 텍스트는 이쪽이 갖는다.
 */
function SlotPhoto({
  photo,
}: {
  photo: { src: string; alt: string; variant?: "intro" } | undefined;
}) {
  if (!photo) return null;
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- 카드 크기에 맞춘 컷이라 리사이즈 이점이 없다 */
    <img
      className={styles.slotPhoto}
      data-variant={photo.variant}
      src={photo.src}
      alt={photo.alt}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * 헤드라인을 **줄 단위**로 쪼개고, 강조 어절만 시안의 선택 커서 마크로 감싼다.
 *
 * 줄을 나누는 이유는 모션 때문이다 — 시안 주석(2:1990)이 요구하는 "왼쪽에서
 * 오른쪽으로 텍스트 생성"은 줄마다 따로 열려야 그렇게 읽힌다. 한 덩어리를
 * 통째 클립하면 두 줄이 동시에 열려 커튼이 된다.
 *
 * 꾸밈은 전역 `.title-mark`(2:1993) 다 — 옅은 파랑 바탕 + 좌우 2px 바 +
 * 왼쪽 위·오른쪽 아래 점. 예전에 쓰던 `.marker`(형광펜 밑줄)는 시안에 없다.
 */
function renderTitleLines(text: string, marker: string) {
  return text.split("\n").map((line, i) => (
    <span key={i} className={styles.titleLine} data-history-line>
      {renderWithMarker(line, marker)}
    </span>
  ));
}

/** 강조 어절 하나를 선택 커서 마크로 감싼다. 없으면 원문 그대로. */
function renderWithMarker(text: string, marker: string) {
  if (!marker || !text.includes(marker)) return text;
  const [before, ...rest] = text.split(marker);
  return (
    <>
      {before}
      <span className="title-mark" data-history-marker>
        {marker}
      </span>
      {rest.join(marker)}
    </>
  );
}
