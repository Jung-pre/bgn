"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import clsx from "clsx";
import { prefersReducedMotionSync, useIsMobileLayout } from "@/shared/lib/use-media-query";
import type { GnbMessages } from "@/shared/i18n/messages";
import {
  BgnMarkIcon,
  EventSparkleIcon,
  KakaoTalkIcon,
  MapPinIcon,
  NaverIcon,
  WebBlogIcon,
} from "./quick-icons";
import styles from "./floating-quick.module.css";

/**
 * 말풍선 타이핑 — 수정요청 6차 11p / 시안 `124:4929` 주석
 * ("+타이핑 애니매이션 추가", "+랜덤 안내문구", 문구 3개).
 *
 * ## SSR
 * 첫 페인트는 **항상 0번 문구 전체**다. 마운트 뒤에야 타이핑이 시작하므로
 * 서버·클라이언트 HTML 이 어긋나지 않는다(`Math.random()` 을 렌더 중에 부르면
 * 하이드레이션이 깨진다).
 *
 * ## 순서
 * 순환이 아니라 **랜덤**이되 직전 문구는 다시 뽑지 않는다. 두 번 연속 같은
 * 문구가 나오면 지웠다 그대로 다시 쓰는 것처럼 보인다.
 *
 * ## 동작 줄이기
 * `prefers-reduced-motion` 이면 0번 문구를 고정해 둔다.
 */
const TYPE_MS = 55;
const ERASE_MS = 26;
const HOLD_MS = 2800;

function useTypingBubble(list: string[]): string {
  const [text, setText] = useState(list[0] ?? "");

  useEffect(() => {
    if (list.length < 2 || prefersReducedMotionSync()) return;

    let cancelled = false;
    let timer = 0;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    let current = 0;

    const run = async () => {
      while (!cancelled) {
        await wait(HOLD_MS);
        if (cancelled) return;

        const from = list[current] ?? "";
        for (let i = from.length; i >= 0; i -= 1) {
          setText(from.slice(0, i));
          await wait(ERASE_MS);
          if (cancelled) return;
        }

        let next = current;
        while (next === current) next = Math.floor(Math.random() * list.length);
        current = next;

        const to = list[current] ?? "";
        for (let i = 1; i <= to.length; i += 1) {
          setText(to.slice(0, i));
          await wait(TYPE_MS);
          if (cancelled) return;
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [list]);

  return text;
}

/**
 * 상시 노출 퀵 액션.
 *
 * 시안에서 PC 와 모바일이 **완전히 다른 형태**다:
 *  - PC (Figma `95:3857`, 26.08 개편): 우하단.
 *    평상시엔 `BGn 퀵메뉴` 그라데이션 원(**120**) + 그 아래 마스코트(80),
 *    마스코트 왼쪽에 말풍선. 원을 누르면 색이 다른 원형 버튼 **5개**
 *    (오시는 길·카톡상담·네이버예약·이벤트·웹블로그)가 부채꼴로 펼쳐진다.
 *    ⚠️ 개편에서 바뀐 건 **원 크기(80→120)·그라디언트(보라→시안)·항목 5개·좌표**다.
 *    토글 자체는 그대로다 — 펼침이 기본이 아니다. 그리고 열려도 원은 흰 × 로
 *    바뀌지 않는다(시안 95:3857 에서 열린 상태에도 `BGn 퀵메뉴` 가 그대로다).
 *  - 모바일 (Figma `2:3412`): 하단 고정 바(335×60) 5구성.
 *    좌 2 / 마스코트 FAB / 우 2. 마스코트만 바 위로 8px 돌출한다.
 *
 * 같은 데이터를 쓰되 렌더를 나눈다. `useIsMobileLayout` 이
 * `useSyncExternalStore` 기반이라 hydration 깜빡임이 없다.
 */
export interface FloatingQuickProps {
  messages: GnbMessages;
}

type QuickId = "kakao" | "naver" | "event" | "map" | "blog";

const ICONS: Record<QuickId, ComponentType<{ className?: string }>> = {
  kakao: KakaoTalkIcon,
  naver: NaverIcon,
  event: EventSparkleIcon,
  map: MapPinIcon,
  blog: WebBlogIcon,
};

/**
 * PC 팬 좌표 — 브랜드 원(120×120) **중심**을 원점으로 한 각 버튼(72×72) 중심 오프셋.
 *
 * Figma `95:3857`(1920×920 프레임) 실측. 원 중심은 (1780, 742)다.
 *   오시는 길 (1674,787) → 중심 (1710, 823)
 *   카톡상담  (1632,722) → 중심 (1668, 758)
 *   네이버예약(1650,644) → 중심 (1686, 680)
 *   이벤트    (1720,604) → 중심 (1756, 640)
 *   웹블로그  (1798,620) → 중심 (1834, 656)
 * 반지름이 107~112 로 제각각이라 각도·반지름 공식으로 만들면 시안과 어긋난다.
 */
const FAN_OFFSET: Record<QuickId, { x: number; y: number }> = {
  map: { x: -70, y: 81 },
  kakao: { x: -112, y: 16 },
  naver: { x: -94, y: -62 },
  event: { x: -24, y: -102 },
  blog: { x: 54, y: -86 },
};

/** 등장 스태거 순서 — 아래(오시는 길)에서 시계 방향으로 훑는 각도 순 */
const FAN_ORDER: QuickId[] = ["map", "kakao", "naver", "event", "blog"];

/** 모바일 하단바 — 웹블로그가 더해져 **5구성**이다. 바(335)·패딩(16)·space-between
 *  조합이 그대로라 항목만 늘리면 간격 8.1 로 균등 배치된다(요청 이미지 실측). */
const BAR_ORDER: QuickId[] = ["map", "kakao", "naver", "event", "blog"];

export function FloatingQuick({ messages }: FloatingQuickProps) {
  const isMobile = useIsMobileLayout();
  const bubbleText = useTypingBubble(messages.chatbotBubbles);
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

  /** i18n 배열 순서에 배치를 의존하면 문구를 한 줄 옮겼을 때 레이아웃이 깨진다. id 로만 찾는다 */
  const labelOf = useCallback(
    (id: QuickId) => messages.quickActions.find((a) => a.id === id)?.label ?? id,
    [messages.quickActions],
  );

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
        {/* 열려도 흰 × 로 바뀌지 않는다 — 시안 95:3857 은 펼친 상태에도 브랜드 원이다 */}
        <button
          ref={toggleRef}
          type="button"
          className={styles.fanBrand}
          aria-expanded={isOpen}
          aria-controls={fanListId}
          aria-label={isOpen ? "빠른 메뉴 닫기" : "빠른 메뉴 열기"}
          onClick={() => setIsOpen((v) => !v)}
        >
          <BgnMarkIcon className={styles.brandMark} />
          <span className={styles.brandLabel}>{messages.quickMenu}</span>
        </button>

        {/*
          목록이 토글 **뒤에** 와야 열자마자 Tab 한 번으로 첫 항목에 닿는다.
          겹침 순서는 `.fanBrand { z-index: 1 }` 로 잡아 뒀다(항목이 원 뒤에서 나온다).

          닫힘 상태에서 항목이 포커스를 받으면 안 된다. 조건부 렌더 대신 `inert` 를 쓰는 이유는
          닫힘 트랜지션(원 뒤로 빨려 들어가는 모션)을 보여줘야 하기 때문이다.
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
                  <Icon className={clsx(styles.fanIcon, id === "blog" && styles.fanIconSm)} />
                  <span className={styles.fanLabel}>{labelOf(id)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 평상시 노출되는 말풍선 — 팬 오픈 시 숨긴다 */}
      <p className={clsx(styles.bubble, isOpen && styles.bubbleHidden)} aria-hidden>
        {/* 그라데이션 글자는 별도 span — 알약 배경까지 clip 되면 안 된다 */}
        <span className={styles.bubbleText}>{bubbleText}</span>
        {/* 커서. 글자가 지워지는 동안에도 남아 있어야 "쓰는 중"으로 읽힌다 */}
        <span className={styles.bubbleCaret} aria-hidden />
      </p>

      <button type="button" className={styles.mascotButton} aria-label={messages.chatbotBubble}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 장식용 고정 크기 아이콘 */}
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
  );
}
