"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import { VideoSlot } from "@/components/video-slot/video-slot";
import type { AiConsultSectionMessages } from "@/shared/i18n/messages";
import styles from "./ai-consult-section.module.css";

/**
 * AI 정밀 검사 상담 신청 — 시안 p1_07 하단 ~ p1_08 / p4_07.
 *
 * 이 사이트에서 **유일하게 중간톤(슬레이트 블루그레이)으로 떨어지는 블록**이다.
 * 라이트 일색인 페이지에서 폼에 시선을 고정시키려는 장치라 톤을 밝히지 말 것.
 *
 * ⚠️ 우측 762×762 는 **3D 가 아니라 영상**이다. Figma `2:1242` 는 fill 이
 * 전혀 없는 빈 프레임이고, 주석이 이렇게 붙어 있다:
 *
 *   "영상 삽입 예정 / 해당 영역 클릭시 하단 상담신청 Fade in"
 *
 * 노드 이름도 `magnific_the-object-floats-slowly-...` 다 — 부유하는 오브젝트 영상.
 * 기획안에는 3D 유리 다면체 목업이 있었지만 **시안이 최신이고 영상이 맞다.**
 *
 * "클릭 시 폼 Fade in" 의 확대 상태는 별도 프레임 `2:1244` 로 그려져 있다
 * (딤 rgba(10,32,72,0.5) + blur 6px 위에 폼이 중앙 대형 배치). 아직 미구현.
 *
 * 제출 로직은 아직 없다. API 가 정해지면 server action 또는 route handler 로
 * 붙이고, 여기서는 상태만 관리한다.
 */

export interface AiConsultSectionProps {
  messages: AiConsultSectionMessages;
}

export function AiConsultSection({ messages }: AiConsultSectionProps) {
  const sectionRef = useSectionReveal<HTMLElement>();
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const [agreed, setAgreed] = useState(false);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="consult-title">
      <div className={styles.inner}>
        <div className={styles.copy} data-reveal-item>
          <p className={styles.eyebrow} lang="en">
            {messages.eyebrow}
          </p>
          <h2 id="consult-title" className={styles.title}>
            {renderWithMarker(messages.title, messages.titleMarker)}
          </h2>
          {messages.description ? <p className={styles.desc}>{messages.description}</p> : null}

          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              // TODO: 제출 API 연동
            }}
          >
            <label className={styles.field}>
              <span className="sr-only">이름</span>
              <input type="text" name="name" placeholder={messages.namePlaceholder} required />
            </label>
            <label className={styles.field}>
              <span className="sr-only">연락처</span>
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
              <span>{messages.agreement}</span>
              <Link href="/policy/privacy" className={styles.agreeLink}>
                [{messages.agreementLink}]
              </Link>
            </label>

            <button type="submit" className={styles.submit} disabled={!agreed}>
              {messages.submit} <span aria-hidden>→</span>
            </button>
          </form>
        </div>

        {/* Figma 2:1242 — 762×762 영상 슬롯 */}
        <div ref={canvasHostRef} className={styles.canvasHost}>
          <VideoSlot decorative className={styles.objectVideo} />
        </div>
      </div>
    </section>
  );
}

function renderWithMarker(text: string, marker?: string) {
  if (!marker || !text.includes(marker)) return text;
  const [before, ...rest] = text.split(marker);
  return (
    <>
      {before}
      <span className="marker">{marker}</span>
      {rest.join(marker)}
    </>
  );
}
