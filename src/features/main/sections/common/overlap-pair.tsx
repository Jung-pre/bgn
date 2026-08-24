"use client";

import { type ReactNode, useRef } from "react";
import { ScrollTrigger, useGSAP } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import styles from "./overlap-pair.module.css";

/** pin-spacer 안쪽까지 포함해 실제 섹션 쌍을 모은다. */
function collectPair(wrap: HTMLElement) {
  const nodes: HTMLElement[] = [];
  for (const child of Array.from(wrap.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains("pin-spacer")) {
      const inner = child.firstElementChild;
      if (inner instanceof HTMLElement) nodes.push(inner);
      continue;
    }
    nodes.push(child);
  }
  return nodes;
}

/**
 * 히어로 구체→타워(1.2) 와 같은 **덮어쓰기 전환**.
 * 앞 섹션을 `pinSpacing: false` 로 붙잡아 두고, 뒤 섹션이 그 위로 올라온다.
 *
 * 자식이 하나뿐이면(모바일에서 클로징 스피어가 빠진 경우) pin 을 걸지 않는다.
 * 섹션이 dynamic import 라 늦게 붙어도 MutationObserver 로 다시 묶는다.
 */
export function OverlapPair({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = ref.current;
      if (!wrap) return;

      let st: ScrollTrigger | undefined;
      let boundStay: HTMLElement | null = null;
      let boundCover: HTMLElement | null = null;

      const bind = () => {
        const kids = collectPair(wrap);
        if (kids.length < 2) {
          st?.kill(true);
          st = undefined;
          boundStay?.style.removeProperty("--overlap-out");
          boundCover?.style.removeProperty("--overlap-in");
          boundStay = null;
          boundCover = null;
          return;
        }

        const stay = kids[0];
        const cover = kids[1];
        if (!stay || !cover) return;
        if (stay === boundStay && cover === boundCover && st) return;

        st?.kill(true);
        boundStay = stay;
        boundCover = cover;
        const paint = (t: number) => {
          stay.style.setProperty("--overlap-out", String(t));
          cover.style.setProperty("--overlap-in", String(t));
        };

        st = ScrollTrigger.create({
          trigger: stay,
          start: "bottom bottom",
          endTrigger: cover,
          end: "bottom bottom",
          pin: stay,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            paint(prefersReducedMotionSync() ? 1 : self.progress);
          },
        });
        paint(0);
      };

      bind();
      const obs = new MutationObserver(bind);
      obs.observe(wrap, { childList: true });

      return () => {
        obs.disconnect();
        st?.kill(true);
      };
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={styles.pair}>
      {children}
    </div>
  );
}
