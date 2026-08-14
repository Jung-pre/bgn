"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SNS_LINKS } from "@/shared/config/nav";
import type { FooterMessages } from "@/shared/i18n/messages";
import styles from "./footer-contact-section.module.css";

/**
 * 컨택트 + 푸터 — 시안 p1_23 / p4_20~21.
 *
 * 지점 전환 탭(잠실 / 부산)이 있고, 선택에 따라 주소·진료시간이 바뀐다.
 * 시안에 지도 임베드는 **없다** — 주소 텍스트만 있다. 지도를 넣을지는 확인 필요.
 *
 * 이 컴포넌트는 features 가 아니라 layout 레벨에 두는 게 맞을 수도 있다
 * (모든 페이지 공통이라면). 지금은 메인 전용 섹션으로 두고,
 * 서브페이지가 생기면 `src/components/footer/` 로 승격할 것.
 */
export interface FooterContactSectionProps {
  messages: FooterMessages;
}

export function FooterContactSection({ messages }: FooterContactSectionProps) {
  const [branchId, setBranchId] = useState(messages.branches[0]?.id ?? "");
  const branch = messages.branches.find((b) => b.id === branchId) ?? messages.branches[0];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* 기획안 p30 — 지점 소개 카피 2단락. 시안에는 이 문구가 없고
            기획안에만 있다. 위치는 컨택트 블록 위가 자연스럽다. */}
        {messages.intro.length > 0 ? (
          <div className={styles.intro} data-reveal-item>
            {messages.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 12)} className={styles.introText}>
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}

        <ul className={styles.snsList}>
          {SNS_LINKS.map((s) => (
            <li key={s.id}>
              <a href={s.href || "#"} className={styles.snsItem} aria-label={s.label}>
                <span aria-hidden>{s.label.slice(0, 1)}</span>
              </a>
            </li>
          ))}
        </ul>

        <a href={`tel:${messages.tel}`} className={styles.tel}>
          {messages.tel}
        </a>
        <p className={styles.closedNotice}>{messages.closedNotice}</p>

        {/* 지점 전환 탭 — 주소·진료시간이 함께 바뀐다 */}
        <div className={styles.branchTabs} role="tablist">
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

        <dl className={styles.hours}>
          {branch?.hours.map((h) => (
            <div key={h.label} className={styles.hoursRow}>
              <dt>{h.label}</dt>
              <dd>{h.value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.hoursNote}>{messages.hoursNote}</p>
        {branch?.address ? <address className={styles.address}>{branch.address}</address> : null}

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

        <p className={styles.copyright} lang="en">
          {messages.copyright}
        </p>
      </div>
    </footer>
  );
}
