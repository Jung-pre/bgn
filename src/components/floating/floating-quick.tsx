"use client";

import { useState } from "react";
import clsx from "clsx";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import type { GnbMessages } from "@/shared/i18n/messages";
import styles from "./floating-quick.module.css";

/**
 * 상시 노출 퀵 액션.
 *
 * 시안에서 PC 와 모바일이 **완전히 다른 형태**다:
 *  - PC (p1_01): 우하단 팬아웃. 중앙 버튼을 누르면 네이버예약·이벤트·카톡상담·
 *    오시는길 4개가 부채꼴로 스태거 전개. 평상시엔 챗봇 캐릭터 + 말풍선만.
 *  - 모바일 (p4 전 프레임): 하단 고정 바 5구성, 중앙에 챗봇 FAB 돌출.
 *
 * 같은 데이터를 쓰되 렌더를 나눈다. `useIsMobileLayout` 이
 * `useSyncExternalStore` 기반이라 hydration 깜빡임이 없다.
 *
 * ⚠️ 모바일 하단 바 높이만큼 `<main>` 에 padding-bottom 을 줘야 푸터가 가려지지 않는다
 *    (`globals.css` 의 `--mobile-bottombar-height` 사용).
 */
export interface FloatingQuickProps {
  messages: GnbMessages;
}

export function FloatingQuick({ messages }: FloatingQuickProps) {
  const isMobile = useIsMobileLayout();
  const [isFanOpen, setIsFanOpen] = useState(false);

  if (isMobile) {
    return (
      <nav className={styles.bottomBar} aria-label="빠른 메뉴">
        <ul className={styles.bottomList}>
          {messages.quickActions.slice(0, 2).map((a) => (
            <li key={a.id}>
              <button type="button" className={styles.bottomItem} data-action={a.id}>
                <span className={styles.bottomIcon} aria-hidden />
                <span className={styles.bottomLabel}>{a.label}</span>
              </button>
            </li>
          ))}
          <li className={styles.bottomCenter}>
            <button type="button" className={styles.chatFab} aria-label={messages.chatbotBubble}>
              <span aria-hidden>BGN</span>
            </button>
          </li>
          {messages.quickActions.slice(2).map((a) => (
            <li key={a.id}>
              <button type="button" className={styles.bottomItem} data-action={a.id}>
                <span className={styles.bottomIcon} aria-hidden />
                <span className={styles.bottomLabel}>{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className={styles.fanRoot}>
      {/* 평상시 노출되는 말풍선 — 팬 오픈 시 숨긴다 */}
      <p className={clsx(styles.bubble, isFanOpen && styles.bubbleHidden)} aria-hidden={isFanOpen}>
        {messages.chatbotBubble}
      </p>

      <ul className={clsx(styles.fanList, isFanOpen && styles.fanListOpen)}>
        {messages.quickActions.map((a, i) => (
          <li
            key={a.id}
            className={styles.fanItem}
            /* 부채꼴 각도·스태거 지연을 CSS 변수로 넘긴다.
               JS 로 좌표를 계산하지 않아야 리사이즈 때 다시 안 그려도 된다. */
            style={
              {
                "--i": i,
                "--angle": `${-18 - i * 24}deg`,
              } as React.CSSProperties
            }
          >
            <button type="button" className={styles.fanButton} data-action={a.id}>
              <span className={styles.fanLabel}>{a.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={styles.fanToggle}
        aria-expanded={isFanOpen}
        aria-label={isFanOpen ? "빠른 메뉴 닫기" : "빠른 메뉴 열기"}
        onClick={() => setIsFanOpen((v) => !v)}
      >
        <span aria-hidden>{isFanOpen ? "×" : "BGN"}</span>
      </button>
    </div>
  );
}
