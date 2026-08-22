"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { Locale } from "@/shared/config/i18n";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import type { GnbMessages } from "@/shared/i18n/messages";
import { GNB_INLINE_NAV } from "./gnb-nav";
import { BurgerIcon, CloseIcon } from "./icons";
import { LocaleMenu } from "./locale-menu";
import { MegaMenu } from "./mega-menu";
import styles from "./gnb.module.css";

/**
 * 플로팅 pill GNB — 시안 `8:283` / `8:367` / `8:3025`.
 *
 * 시안 특징 (일반적인 sticky 헤더와 다른 점):
 *  - 화면 상단에 **붙지 않는다.** 좌우 40 / 상단 24 여백을 두고 떠 있는 캡슐.
 *  - 배경 위에 떠 있으므로 다크 섹션(Web blog)에서도 그대로 흰색이다 →
 *    shin 처럼 섹션 톤에 따라 색을 바꾸는 로직이 **필요 없다.**
 *  - PC 에도 햄버거가 있다. 인라인 8메뉴 + 전체 메가메뉴 병존 구조.
 *  - 브랜드 필름 섹션(p1_04)에서만 전부 숨는다 → `data-gnb-hide` 속성으로 제어.
 *
 * 스크롤 방향으로 숨김/표시. rAF 로 throttle 해서 프레임당 1회만 계산한다.
 */

/** 이 위쪽에서는 방향과 무관하게 항상 보인다. */
const ALWAYS_VISIBLE_TOP_PX = 48;

/**
 * 숨김/표시 히스테리시스 — **한 프레임 델타가 아니라 같은 방향 누적 이동거리**로 판단한다.
 *
 * 예전 구현은 "이번 프레임에 6px 이상 내려갔으면 숨긴다"였다. 스무스 스크롤이 감속하며
 * 부호가 한두 프레임 흔들리거나, 내부 스크롤 영역 위에서 휠이 네이티브로 새어 페이지가
 * 한 번에 튀면 그때마다 GNB 가 나타났다 사라졌다 했다. 누적으로 바꾸면 그 정도 흔들림은
 * 임계값을 못 넘긴다.
 *
 * 내려갈 때는 둔하게, 올라올 때는 민감하게 — 메뉴를 찾는 동작이 위로 굴리는 것이라
 * 복귀가 늦으면 답답하다.
 */
const HIDE_AFTER_PX = 96;
const SHOW_AFTER_PX = 40;

export interface GnbProps {
  locale: Locale;
  messages: GnbMessages;
}

export function Gnb({ locale, messages }: GnbProps) {
  const pathname = usePathname();
  const isMobile = useIsMobileLayout();

  const [isHidden, setIsHidden] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [openDepth1, setOpenDepth1] = useState<string | null>(null);

  const lastYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  /** 같은 방향으로 누적된 이동거리(px). 방향이 바뀌면 버린다. */
  const travelRef = useRef(0);

  /** 스크롤 방향 기반 숨김. 최상단 근처에서는 항상 보인다. */
  const evaluate = useCallback(() => {
    rafRef.current = null;
    const y = window.scrollY || 0;
    const delta = y - lastYRef.current;
    lastYRef.current = y;

    if (y <= ALWAYS_VISIBLE_TOP_PX) {
      travelRef.current = 0;
      setIsHidden(false);
      return;
    }
    if (delta === 0) return;

    // 방향이 바뀌면 누적을 버린다 — "내려가다 살짝 되올린" 정도로는 안 뒤집히게.
    if (Math.sign(delta) !== Math.sign(travelRef.current)) travelRef.current = 0;
    travelRef.current += delta;

    if (travelRef.current > HIDE_AFTER_PX) {
      travelRef.current = 0;
      setIsHidden(true);
    } else if (travelRef.current < -SHOW_AFTER_PX) {
      travelRef.current = 0;
      setIsHidden(false);
    }
  }, []);

  useEffect(() => {
    /* 새로고침으로 페이지 중간에서 복원되면 `lastYRef` 의 초기값 0 과의 차이가
       수천 px 이 되어 첫 스크롤 한 번에 곧바로 숨는다. 구독 전에 현재 위치를 심는다. */
    lastYRef.current = window.scrollY || 0;

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(evaluate);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [evaluate]);

  /**
   * 라우트가 바뀌거나 데스크톱으로 넓어지면 열려 있던 것들을 전부 닫는다.
   *
   * `useEffect` 로 setState 하면 한 프레임 늦게 닫혀서 화면이 한 번 깜빡이고,
   * React Compiler 도 cascading render 로 잡는다(react-hooks/set-state-in-effect).
   * "prop 이 바뀌면 state 를 조정한다"는 렌더 중 조정 패턴이 정석이다.
   * @see https://react.dev/learn/you-might-not-need-an-effect
   */
  const [lastKey, setLastKey] = useState(`${pathname}|${isMobile}`);
  const currentKey = `${pathname}|${isMobile}`;
  if (lastKey !== currentKey) {
    setLastKey(currentKey);
    setIsMegaOpen(false);
    setOpenDepth1(null);
  }

  /**
   * 포커스가 헤더 밖으로 나갈 때만 1뎁스 드롭다운을 닫는다.
   * `onMouseLeave` 만 쓰면 키보드 사용자가 드롭다운을 못 벗어난다.
   */
  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setOpenDepth1(null);
    }
  };

  const withLocale = (href: string) => `/${locale}${href}`;

  return (
    <>
      <header
        className={clsx(styles.header, isHidden && styles.headerHidden)}
        onBlur={handleBlur}
        /* 메가메뉴가 열리면 오버레이가 헤더를 덮는다 — 뒤로 탭이 새지 않게 비활성화 */
        inert={isMegaOpen}
      >
        <div className={styles.pill}>
          <Link href={`/${locale}`} className={styles.logo} aria-label="BGN 밝은눈안과">
            <span className={styles.logoMark} lang="en">
              BGN
            </span>
            <span className={styles.logoText}>밝은눈안과</span>
          </Link>

          {/* PC 인라인 네비 — 1024 이하에서는 CSS 로 숨긴다 */}
          <nav className={styles.nav} aria-label="주 메뉴">
            <ul className={styles.navList}>
              {GNB_INLINE_NAV.map((item) => {
                const open = openDepth1 === item.href;
                return (
                  <li
                    key={item.href}
                    className={styles.navItem}
                    onMouseEnter={() => setOpenDepth1(item.children ? item.href : null)}
                    onMouseLeave={() => setOpenDepth1(null)}
                  >
                    <Link
                      href={withLocale(item.href)}
                      className={clsx(styles.navLink, open && styles.navLinkOpen)}
                      aria-expanded={item.children ? open : undefined}
                      onFocus={() => setOpenDepth1(item.children ? item.href : null)}
                    >
                      {item.label[locale]}
                    </Link>
                    {item.children ? (
                      <ul
                        className={clsx(styles.dropdown, open && styles.dropdownOpen)}
                        inert={!open}
                      >
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={withLocale(child.href)}
                              className={styles.dropdownLink}
                              tabIndex={open ? 0 : -1}
                            >
                              {child.label[locale]}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={clsx(styles.utils, isMegaOpen && styles.utilsHidden)}>
            {/* 8:2310 `Auth Options` — 로그인/구분선/회원가입은 gap 12 로 따로 묶인다 */}
            <div className={styles.auth}>
              <Link href={withLocale("/login")} className={styles.utilLink}>
                {messages.login}
              </Link>
              <span className={styles.utilDivider} aria-hidden />
              <Link href={withLocale("/signup")} className={styles.utilLink}>
                {messages.signup}
              </Link>
            </div>

            <LocaleMenu locale={locale} label={messages.languageLabel} />

            <button
              type="button"
              className={styles.iconButton}
              aria-label={isMegaOpen ? messages.menuClose : messages.menuOpen}
              aria-expanded={isMegaOpen}
              onClick={() => setIsMegaOpen((v) => !v)}
            >
              {isMegaOpen ? <CloseIcon /> : <BurgerIcon />}
            </button>
          </div>
        </div>
      </header>

      <MegaMenu
        locale={locale}
        open={isMegaOpen}
        onClose={() => setIsMegaOpen(false)}
        closeLabel={messages.menuClose}
        loginLabel={messages.login}
        signupLabel={messages.signup}
        languageLabel={messages.languageLabel}
      />
    </>
  );
}
