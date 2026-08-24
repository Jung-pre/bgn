"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import clsx from "clsx";
import { useIsMobileLayout } from "@/shared/lib/use-media-query";
import type { GnbMessages } from "@/shared/i18n/messages";
import {
  BgnMarkIcon,
  EventSparkleIcon,
  KakaoTalkIcon,
  MapPinIcon,
  NaverIcon,
  QuickCloseIcon,
} from "./quick-icons";
import styles from "./floating-quick.module.css";

/**
 * 상시 노출 퀵 액션.
 *
 * 시안에서 PC 와 모바일이 **완전히 다른 형태**다:
 *  - PC (Figma `2:2403` 닫힘 / `2:665` 열림): 우하단.
 *    평상시엔 `BGn 퀵메뉴` 그라데이션 원(80) + 그 아래 마스코트(80),
 *    마스코트 왼쪽에 말풍선. 원을 누르면 색이 다른 원형 버튼 4개가
 *    부채꼴로 펼쳐지고, 원 자리는 흰 원 + × 로 바뀐다.
 *  - 모바일 (Figma `2:3412`): 하단 고정 바(335×60) 5구성.
 *    좌 2 / 마스코트 FAB / 우 2. 마스코트만 바 위로 8px 돌출한다.
 *
 * 같은 데이터를 쓰되 렌더를 나눈다. `useIsMobileLayout` 이
 * `useSyncExternalStore` 기반이라 hydration 깜빡임이 없다.
 */
export interface FloatingQuickProps {
  messages: GnbMessages;
}

type QuickId = "kakao" | "naver" | "event" | "map";

const ICONS: Record<QuickId, ComponentType<{ className?: string }>> = {
  kakao: KakaoTalkIcon,
  naver: NaverIcon,
  event: EventSparkleIcon,
  map: MapPinIcon,
};

/**
 * PC 팬아웃 좌표 — 토글 원(80×80) **중심**을 원점으로 한 각 버튼(72×72) 중심 오프셋.
 * Figma `2:665` 실측값 그대로다(반지름이 88~101 로 제각각이라 각도·반지름 공식으로
 * 만들면 시안과 어긋난다. 4개뿐이므로 좌표를 박는 편이 정확하다).
 */
const FAN_OFFSET: Record<QuickId, { x: number; y: number }> = {
  event: { x: 56, y: -70 },
  naver: { x: -24, y: -94 },
  kakao: { x: -92, y: -42 },
  map: { x: -80, y: 36 },
};

/** 펼침 스태거 순서. 시안에 순서 지정이 없어 아래(오시는 길)→위로 훑는 각도 순으로 잡았다 */
const FAN_ORDER: QuickId[] = ["map", "kakao", "naver", "event"];

/** 모바일 하단바 — 최신 시안 `48:3101` 은 마스코트가 빠진 **4구성**이다 */
const BAR_ORDER: QuickId[] = ["map", "kakao", "naver", "event"];

export function FloatingQuick({ messages }: FloatingQuickProps) {
  const isMobile = useIsMobileLayout();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * 푸터에 닿으면 FAB 을 접는다.
   *
   * FAB 덩어리(마스코트 + 말풍선)가 223px 폭이라 푸터 우하단의 브랜드 로고와
   * 데스크톱 전 구간에서 겹친다. 시안에는 FAB 이 없으니 정답이 없는 자리인데,
   * 로고를 가리는 것보다 잠깐 접히는 쪽이 낫다 — 푸터에는 전화·지점·오시는 길이
   * 이미 다 있다. state 가 아니라 **속성만** 뒤집어 리렌더를 만들지 않는다.
   */
  const [atFooter, setAtFooter] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAtFooter(Boolean(entry?.isIntersecting)), {
      // 푸터가 화면 아래 1/3 에 들어오는 순간 = 로고가 FAB 높이에 접근하는 시점
      rootMargin: "0px 0px -66% 0px",
    });
    io.observe(footer);
    return () => io.disconnect();
  }, []);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const fanListId = useId();

  /** i18n 배열 순서에 배치를 의존하면 문구를 한 줄 옮겼을 때 레이아웃이 깨진다. id 로만 찾는다 */
  const labelOf = useCallback(
    (id: QuickId) => messages.quickActions.find((a) => a.id === id)?.label ?? id,
    [messages.quickActions],
  );

  /* 열려 있을 때만 Esc·바깥 클릭을 듣는다. 닫힌 상태에서 문서 리스너를 물고 있을 이유가 없다. */
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsOpen(false);
      // 포커스가 펼친 항목 안에 있었다면 갈 곳이 없어지므로 토글로 되돌린다
      toggleRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  /* ── 모바일: 하단 고정 바 ─────────────────────────────────────────────── */
  /**
   * 수정요청 p4 — **이전 디자인이 남아 있던 자리.**
   *
   * 예전 시안(`2:3412`)은 좌 2 / 마스코트 FAB / 우 2 의 **5구성**이었고
   * 마스코트가 바 한가운데에 파란 원으로 박혀 있었다.
   * 최신 시안(`48:3099`)은 완전히 다르다:
   *   - 마스코트는 바에서 **분리되어 바 위 8px, 오른쪽 끝**에 뜬다(60×60, 원판 없음)
   *   - 바는 항목 **4개를 균등 배치**한다(justify-between)
   *   - PC 처럼 "퀵메뉴" 그라디언트 원이나 말풍선은 모바일에 없다
   */
  if (isMobile) {
    return (
      <div className={styles.bottomDock}>
        <button type="button" className={styles.mascotButtonMo} aria-label={messages.chatbotBubble}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 장식용 고정 크기 아이콘.
              next/image 로 두면 CSS 가 크기를 바꾼다며 종횡비 경고를 매번 낸다 */}
          <img
            className={styles.mascotImage}
            src="/main/img_00_mascot-icon01.webp"
            alt=""
            width={60}
            height={60}
            loading="lazy"
            decoding="async"
          />
        </button>

        <nav className={styles.bottomBar} aria-label="빠른 메뉴">
          <ul className={styles.bottomList}>
            {BAR_ORDER.map((id) => {
              const Icon = ICONS[id];
              return (
                <li key={id}>
                  <button type="button" className={styles.bottomItem} data-action={id}>
                    <Icon className={styles.bottomIcon} />
                    <span className={styles.bottomLabel}>{labelOf(id)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    );
  }

  /* ── PC: 우하단 팬아웃 ────────────────────────────────────────────────── */
  return (
    <div
      ref={rootRef}
      className={styles.fanRoot}
      data-open={isOpen || undefined}
      data-at-footer={atFooter || undefined}
    >
      <div className={styles.fanArea}>
        <button
          ref={toggleRef}
          type="button"
          className={styles.fanToggle}
          aria-expanded={isOpen}
          aria-controls={fanListId}
          aria-label={isOpen ? "빠른 메뉴 닫기" : "빠른 메뉴 열기"}
          onClick={() => setIsOpen((v) => !v)}
        >
          {isOpen ? (
            <QuickCloseIcon className={styles.toggleClose} />
          ) : (
            <>
              <BgnMarkIcon className={styles.toggleMark} />
              <span className={styles.toggleLabel}>{messages.quickMenu}</span>
            </>
          )}
        </button>

        {/*
          목록이 토글 **뒤에** 와야 열자마자 Tab 한 번으로 첫 항목에 닿는다.
          겹침 순서는 `.fanToggle { z-index: 1 }` 로 잡아 뒀다(항목이 토글 뒤에서 나온다).

          닫힘 상태에서 항목이 포커스를 받으면 안 된다. 조건부 렌더 대신 `inert` 를 쓰는 이유는
          닫힘 트랜지션(토글 뒤로 빨려 들어가는 모션)을 보여줘야 하기 때문이다.
          `inert` 는 포커스·클릭·AT 노출을 한 번에 막아 준다.
        */}
        <ul id={fanListId} className={styles.fanList} inert={!isOpen}>
          {FAN_ORDER.map((id, i) => {
            const Icon = ICONS[id];
            return (
              <li
                key={id}
                className={styles.fanItem}
                /* 좌표·스태거를 CSS 변수로 넘긴다. JS 로 매 프레임 계산하지 않으므로
                   리사이즈·리렌더에 다시 그릴 일이 없다. */
                style={
                  {
                    "--fan-x": `${FAN_OFFSET[id].x}px`,
                    "--fan-y": `${FAN_OFFSET[id].y}px`,
                    "--fan-i": i,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  className={clsx(styles.fanButton, styles[`theme_${id}`])}
                  data-action={id}
                >
                  <Icon className={styles.fanIcon} />
                  <span className={styles.fanLabel}>{labelOf(id)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.chatRow}>
        {/* 평상시 노출되는 말풍선 — 팬 오픈 시 숨긴다 */}
        <p className={clsx(styles.bubble, isOpen && styles.bubbleHidden)} aria-hidden={isOpen}>
          {/* 그라데이션 글자는 별도 span — 알약 배경까지 clip 되면 안 된다 */}
          <span className={styles.bubbleText}>{messages.chatbotBubble}</span>
        </p>
        <button type="button" className={styles.mascotButton} aria-label={messages.chatbotBubble}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 위 주석과 같은 이유 */}
          <img
            className={styles.mascotImage}
            src="/main/img_00_mascot-icon01.webp"
            alt=""
            width={80}
            height={80}
            loading="lazy"
            decoding="async"
          />
        </button>
      </div>
    </div>
  );
}
