"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import type { Locale } from "@/shared/config/i18n";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import { useScrollLock } from "@/shared/lib/use-scroll-lock";
import { GNB_NAV, GNB_SNS } from "./gnb-nav";
import { CloseIcon, SnsSymbol } from "./icons";
import { LocaleMenu } from "./locale-menu";
import styles from "./mega-menu.module.css";

/**
 * 전체메뉴 오버레이 — 시안 Figma `8:540` (1920×920).
 *
 * 시안 실측 구조:
 *   - 좌 480px(=25%) 브랜드 패널: 흰 로고(상단 80) / "BGn" 세리프 워터마크(중앙) /
 *     `전화 1600-5770` / **브랜드 컬러 SNS 원형 배지 4개** / 주소 1줄
 *   - 우 1440px 메뉴 패널: 반투명 화이트 + 블러(뒤 히어로가 옅게 비친다) 위에
 *     `대분류 1열 + 소분류 4열` 그리드. 행마다 하단 구분선. GNB pill 은 숨긴다.
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
   * 수정요청 p6 — 모바일 전체메뉴는 PC 를 좁힌 형태가 **아니다**(`48:3730`).
   * PC 는 대분류 1열 + 소분류 4열이 한 화면에 다 펼쳐지는 그리드지만,
   * 모바일은 **좌측 1depth 세로 리스트 + 우측 2depth 패널**의 2단 구조이고
   * 좌측에서 고른 항목의 소분류만 우측에 뜬다. 그래서 마크업 자체를 분기한다.
   */
  const isMobile = useIsMobileLayout();
  const [activeHref, setActiveHref] = useState<string>(GNB_NAV[0]?.href ?? "");
  const activeItem = GNB_NAV.find((item) => item.href === activeHref) ?? GNB_NAV[0];

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
        {isMobile ? (
          /* ── 모바일 전체메뉴 (`48:3730`) ─────────────────────────────────── */
          <div className={styles.moPanel}>
            {/* 헤더 — 로고 168×30 + ✕ 만. 시안에는 지구본이 없다(`48:3771`) */}
            <div className={styles.moHeader}>
              <Link href={`/${locale}`} className={styles.moLogo} aria-label="BGN 밝은눈안과 홈">
                <Image
                  src="/main/logo.png"
                  alt=""
                  width={168}
                  height={30}
                  className={styles.moLogoImage}
                  sizes="168px"
                />
              </Link>
              <button
                type="button"
                className={styles.closeButton}
                aria-label={closeLabel}
                onClick={onClose}
              >
                <CloseIcon />
              </button>
            </div>

            <div className={styles.moBody}>
              {/* 좌측 1depth — 선택된 항목만 브랜드 그라디언트 + 흰 글씨 */}
              <div className={styles.moDepth1Col} data-lenis-prevent>
                <ul className={styles.moDepth1List}>
                  {GNB_NAV.map((item) => {
                    const isActive = item.href === activeItem?.href;
                    return (
                      <li key={item.href}>
                        <button
                          type="button"
                          className={clsx(
                            styles.moDepth1,
                            isActive && styles.moDepth1Active,
                          )}
                          aria-current={isActive || undefined}
                          onClick={() => setActiveHref(item.href)}
                        >
                          {item.label[locale]}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* 흰 배지 + 검정 심볼 (`48:3752`) — PC 좌측 패널과 색 규칙이 반대다 */}
                <ul className={styles.moSnsList}>
                  {GNB_SNS.map((sns) => (
                    <li key={sns.id}>
                      <a
                        href={sns.href}
                        className={styles.moSnsItem}
                        aria-label={sns.label}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <SnsSymbol id={sns.id} tone="mono" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 우측 2depth */}
              <ul className={styles.moDepth2List} data-lenis-prevent>
                {(activeItem?.children ?? []).map((child) => (
                  <li key={child.href}>
                    <Link href={withLocale(child.href)} className={styles.moDepth2}>
                      {child.label[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
          {/* --- 좌측 브랜드 패널 (≤768 숨김) --- */}
          <aside className={styles.brandPanel}>
            {/* 수정요청 p5: 로고는 텍스트 조합이 아니라 이미지(`48:633` 202×36 흰색) */}
            <Link href={`/${locale}`} className={styles.brandLogo} aria-label="BGN 밝은눈안과 홈">
              <Image
                src="/main/logo-white.png"
                alt=""
                width={202}
                height={36}
                className={styles.brandLogoImage}
                sizes="202px"
              />
            </Link>

            <div className={styles.brandContact}>
              <p className={styles.brandTelRow}>
                <span className={styles.brandTelLabel}>전화</span>
                <a href="tel:1600-5770" className={styles.brandTel}>
                  1600-5770
                </a>
              </p>

              {/* 배지 색이 유튜브만 흰색이다(`48:664`) — 나머지 셋은 blackbg-50 */}
              <ul className={styles.snsList}>
                {GNB_SNS.map((sns) => (
                  <li key={sns.id}>
                    <a
                      href={sns.href}
                      className={clsx(styles.snsItem, sns.id === "youtube" && styles.snsItemLight)}
                      aria-label={sns.label}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <SnsSymbol id={sns.id} />
                    </a>
                  </li>
                ))}
              </ul>

              <span className={styles.brandDivider} aria-hidden />

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
              {/**
               * 구분선을 `border-bottom` 이 아니라 **형제 항목**으로 넣는다.
               * 시안(`48:703`)은 행–48–선–48–행 이라 선이 두 행 사이 정중앙에 온다.
               * border-bottom 이면 선이 위 행에 붙고 아래로만 48 이 생겨 어긋난다.
               * 마지막 행 뒤에는 선이 없다.
               */}
              <ul className={styles.menuList}>
                {GNB_NAV.map((item, i) => (
                  <Fragment key={item.href}>
                    {i > 0 ? <li className={styles.menuDivider} aria-hidden /> : null}
                    <li className={styles.menuRow}>
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
                  </Fragment>
                ))}
              </ul>
            </nav>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
