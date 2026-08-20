"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { localeLabels, locales, type Locale } from "@/shared/config/i18n";
import { FlagIcon, GlobeIcon } from "./icons";
import styles from "./locale-menu.module.css";

/**
 * 언어 선택 드롭다운 — 시안 `8:367`.
 *
 * 시안: 지구본 버튼 아래로 **흰 solid 카드**(radius 8 + 그림자)가 열리고,
 * `한국어 / English / 日本語 / 中文` 4행이 **각 언어의 원형 국기**와 함께 세로로 쌓인다.
 * 카드 우측 끝은 지구본이 아니라 **유틸 클러스터(=햄버거) 우측 끝**에 맞는다
 * → `.menu` 의 containing block 을 헤더의 `.utils` 로 두려고 여기서는
 *   position 을 잡지 않는다(부모가 `position: relative` 를 갖는다).
 *
 * 접근성: `aria-haspopup="menu"` + `role="menu"`/`menuitem`,
 * 화살표·Home/End 로버빙 포커스, Esc 닫고 버튼으로 복귀, Tab 이면 닫는다.
 */
export interface LocaleMenuProps {
  locale: Locale;
  label: string;
  /** 메가메뉴 위처럼 어두운/밝은 컨텍스트에 따라 버튼 색을 바꾼다 */
  className?: string;
}

export function LocaleMenu({ locale, label, className }: LocaleMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  /** 열린 직후 어느 항목으로 포커스를 보낼지. 렌더 중 focus 를 부르지 않으려고 ref 로 큐잉한다. */
  const pendingFocusRef = useRef<number | null>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  const focusItem = (index: number) => {
    const list = itemRefs.current.filter(Boolean) as HTMLAnchorElement[];
    if (list.length === 0) return;
    const next = (index + list.length) % list.length;
    list[next]?.focus();
  };

  /** 열림 전환 직후 1회만 포커스를 옮긴다 */
  useEffect(() => {
    if (!open) return;
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (target != null) focusItem(target === -1 ? locales.length - 1 : target);
  }, [open]);

  /** 바깥 클릭으로 닫기 — 포커스 이동(onBlur)만으로는 마우스 사용자가 못 닫는다 */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = buttonRef.current?.closest("[data-locale-menu-root]");
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pendingFocusRef.current = 0;
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      pendingFocusRef.current = -1;
      setOpen(true);
    } else if (e.key === "Escape" && open) {
      // 메가메뉴 안에서 열렸을 때 Esc 가 메가메뉴까지 닫아버리지 않게 막는다
      e.stopPropagation();
      close(false);
    }
  };

  const onItemKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>, index: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(locales.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation(); // 메가메뉴 Esc 핸들러까지 올라가지 않게
        close(true);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.root} data-locale-menu-root>
      <button
        ref={buttonRef}
        type="button"
        className={clsx(styles.trigger, className, open && styles.triggerOpen)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
      >
        <GlobeIcon />
      </button>

      <ul
        id={menuId}
        role="menu"
        aria-label={label}
        className={clsx(styles.menu, open && styles.menuOpen)}
        // 닫혀 있을 때 Tab 으로 진입하는 걸 막는다(visibility:hidden 만으로는 부족한 브라우저가 있다)
        inert={!open}
      >
        {locales.map((l, i) => (
          <li key={l} role="none">
            <Link
              ref={(node) => {
                itemRefs.current[i] = node;
              }}
              href={`/${l}`}
              role="menuitem"
              lang={l}
              hrefLang={l}
              tabIndex={open ? 0 : -1}
              aria-current={l === locale ? "true" : undefined}
              className={clsx(styles.item, l === locale && styles.itemActive)}
              onKeyDown={(e) => onItemKeyDown(e, i)}
              onClick={() => setOpen(false)}
            >
              <FlagIcon locale={l} />
              <span>{localeLabels[l]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
