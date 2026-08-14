"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SNS_LINKS } from "@/shared/config/nav";
import type { FooterMessages } from "@/shared/i18n/messages";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import styles from "./footer-contact-section.module.css";

/**
 * 컨택트 + 푸터 — 시안 PC `2:2901` (1920×792) / 모바일 `2:5207` (375×853).
 *
 * 시안 구조는 3단이다.
 *   1) 우상단 SNS 아이콘 4개 (50×50 라운드 사각 아웃라인)
 *   2) 중앙 컨택트 블록  — 대표번호(100px) → 휴진 안내 → 지점 탭 → 진료시간
 *   3) 하단 1760px 바   — 좌: 약관 링크 + 사업자정보 / 우: 로고 + 카피라이트
 *
 * ⚠️ 기획안 p30 의 "지점 소개 카피 2단락"(`messages.intro`)은 **시안 푸터에 없다.**
 *    우선순위가 Figma > 기획안 이라 렌더하지 않는다. 되살릴 경우 푸터가 아니라
 *    별도 섹션이어야 한다(현재 위치에 넣으면 푸터 높이가 시안의 2배가 된다).
 *
 * 지도 임베드도 시안에는 없다 — 주소는 하단 사업자정보 줄의 텍스트뿐이다.
 */
export interface FooterContactSectionProps {
  messages: FooterMessages;
}

export function FooterContactSection({ messages }: FooterContactSectionProps) {
  const [branchId, setBranchId] = useState(messages.branches[0]?.id ?? "");
  const branch = messages.branches.find((b) => b.id === branchId) ?? messages.branches[0];
  const sectionRef = useSectionReveal<HTMLElement>({ start: "top 90%" });

  /* 시안은 "일요일 휴진 │ 공휴일 정상 진료(…)" 로 세로 구분선을 둔 두 덩어리다.
     사전 원문이 파이프 하나로 이어져 있어 여기서 쪼갠다. */
  const notices = messages.closedNotice
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <footer className={styles.footer} ref={sectionRef}>
      {/* 시안 2:3005 / 2:2903 / 2:2902 — 얇은 원형 라인 3개.
          배경의 와이어프레임 건물 일러스트는 이미지 에셋이라 여기서는 뺐다. */}
      <div className={styles.decor} aria-hidden>
        <span className={styles.ringLarge} />
        <span className={styles.ringMid} />
        <span className={styles.ringSmall} />
      </div>

      <div className={styles.inner}>
        <ul className={styles.snsList} data-reveal-item>
          {SNS_LINKS.map((s) => (
            <li key={s.id}>
              <a
                href={s.href || "#"}
                className={styles.snsItem}
                aria-label={s.label}
                target={s.href ? "_blank" : undefined}
                rel={s.href ? "noreferrer" : undefined}
              >
                <SnsIcon id={s.id} />
              </a>
            </li>
          ))}
        </ul>

        <div className={styles.info}>
          <div className={styles.contact} data-reveal-item>
            {/* 시안: Poppins Medium 100px / 자간 -3%. 대시 좌우가 벌어져 있다. */}
            <a href={`tel:${messages.tel}`} className={styles.tel}>
              {messages.tel.replace(/-/g, " - ")}
            </a>
            <p className={styles.closedNotice}>
              {notices.map((text, i) => (
                <span key={text} className={styles.noticePart}>
                  {i > 0 ? <span className={styles.noticeDivider} aria-hidden /> : null}
                  {text}
                </span>
              ))}
            </p>
          </div>

          {/* 지점 전환 탭 — 주소·진료시간이 함께 바뀐다 */}
          <div className={styles.branchTabs} role="tablist" data-reveal-item>
            {messages.branches.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={b.id === branchId}
                className={clsx(styles.branchTab, b.id === branchId && styles.branchTabActive)}
                onClick={() => setBranchId(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className={styles.hoursBlock} data-reveal-item>
            <dl className={styles.hours}>
              {branch?.hours.map((h) => (
                <div key={h.label} className={styles.hoursRow}>
                  <dt>{h.label}</dt>
                  <dd>{h.value}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.hoursNote}>{messages.hoursNote}</p>
          </div>
        </div>

        <div className={styles.bottom} data-reveal-item>
          <div className={styles.bottomLeft}>
            <nav className={styles.policyNav} aria-label="약관 및 정책">
              <ul className={styles.policyList}>
                {messages.policyLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={clsx(styles.policyLink, l.strong && styles.policyStrong)}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <dl className={styles.business}>
              {messages.business.map((b) => (
                <div key={b.label} className={styles.businessRow}>
                  <dt>{b.label}</dt>
                  <dd>{b.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.bottomRight}>
            {/* 시안 2:2968 은 199×30 벡터 로고다. SVG 에셋이 없어 텍스트로 대체. */}
            <p className={styles.logo}>
              <span className={styles.logoMark} lang="en">
                BGN
              </span>
              <span className={styles.logoName}>밝은눈안과병원</span>
            </p>
            <p className={styles.copyright} lang="en">
              {messages.copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * SNS 아이콘 — 시안은 브랜드 로고 4종(유튜브/인스타그램/카카오톡/페이스북)이다.
 * 에셋 파일이 없어 GNB 와 같은 방식으로 인라인 패스를 직접 그린다.
 */
function SnsIcon({ id }: { id: string }) {
  const common = { viewBox: "0 0 24 24", width: "100%", height: "100%", "aria-hidden": true };

  if (id === "youtube") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M23.5 6.9a3 3 0 0 0-2.1-2.1C19.5 4.3 12 4.3 12 4.3s-7.5 0-9.4.5A3 3 0 0 0 .5 6.9C0 8.8 0 12 0 12s0 3.2.5 5.1a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.1.5-5.1s0-3.2-.5-5.1ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
      </svg>
    );
  }
  if (id === "instagram") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "kakao") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.8 4.3 6.1l-1.1 4c-.1.3.3.6.6.4l4.7-3.1c.2 0 .5 0 .7 0 5.1 0 9.2-3.3 9.2-7.4S17.1 3 12 3Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor">
      <path d="M13.6 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.5H7.6v3.2h2.9V21h3.1Z" />
    </svg>
  );
}
