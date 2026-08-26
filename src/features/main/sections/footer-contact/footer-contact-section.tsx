"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SNS_LINKS } from "@/shared/config/nav";
import type { FooterMessages } from "@/shared/i18n/messages";
import { useSectionReveal } from "@/features/main/sections/common/use-section-reveal";
import { useSceneActive } from "@/r3f/use-scene-active";
import { ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync, useIsMobileLayout } from "@/shared/lib/use-media-query";
import styles from "./footer-contact-section.module.css";

const SphereScene = dynamic(
  () => import("@/features/main/sections/hero/scene-sphere").then((m) => m.SphereScene),
  { ssr: false },
);

/**
 * 컨택트 + 푸터 — 시안 PC `107:3238` (1920×792) / 모바일 `68:5135` (375×853).
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
  const isMobile = useIsMobileLayout();
  const stageRef = useRef<HTMLDivElement>(null);
  const footerRef = useSectionReveal<HTMLElement>({
    start: "top 90%",
    disabled: !isMobile,
  });
  const earthHostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const earthProgressRef = useRef(0);
  const earthActive = useSceneActive(earthHostRef);

  /**
   * PC 연출 순서 — **네 단계가 겹치지 않고 차례로** 간다.
   *   ① 지도(파티클 지구)를 선명하게 보여 준다  ② 블러  ③ 어두워짐  ④ 카피 페이드인
   *
   * 예전에는 블러와 어두워짐이 `--earth-recede` 하나에 묶여 동시에 걸렸고,
   * 게다가 `.earthInner` 가 상수 `blur(5px)` 로 시작해 지구가 한 번도 또렷하지
   * 않았다. 그래서 "지도가 안 보인다 / 그냥 흐린 판이다"로 읽혔다.
   *
   * 모바일은 시안에 지구가 없어 pin 없이 기존 reveal 만 쓴다.
   */
  useGSAP(
    () => {
      const footer = footerRef.current;
      if (!footer) return;

      const paint = (blur: number, dim: number, copy: number, spin = blur) => {
        footer.style.setProperty("--earth-blur", String(blur));
        footer.style.setProperty("--earth-dim", String(dim));
        footer.style.setProperty("--copy-in", String(copy));
        /* 구체 자전량. 진행도를 그대로 넘겨 홀드 구간에서도 천천히 돈다
           (Dev Mode 주석 "지구형태가 약간 돌면서"). */
        earthProgressRef.current = spin;
        const inner = innerRef.current;
        if (inner) inner.style.pointerEvents = copy > 0.55 ? "auto" : "none";
      };

      if (isMobile || prefersReducedMotionSync()) {
        paint(1, 1, 1, 1);
        return;
      }

      const stage = stageRef.current;
      if (!stage) return;

      const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
      /**
       * 단계별 구간(진행도 0~1).
       *   ① 홀드   0.00 ~ 0.30   지도 선명
       *   ② 블러+딤 0.30 ~ 0.62  작아지고 어두워지며 배경이 된다
       *   ③ 카피   0.55 ~ 0.92
       */
      const map = (p: number) => {
        const blur = clamp01((p - 0.3) / 0.28);
        const dim = clamp01((p - 0.3) / 0.32);
        const copyLin = clamp01((p - 0.55) / 0.37);
        const copy = 1 - (1 - copyLin) ** 3;
        paint(blur, dim, copy, p);
      };

      map(0);

      const st = ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "bottom bottom",
        pin: footer,
        pinSpacing: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => map(self.progress),
      });

      return () => {
        st.kill(true);
      };
    },
    { scope: footerRef, dependencies: [isMobile] },
  );

  /* 시안은 PC `107:3250` "일요일 정기 휴진" 한 줄.
     모바일은 `closedNoticeMobile` 을 쓰고, 파이프가 있으면 세로 구분선으로 쪼갠다. */
  const notices = (isMobile ? (messages.closedNoticeMobile ?? messages.closedNotice) : messages.closedNotice)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  /* PC `68:2813` 은 개인정보처리방침이 맨 앞. 모바일 `68:5185` 은 이용약관이 맨 앞. */
  const policyLinks = isMobile
    ? [...messages.policyLinks].sort((a, b) => {
        const order = ["이용약관", "개인정보처리방침", "환자권리장전", "비급여재료비"];
        return order.indexOf(a.label) - order.indexOf(b.label);
      })
    : messages.policyLinks;

  const footer = (
    <footer className={styles.footer} ref={footerRef}>
      {/*
        배경 장식. 전부 순수 장식이라 `aria-hidden` 컨테이너 안에 두고
        `alt=""` 로 낸다 — 푸터의 정보는 아래 .inner 가 전부 갖고 있다.
        `loading="lazy"` 는 문서 최하단이라 특히 효과가 크다(첫 화면에서 1.4MB 절약).
      */}
      <div className={styles.decor} aria-hidden>
        {/* 모바일 전용 중앙 글로우. PC 는 `img_12_bg01` 에 이미 구워져 있어 끈다.
            에셋 뒤가 검정이라 screen + 원형 마스크로만 쓴다 — 그냥 얹으면
            검정 판이 슬레이트 필드를 덮는다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.glowSphere}
          src="/main/img_12_sphere01.webp"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>

      {!isMobile ? (
        <div ref={earthHostRef} className={styles.earth} aria-hidden>
          <div className={styles.earthInner}>
            <SphereScene
              active={earthActive}
              progressRef={earthProgressRef}
              intensity={0.8}
              haze={0.32}
              showCore={false}
              interactive={false}
              pointerFollow
              fitSize={0.81}
            />
          </div>
        </div>
      ) : null}

      <div className={styles.dim} aria-hidden />

      {/*
        선화는 카피와 같이 페이드인한다. 지구 홀드 구간에 미리 나와 있으면
        지도가 장식이 아니라 푸터처럼 읽힌다. 좌표는 시안 1920×792 프레임.
      */}
      <div className={styles.wires} aria-hidden>
        {/* 시안 8:2770 좌측 — 병원 건물 와이어프레임.
            알파가 있는 wire-4 를 쓴다(wire-1 은 같은 그림의 검은 배경 버전이라
            screen 블렌드가 필요하고, 그 경우 배경의 푸른 기가 선에 섞인다). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.wireBuilding}
          src="/main/img_12_wire04.webp"
          alt=""
          loading="lazy"
          decoding="async"
        />
        {/* 시안 8:2770 우측 — 잠실 도심 + 롯데타워 와이어프레임(알파 버전 wire-3) */}
        <div className={styles.wireCityClip}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.wireCity}
            src="/main/img_12_wire03.webp"
            alt=""
            loading="lazy"
            decoding="async"
          />
          {/* 타워 선화 위로만 하이라이트. 공중에 떠 있는 + 점은 쓰지 않는다. */}
          <span className={styles.towerSheen} />
        </div>
      </div>
      {/* 시안 2:2903 / 2:2902 장식 원. 선화와 같이 카피 페이드인 때 나온다.
          plus-lighter 그룹 밖에 둔다 — 같이 넣으면 1px 선이 빛줄기처럼 굵어진다. */}
      <div className={styles.rings} aria-hidden>
        <span className={styles.ringLarge} />
        <span className={styles.ringMid} />
        <span className={styles.ringSmall} />
      </div>

      <div className={styles.inner} ref={innerRef}>
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
            {/* 시안: Poppins Medium 100px / 자간 -3px. 대시 좌우가 벌어져 있다. */}
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
            {isMobile && messages.hoursNote ? <p className={styles.hoursNote}>{messages.hoursNote}</p> : null}
          </div>
        </div>

        <div className={styles.bottom} data-reveal-item>
          <div className={styles.bottomLeft}>
            <nav className={styles.policyNav} aria-label="약관 및 정책">
              <ul className={styles.policyList}>
                {policyLinks.map((l) => (
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
              {(isMobile
                ? messages.business
                : messages.business.filter((b) => b.label !== "개인정보보호책임자")
              ).map((b) => (
                <div key={b.label} className={styles.businessRow}>
                  <dt>{b.label}</dt>
                  <dd>{b.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.bottomRight}>
            {/* 시안 2:2968 — 199×30. 에셋은 2x PNG `logo_footer.png`(398×60). */}
            <p className={styles.logo}>
              <Image
                src="/main/logo_footer.png"
                alt="BGN 밝은눈안과병원"
                width={199}
                height={30}
                className={styles.logoImage}
              />
            </p>
            <p className={styles.copyright} lang="en" data-font="body">
              {messages.copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );

  if (isMobile) return footer;

  return (
    <div ref={stageRef} className={styles.stage}>
      {footer}
    </div>
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
