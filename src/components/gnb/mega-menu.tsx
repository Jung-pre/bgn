"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import clsx from "clsx";
import { MOBILE_EXTRA_NAV, NAV_TREE, SNS_LINKS } from "@/shared/config/nav";
import type { Locale } from "@/shared/config/i18n";
import { useScrollLock } from "@/shared/lib/use-scroll-lock";
import styles from "./mega-menu.module.css";

/**
 * 전체 메뉴 오버레이.
 *
 * 시안 구조 (PC p1_02 / 모바일 p4_04 — 같은 구조를 폭만 줄여 재사용):
 *   좌측 패널: 롯데월드타워 사진 + 대표번호 + SNS + 주소
 *   우측 패널: 1뎁스 라벨 + 2뎁스 항목 최대 4칼럼, 행마다 구분선
 * 모바일은 좌 1뎁스 / 우 2뎁스 2칼럼으로 압축되고, 활성 1뎁스가
 * 블루→퍼플 그라데이션 풀블리드 바로 표시된다.
 *
 * ⚠️ 이 오버레이 내부는 자체 스크롤 영역이다. Lenis 가 wheel 을 가로채므로
 *    `data-lenis-prevent` 를 반드시 달아야 한다.
 */
export interface MegaMenuProps {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  closeLabel: string;
}

export function MegaMenu({ locale, open, onClose, closeLabel }: MegaMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  /** ESC 로 닫기 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = [...NAV_TREE, ...MOBILE_EXTRA_NAV];
  const withLocale = (href: string) => `/${locale}${href}`;

  return (
    <div
      className={clsx(styles.root, open && styles.rootOpen)}
      aria-hidden={!open}
      role="dialog"
      aria-modal={open}
      aria-label="전체 메뉴"
    >
      <button type="button" className={styles.backdrop} aria-label={closeLabel} onClick={onClose} />

      <div ref={panelRef} className={styles.panel}>
        {/* 좌측 브랜드 패널 — 모바일에서는 숨김 */}
        <aside className={styles.brandPanel}>
          <p className={styles.brandMark} lang="en">
            BGn
          </p>
          <div className={styles.brandContact}>
            <a href="tel:1600-5770" className={styles.brandTel}>
              1600-5770
            </a>
            <p className={styles.brandAddress}>
              서울특별시 송파구 올림픽로 300
              <br />
              롯데월드타워 11층
            </p>
            <ul className={styles.snsList}>
              {SNS_LINKS.map((s) => (
                <li key={s.id}>
                  <a href={s.href || "#"} className={styles.snsItem} aria-label={s.label}>
                    <span aria-hidden>{s.label.slice(0, 1)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 우측 메뉴 — 자체 스크롤. Lenis 가로채기 해제 필수 */}
        <nav className={styles.menuPanel} data-lenis-prevent aria-label="전체 메뉴 목록">
          <ul className={styles.menuList}>
            {items.map((item) => (
              <li key={item.href} className={styles.menuRow}>
                <Link href={withLocale(item.href)} className={styles.depth1}>
                  {item.label[locale]}
                </Link>
                {item.children ? (
                  <ul className={styles.depth2List}>
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link href={withLocale(child.href)} className={styles.depth2}>
                          {child.label[locale]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
