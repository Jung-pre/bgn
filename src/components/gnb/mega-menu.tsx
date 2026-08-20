"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Locale } from "@/shared/config/i18n";
import { useScrollLock } from "@/shared/lib/use-scroll-lock";
import { GNB_NAV, GNB_SNS } from "./gnb-nav";
import { CloseIcon, SnsIcon } from "./icons";
import { LocaleMenu } from "./locale-menu";
import styles from "./mega-menu.module.css";

/**
 * 전체메뉴 오버레이 — 시안 Figma `8:540` (1920×920).
 *
 * 시안 실측 구조:
 *   - 좌 480px(=25%) 브랜드 패널: 흰 로고(상단 80) / "BGn" 세리프 워터마크(중앙) /
 *     `전화 1600-5770` / **브랜드 컬러 SNS 원형 배지 4개** / 주소 1줄
 *   - 우 1440px 메뉴 패널: 반투명 화이트 + 블러(뒤의 GNB pill 이 비쳐 보인다) 위에
 *     `대분류 1열 + 소분류 4열` 그리드. 행마다 하단 구분선.
 *   - 우상단 유틸(로그인 | 회원가입 / 지구본 / X)은 **GNB 바와 같은 좌표**에 놓인다
 *     → 오버레이가 헤더를 덮으므로 오버레이가 같은 유틸을 다시 그린다.
 *
 * ⚠️ 메뉴 패널은 자체 스크롤 영역이다. Lenis 가 wheel 을 가로채므로
 *    `data-lenis-prevent` 를 반드시 달아야 한다.
 */
export interface MegaMenuProps {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  loginLabel: string;
  signupLabel: string;
  languageLabel: string;
}

/** 포커스 트랩 대상 셀렉터 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MegaMenu({
  locale,
  open,
  onClose,
  closeLabel,
  loginLabel,
  signupLabel,
  languageLabel,
}: MegaMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  /**
   * Esc 닫기 + 포커스 트랩 + 닫힐 때 트리거로 포커스 복귀.
   * 오버레이가 화면 전체를 덮으므로 트랩이 없으면 뒤의 히어로 CTA 로 탭이 빠진다.
   */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    /* 닫기 버튼이 아니라 **패널**에 포커스를 준다.
       버튼에 주면 마우스로 열었을 때도 기본 포커스 링이 사각형으로 남아
       ✕ 가 "빈 네모"처럼 보인다. 패널 포커스는 스크린리더에도 표준 동작이다. */
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const withLocale = (href: string) => `/${locale}${href}`;

  return (
    <div className={clsx(styles.root, open && styles.rootOpen)} inert={!open}>
      {/* 모바일에서만 실제로 보이는 여백 — 클릭하면 닫힌다 */}
      {/* 키보드에는 닫기 버튼과 Esc 가 이미 있으므로 탭 순서에서 뺀다 */}
      <button
        type="button"
        tabIndex={-1}
        className={styles.backdrop}
        aria-label={closeLabel}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="전체 메뉴"
        tabIndex={-1}
      >
        {/* --- 좌측 브랜드 패널 (≤768 숨김) --- */}
        <aside className={styles.brandPanel}>
          <Link href={`/${locale}`} className={styles.brandLogo} aria-label="BGN 밝은눈안과 홈">
            <span className={styles.brandLogoMark} lang="en">
              BGN
            </span>
            <span className={styles.brandLogoText}>밝은눈안과</span>
          </Link>

          <p className={styles.brandMark} aria-hidden lang="en">
            BGn
          </p>

          <div className={styles.brandContact}>
            <p className={styles.brandTelRow}>
              <span className={styles.brandTelLabel}>전화</span>
              <a href="tel:1600-5770" className={styles.brandTel}>
                1600-5770
              </a>
            </p>

            <ul className={styles.snsList}>
              {GNB_SNS.map((sns) => (
                <li key={sns.id}>
                  <a
                    href={sns.href}
                    className={styles.snsItem}
                    aria-label={sns.label}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <SnsIcon id={sns.id} />
                  </a>
                </li>
              ))}
            </ul>

            <p className={styles.brandAddress}>서울특별시 송파구 올림픽로 300 롯데월드타워 11층</p>
          </div>
        </aside>

        {/* --- 우측 메뉴 --- */}
        <div className={styles.menuSide}>
          <div className={styles.topBar}>
            <div className={styles.topBarInner}>
              <Link href={withLocale("/login")} className={styles.topBarLink}>
                {loginLabel}
              </Link>
              <span className={styles.topBarDivider} aria-hidden />
              <Link href={withLocale("/signup")} className={styles.topBarLink}>
                {signupLabel}
              </Link>

              <LocaleMenu locale={locale} label={languageLabel} />

              <button
                type="button"
                className={styles.closeButton}
                aria-label={closeLabel}
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <nav className={styles.menuPanel} data-lenis-prevent aria-label="전체 메뉴 목록">
            <ul className={styles.menuList}>
              {GNB_NAV.map((item) => (
                <li key={item.href} className={styles.menuRow}>
                  <h2 className={styles.depth1Wrap}>
                    <Link href={withLocale(item.href)} className={styles.depth1}>
                      {item.label[locale]}
                    </Link>
                  </h2>
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
                  ) : (
                    <span className={styles.depth2Empty} aria-hidden />
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
