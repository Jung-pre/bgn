"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
import { VideoSlot } from "@/components/video-slot/video-slot";
import { usePrefersReducedMotion } from "@/shared/lib/use-media-query";
import { mulberry32 } from "@/features/main/sections/hero/globe-points";
import { createFireworks, type Fireworks } from "./fireworks";
import styles from "./brand-film-section.module.css";

/**
 * 브랜드 필름 — Figma `8:961` "BGN잠실 메인페이지 영상_2차본 1" (1920×1080).
 *
 * ⚠️ 3D 가 아니다. Figma 주석이 `영상` 이고, 기획안 히어로 3안이 이 영상이다:
 *   "부산에서 시작해 강남, 잠실을 거쳐 세계를 향한 BGN의 도약 /
 *    '150년을 내다보는 안과'"
 *
 * ## 정지 이미지 한 장을 어떻게 "연출"로 만들었나
 * 영상이 아직 없다. 그렇다고 최종 컷 한 장을 툭 띄우면 앞뒤 섹션이 전부
 * 움직이는 페이지에서 여기만 죽은 판이 된다. 대신 시안 컷을 **레이어로 분해**했다.
 *
 * 폴더에 두 장이 있었다:
 *   - `poster.webp`   — 글씨 없는 클린 플레이트(한강 일몰)
 *   - `poster-2.webp` — 시안 최종 컷(위 + BGn 타이포 + 스우시 + 불티)
 *
 * 두 장의 **양의 차분**(`poster-2 − poster`)이 곧 "빛으로 더해진 것"이다.
 * 이걸 다시 타원 마스크로 갈라 두 장을 구웠다(`scripts` 없이 1회 생성):
 *   - `overlay-typo.webp`  — BGn 글리프 + 스우시
 *   - `overlay-spark.webp` — 흩어진 불티
 *
 * 세 장을 `plus-lighter` 로 겹치면 원본과 픽셀이 거의 같다(평균 오차 2.5/255).
 * 즉 **화질 손해 없이 타이밍만 벌었다.** 이제 스크롤에 맞춰
 * 배경 → 불티 → 타이포 순서로 등장시킬 수 있다.
 *
 * `mix-blend-mode: plus-lighter` 를 쓰는 이유: `screen` 은 a+b−ab 라 밝은 데서
 * 어긋나고, `plus-lighter` 는 정확히 a+b 라 위 분해가 그대로 복원된다.
 *
 * ## 폭죽은 왜 그림이 아니라 파티클인가
 * 시안의 불티는 정지 이미지라 아무리 페이드해도 "떠 있는 점"이다. 실제로 터지는
 * 느낌은 **가속도**에서 나온다 — 튀어나가고, 감속하고, 떨어진다. 그건 그릴 수
 * 없고 계산해야 한다(`fireworks.ts`).
 *
 * ## 영상이 도착하면
 * `VIDEO_SRC` 만 채우면 된다. 그때는 이 합성 스택을 통째로 걷고 영상만 재생한다
 * (아래 `hasVideo` 분기). 지금 만든 연출은 영상의 **대역**이지 영상 위에 얹는
 * 장식이 아니다 — 둘을 겹치면 같은 글씨가 두 번 보인다.
 *
 * ## UI 전체 숨김
 * 시안에서 이 프레임만 GNB·퀵바가 전부 없다. 섹션이 뷰포트를 채우는 동안
 * `<body data-gnb-hide="true">` 를 세운다. GNB 쪽은 이 속성을 CSS 로 받는다
 * (컴포넌트 간 결합을 만들지 않으려고 context 대신 data 속성을 쓴다).
 */
const VIDEO_SRC: string | undefined = undefined; // TODO: 영상 도착 시 "/main/video_03_film01.mp4"

const PLATE = "/main/img_03_poster01.webp";
const OVERLAY_SPARK = "/main/img_03_overlay01.webp";
const OVERLAY_TYPO = "/main/img_03_overlay02.webp";
/** 영상이 없을 때 `<video poster>` 대신 쓰이는 최종 합성본(폴백 경로 전용) */
const VIDEO_POSTER = "/main/img_03_poster02.webp";

/** 타이포 중심 — `overlay-typo.webp` 실측(정규화 좌표). 폭죽이 여기서 터진다 */
const TYPO_CENTER = { x: 0.535, y: 0.36 } as const;

/** 스크롤 진행도 구간. 전부 0~1 이고 겹쳐야 자연스럽다 */
const CUE = {
  /** 배경 줌아웃이 끝나는 지점 */
  plateEnd: 0.5,
  sparkIn: [0.1, 0.44],
  typoIn: [0.32, 0.66],
  /** 폭죽이 터지는 지점들 */
  bursts: [0.16, 0.27, 0.4, 0.55],
} as const;

/**
 * 앞 장면과 겹치는 입장만. 폭죽·타이포 큐는 건드리지 않는다.
 * 예전엔 입장 구간에 맞춰 CUE 전체를 0~1 로 다시 접어서 연출이 늦게/빠르게 터졌다.
 */
const ENTRY_END = 0.22;

/** 0~1 로 정규화하고 클램프 */
function span(p: number, a: number, b: number) {
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}
/** ease-out-cubic */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function BrandFilmSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const typoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fwRef = useRef<Fireworks | null>(null);
  /** 잔불을 켤지 — 진행도가 첫 폭죽을 지나면 1 */
  const twinkleRef = useRef(0);
  /** 이미 터뜨린 폭죽 인덱스. 스크롤을 되감으면 다시 터질 수 있게 Set 을 비운다 */
  const firedRef = useRef<Set<number>>(new Set());

  const reduced = usePrefersReducedMotion();
  const hasVideo = Boolean(VIDEO_SRC);
  /** 합성 연출을 돌릴지. 영상이 오면 끄고, 동작 줄이기면 정지 합성본만 보여준다 */
  const composite = !hasVideo && !reduced;

  /* ---------------------------------------------------------------- 폭죽 */
  useEffect(() => {
    if (!composite) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* `Math.random()` 은 쓰지 않는다 — 프로젝트 전역 규칙(React Compiler purity).
       시드 PRNG 라 새로고침해도 같은 불꽃이 나온다. */
    const rand = mulberry32(0xf1_2e);
    const fw = createFireworks(canvas, rand);
    if (!fw) return;
    fwRef.current = fw;

    const onResize = () => fw.resize();
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = 0;
    let visible = true;

    const io = new IntersectionObserver(
      // ⚠️ 마지막 엔트리를 읽는다 — 한 콜백에 [false, true] 가 함께 오는 일이 있다
      (entries) => {
        visible = Boolean(entries[entries.length - 1]?.isIntersecting);
        if (!visible) fw.clear();
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    io.observe(canvas);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      /* 탭을 오래 비웠다 돌아오면 dt 가 몇 초가 된다. 잘라내지 않으면
         파티클이 한 프레임에 화면 밖으로 순간이동한다. */
      const dt = last === 0 ? 0.016 : Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!visible) return;

      /* 잔불 — 폭죽 사이를 채운다. 없으면 터질 때만 살아 있는 화면이 된다 */
      if (twinkleRef.current > 0 && rand() < 0.22) {
        fw.twinkle(0.18 + rand() * 0.64, 0.28 + rand() * 0.42);
      }
      fw.tick(dt);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      fw.clear();
      fwRef.current = null;
    };
  }, [composite]);

  /* -------------------------------------------------- 스크롤 진행도 → 레이어 */
  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const gnbSt = ScrollTrigger.create({
        trigger: section,
        /* 섹션이 의료진과 100vh 겹치므로 top 20% 면 GNB 가 너무 일찍 숨는다 */
        start: "top top",
        end: "bottom 30%",
        onToggle: (self) => {
          document.body.dataset.gnbHide = self.isActive ? "true" : "false";
        },
      });

      if (!composite)
        return () => {
          gnbSt.kill(true);
          delete document.body.dataset.gnbHide;
        };

      const prev = section.previousElementSibling as HTMLElement | null;
      const clearPrev = () => {
        if (!prev) return;
        prev.style.opacity = "";
        prev.style.transform = "";
        prev.style.transformOrigin = "";
      };

      const apply = (p: number) => {
        /* 입장만 투명도로. scale 을 스테이지에 주면 플레이트 줌·plus-lighter 가 뭉개진다. */
        const enter = easeOut(span(p, 0, ENTRY_END));
        const pin = pinRef.current;
        if (pin) {
          if (enter >= 1) {
            pin.style.opacity = "";
          } else {
            pin.style.opacity = enter.toFixed(3);
          }
        }
        if (prev) {
          prev.style.opacity = (1 - enter).toFixed(3);
          prev.style.transformOrigin = "50% 50%";
          prev.style.transform = `scale(${(1 + enter * 0.08).toFixed(4)})`;
        }

        const plate = plateRef.current;
        const spark = sparkRef.current;
        const typo = typoRef.current;

        if (plate) {
          /* 배경은 살짝 크게 들어와 제자리로 앉는다. 1.14 → 1.0.
             밝기를 같이 올려야 "안개가 걷힌다"로 읽힌다 — 스케일만 주면 그냥 줌이다. */
          const t = easeOut(span(p, 0, CUE.plateEnd));
          plate.style.transform = `scale(${(1.14 - 0.14 * t).toFixed(4)})`;
          plate.style.filter = `brightness(${(0.74 + 0.26 * t).toFixed(3)}) saturate(${(0.82 + 0.18 * t).toFixed(3)})`;
        }

        if (spark) {
          const t = easeOut(span(p, CUE.sparkIn[0], CUE.sparkIn[1]));
          spark.style.opacity = t.toFixed(3);
          spark.style.transform = `scale(${(1.1 - 0.1 * t).toFixed(4)})`;
        }

        if (typo) {
          const t = easeOut(span(p, CUE.typoIn[0], CUE.typoIn[1]));
          /* 블러 → 초점. 빛으로 그린 글씨가 맺히는 인상은 스케일보다 블러가 만든다 */
          typo.style.opacity = t.toFixed(3);
          typo.style.transform = `scale(${(1.16 - 0.16 * t).toFixed(4)})`;
          typo.style.filter = `blur(${((1 - t) * 26).toFixed(2)}px) brightness(${(0.8 + 0.6 * t).toFixed(3)})`;
        }

        /* 폭죽 — 진행도가 큐를 **넘어설 때 한 번만** 터진다.
           매 프레임 터뜨리면 스크롤을 멈춘 자리에서 무한히 터진다. */
        const fw = fwRef.current;
        if (fw) {
          twinkleRef.current = p > CUE.bursts[0] ? 1 : 0;
          CUE.bursts.forEach((cue, i) => {
            if (p >= cue && !firedRef.current.has(i)) {
              firedRef.current.add(i);
              /* 첫 발은 타이포 자리에서 크게, 나머지는 주변에서 작게 */
              const big = i === 0 || i === 2;
              fw.burst(
                TYPO_CENTER.x + (i - 1.5) * 0.11,
                TYPO_CENTER.y + (i % 2 === 0 ? -0.05 : 0.08),
                big ? 74 : 44,
                /* power 단위 = 초당 화면 높이 배수. 0.42 면 1초에 화면의 40% 를 난다 */
                big ? 0.42 : 0.28,
              );
            }
            /* 되감으면 다시 터질 수 있게 해제 */
            if (p < cue - 0.04) firedRef.current.delete(i);
          });
        }
      };

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        pin: pinRef.current,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        scrub: 0.5,
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });
      apply(0);

      return () => {
        gnbSt.kill(true);
        // ⚠️ kill(true) — revert 하지 않으면 pin-spacer 가 DOM 에 남아 섹션이 밀린다
        st.kill(true);
        clearPrev();
        delete document.body.dataset.gnbHide;
      };
    },
    { scope: sectionRef, dependencies: [composite] },
  );

  // 언마운트 시 속성이 남지 않도록 이중 안전장치
  useEffect(
    () => () => {
      delete document.body.dataset.gnbHide;
    },
    [],
  );

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-label="BGN 브랜드 필름"
      data-composite={composite ? "true" : "false"}
    >
      <div ref={pinRef} className={styles.pinShell}>
        {composite ? (
          <>
            {/* eslint-disable @next/next/no-img-element */}
            <div ref={plateRef} className={styles.layer} aria-hidden>
              <img className={styles.img} src={PLATE} alt="" decoding="async" loading="lazy" />
            </div>
            <div ref={sparkRef} className={styles.layerAdd} aria-hidden>
              <img
                className={styles.img}
                src={OVERLAY_SPARK}
                alt=""
                decoding="async"
                loading="lazy"
              />
            </div>
            <div ref={typoRef} className={styles.layerAdd} aria-hidden>
              <img
                className={styles.img}
                src={OVERLAY_TYPO}
                alt=""
                decoding="async"
                loading="lazy"
              />
            </div>
            {/* eslint-enable @next/next/no-img-element */}
            <canvas ref={canvasRef} className={styles.fireworks} aria-hidden />
          </>
        ) : (
          <VideoSlot
            src={VIDEO_SRC}
            poster={VIDEO_POSTER}
            decorative
            className={styles.video}
            rootMargin="400px 0px"
          />
        )}
      </div>
    </section>
  );
}
