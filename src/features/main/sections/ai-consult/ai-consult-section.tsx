"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import { VideoSlot } from "@/components/video-slot/video-slot";
import type { AiConsultSectionMessages } from "@/shared/i18n/messages";
import styles from "./ai-consult-section.module.css";

/**
 * AI 정밀 검사 상담 신청 — Figma `8:1078` (기본) / `8:1118` (확대).
 *   (구 노드 ID: 2:1204 / 2:1244)
 *
 * ## 검수에서 뒤집힌 근거 (중요)
 * 직전 구현은 이 섹션을 "이 사이트에서 유일한 중간톤(슬레이트) 블록"으로 칠하고
 * 있었다. **틀렸다.** 그 톤은 확대 상태 `2:1244` 의 딤 레이어
 * `rgba(10,32,72,0.5) + blur 6px` 다. 기본 상태 `2:1204` 는 흰 배경 + 다크 텍스트 +
 * 하단 파란 도트 메시 웨이브다. 그래서:
 *   · 섹션 배경 → 흰색, 텍스트 → #171717/#3d3d3d
 *   · 슬레이트 톤 → `.dim` 오버레이로 이동
 *
 * ## 우측 762×762
 * `2:1242` `magnific_the-object-floats-slowly-…` — 주석 원문:
 *   "영상 삽입 예정 / 해당 영역 클릭시 하단 상담신청 Fade in"
 * 3D 유리 `B` 를 만들 자리가 아니라 **영상 슬롯**이다. 클릭하면 딤 위로 폼이
 * 페이드인하는 확대 상태(`8:1118`)로 전환된다.
 *
 * 영상은 아직 없지만 시안의 그 프레임(유리 재질 B 로고)이 스틸로 들어왔다 →
 * `VideoSlot` 의 `poster` 로 넣는다. VideoSlot 은 `src` 없이 `poster` 만으로
 * <img> 를 렌더하므로, 나중에 영상이 오면 `src` 한 줄만 추가하면 된다.
 *
 * 확대 상태에서 폼을 **복제하지 않는다.** 같은 DOM 에 클래스만 얹어 위치를 바꾼다.
 * 복제하면 입력값·동의 체크가 두 벌로 갈라진다.
 *
 * 제출 로직은 아직 없다. API 가 정해지면 server action 또는 route handler 로 붙인다.
 */

export interface AiConsultSectionProps {
  messages: AiConsultSectionMessages;
}

/** 확대 상태 열기/닫기 라벨. i18n 사전에 항목이 없어 임시 리터럴 — 문구 추가 필요(보고 참조). */
const EXPAND_LABEL = "상담 신청 크게 보기";
const CLOSE_LABEL = "상담 신청 닫기";

export function AiConsultSection({ messages }: AiConsultSectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();

  const [agreed, setAgreed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const close = useCallback(() => {
    setExpanded(false);
  }, []);

  // 확대 상태는 딤이 화면을 덮으므로 Esc 탈출구가 없으면 갇힌다.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  return (
    <section
      ref={sectionRef}
      className={clsx(styles.section, expanded && styles.sectionExpanded, "blend-top")}
      aria-labelledby="consult-title"
      /* 앞 섹션(AI 정밀 검사 시스템) 끝 색 실측값 — 경계 이음매를 지운다 */
      style={{ "--blend-from": "rgb(232, 240, 251)" } as React.CSSProperties}
    >
      {/* 8:1078 하단 도트 메시 웨이브 — `/main/img_05_bg01.webp`. 장식이라 CSS 배경으로 깐다
          (DOM <img> 로 두면 alt="" 요소가 하나 더 늘 뿐 얻는 게 없다). */}
      <span className={styles.mesh} aria-hidden />

      {/* 딤 자체가 닫기 트리거다. 닫혀 있을 땐 disabled 로 포커스 순서에서 빼되
          DOM 에 남겨 둔다 — 언마운트하면 페이드아웃이 안 보인다. */}
      <button
        type="button"
        className={styles.dim}
        disabled={!expanded}
        aria-label={CLOSE_LABEL}
        onClick={close}
      />

      <div className={styles.inner}>
        <div
          className={clsx(styles.copy, expanded && styles.copyExpanded)}
          data-reveal-item
          onClick={
            expanded
              ? (e) => {
                  /* 폼·타이틀이 아니라 딤처럼 보이는 빈 자리를 눌렀을 때만 닫는다.
                     `.copyExpanded` 가 inset:0 이라 딤 버튼보다 위에 깔려 클릭을 가로챈다. */
                  if (e.target === e.currentTarget) close();
                }
              : undefined
          }
        >
          <p className={styles.eyebrow} lang="en">
            {messages.eyebrow}
          </p>
          <h2 id="consult-title" className={styles.title}>
            {renderWithMark(messages.title, messages.titleMarker)}
          </h2>
          {messages.description ? <p className={styles.desc}>{messages.description}</p> : null}

          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              // TODO: 제출 API 연동
            }}
          >
            <div className={styles.fields}>
              <label className={styles.field}>
                <span className="sr-only">이름</span>
                <PersonIcon />
                <input type="text" name="name" placeholder={messages.namePlaceholder} required />
              </label>
              <label className={styles.field}>
                <span className="sr-only">연락처</span>
                <PhoneIcon />
                <input
                  type="tel"
                  name="phone"
                  inputMode="tel"
                  placeholder={messages.phonePlaceholder}
                  required
                />
              </label>

              <label className={styles.agree}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                />
                <span className={styles.checkbox} aria-hidden>
                  <CheckIcon />
                </span>
                <span>{messages.agreement}</span>
                <Link href="/policy/privacy" className={styles.agreeLink}>
                  [{messages.agreementLink}]
                </Link>
              </label>
            </div>

            <button type="submit" className={styles.submit} disabled={!agreed}>
              {messages.submit}
              <ArrowIcon />
            </button>
          </form>
        </div>

        {/* 2:1242 — 762×762 영상 슬롯. 주석: "해당 영역 클릭시 하단 상담신청 Fade in" */}
        <button
          type="button"
          className={styles.media}
          data-reveal-item
          aria-expanded={expanded}
          aria-label={EXPAND_LABEL}
          onClick={() => {
            setExpanded(true);
          }}
        >
          {/* 2번 영상 — 유리 재질 B 가 천천히 떠 있는 1:1 클립.
              시안 주석이 "영상 삽입 예정" 이던 자리다. 정사각(1440²)으로 왔고
              표시 크기가 762px 라 1080² 로 다시 떠서 878KB(원본 7.8MB)로 줄였다.
              poster 는 그대로 둔다 — 바이트가 도착하기 전 첫 프레임을 채운다. */}
          <VideoSlot
            decorative
            src="/main/video_main02.mp4"
            srcWebm="/main/video_main02.webm"
            poster="/main/img_05_logo-glass01.webp"
            className={styles.objectVideo}
          />
        </button>
      </div>

      <button
        type="button"
        className={styles.close}
        disabled={!expanded}
        onClick={close}
        aria-label={CLOSE_LABEL}
      >
        <CloseIcon />
      </button>
    </section>
  );
}

/**
 * 헤드라인 마커. Figma 2:1216 은 형광펜 밑줄(공용 `.marker`)이 아니라
 * **옅은 블루 박스 + 좌우 세로 바**(2:1210 Group 2432)다.
 */
function renderWithMark(text: string, marker?: string) {
  if (!marker || !text.includes(marker)) return text;
  const [before, ...rest] = text.split(marker);
  return (
    <>
      {before}
      <span className="title-mark">{marker}</span>
      {rest.join(marker)}
    </>
  );
}

/* ── 아이콘 (2:1222 person / 2:1227 tel / 2:1232 check / 2:1239 arrow) ─────
   원본은 SVG 에셋인데 저장소에 없어서 같은 크기(24)·같은 굵기로 다시 그렸다. */

function PersonIcon() {
  return (
    <svg className={styles.fieldIcon} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className={styles.fieldIcon} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M5.5 3.8h3l1.5 3.7-2 1.4a11.5 11.5 0 0 0 5.1 5.1l1.4-2 3.7 1.5v3c0 .9-.7 1.7-1.7 1.7A14.8 14.8 0 0 1 3.8 5.5c0-1 .8-1.7 1.7-1.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden focusable="false">
      <path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M4.5 12h14m-5.5-5.5L18.5 12 13 17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
