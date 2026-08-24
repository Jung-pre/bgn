"use client";

import { memo, useEffect, useRef } from "react";
import { gsap } from "@/shared/lib/gsap";
import { prefersReducedMotionSync } from "@/shared/lib/use-media-query";
import { SHAPE_COUNT, SYMBOL_SHAPES } from "./tile-symbol-paths";

/**
 * 웹블로그 타일 가운데 문양.
 *
 * 시안 4종을 **원문 패스 그대로** 그린다. 모양을 바꾸지 않고,
 * 스크롤 양만큼만 돌린다. 손을 떼면 속도가 지수로 감쇠해서 관성처럼 남는다.
 *
 * 타일마다 방향·배율·위상만 어긋나게 해서 네 개가 한 덩어리로 안 돈다.
 */

/** 스크롤 1px 당 각속도 충격. 장식이라 크게 돌면 카드 카피와 싸운다. */
const IMPULSE = 0.012;
/** 감쇠 k. `vel *= exp(-dt * DAMP)` — 손을 떼면 약 0.5초에 가라앉는다. */
const DAMP = 4.2;
const VEL_MAX = 2.8;
const VEL_CUTOFF = 0.002;

type SpinListener = (angle: number) => void;

const listeners = new Set<SpinListener>();
let ticking = false;
let angle = 0;
let vel = 0;
let lastY = 0;

function tick() {
  if (listeners.size === 0) return;
  const y = window.scrollY;
  const dy = y - lastY;
  lastY = y;
  const raw = gsap.ticker.deltaRatio();
  const dt = Math.min(0.05, Math.max(1 / 240, (Number.isFinite(raw) ? raw : 1) / 60));
  vel += dy * IMPULSE;
  if (vel > VEL_MAX) vel = VEL_MAX;
  else if (vel < -VEL_MAX) vel = -VEL_MAX;
  vel *= Math.exp(-dt * DAMP);
  if (Math.abs(vel) < VEL_CUTOFF) vel = 0;
  if (vel === 0 && dy === 0) return;
  angle += vel;
  if (angle > 360 || angle < -360) angle %= 360;
  for (const fn of listeners) fn(angle);
}

function subscribe(fn: SpinListener) {
  listeners.add(fn);
  if (!ticking) {
    ticking = true;
    lastY = window.scrollY;
    gsap.ticker.add(tick);
  }
  fn(angle);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && ticking) {
      gsap.ticker.remove(tick);
      ticking = false;
    }
  };
}

export interface TileSymbolProps {
  variant: number;
  className?: string;
}

export const TileSymbol = memo(function TileSymbol({ variant, className }: TileSymbolProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const i = ((variant % SHAPE_COUNT) + SHAPE_COUNT) % SHAPE_COUNT;
  const shape = SYMBOL_SHAPES[i];
  const dir = i % 2 === 0 ? 1 : -1;
  const gain = 0.78 + i * 0.16;
  const phase = i * 18;

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !shape) return;
    el.style.transform = `rotate(${phase}deg)`;
    if (prefersReducedMotionSync()) return;

    const apply = (a: number) => {
      el.style.transform = `rotate(${a * dir * gain + phase}deg)`;
    };
    return subscribe(apply);
  }, [dir, gain, phase, shape]);

  if (!shape) return null;

  return (
    <span ref={hostRef} className={className} aria-hidden>
      <svg viewBox={shape.viewBox} fill="none">
        {shape.paths.map((p, pi) => (
          <path
            key={pi}
            d={p.d}
            fill={p.fill ? "currentColor" : "none"}
            stroke={p.stroke ? "currentColor" : undefined}
            strokeWidth={p.strokeWidth}
          />
        ))}
      </svg>
    </span>
  );
});
