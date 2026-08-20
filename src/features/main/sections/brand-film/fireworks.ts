/**
 * 브랜드 필름 폭죽 — 캔버스 2D 파티클.
 *
 * ## 왜 3D(R3F) 가 아닌가
 * 이 씬에 필요한 건 화면 좌표계의 점 수백 개와 가산 합성뿐이다. WebGL 컨텍스트를
 * 하나 더 만들면(히어로 구체 + 리본에 이어 세 번째다) 저사양 기기에서 컨텍스트
 * 상한에 먼저 걸린다. 2D 캔버스 + `globalCompositeOperation = "lighter"` 로
 * 같은 그림이 나온다.
 *
 * ## 왜 클래스가 아니라 함수인가
 * React 밖에서 사는 순수 상태다. 컴포넌트는 `create → burst/tick → destroy`
 * 세 개만 알면 되고, 그 밖의 필드를 노출하면 렌더 중에 만지고 싶어진다.
 */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** 초 단위 수명. 남은 수명 / 총 수명 이 알파가 된다 */
  max: number;
  size: number;
  hue: 0 | 1 | 2;
}

/** 시안 컷에서 뽑은 3색 — 금빛 / 흰빛 / 옅은 하늘 */
const PALETTE = ["255,214,140", "255,248,232", "186,214,255"] as const;

/**
 * 속도 단위는 **초당 화면 높이 배수**다. px/frame 으로 두면 120Hz 화면에서
 * 불꽃이 두 배로 빨라지고, 순수 px 로 두면 모바일에서 화면 밖으로 날아간다.
 *
 * 처음에 `vy += G*h*dt` 로 가속해 놓고 위치는 `y += vy*dt*60` 으로 적분했다가
 * 중력이 60배가 됐다 — 불꽃이 터지지 않고 **수직으로 쏟아졌다.** 단위는 한 곳에서만
 * 정한다: 속도 = px/s, 위치 적분 = `v * dt`.
 */
/** 중력 — 화면 높이의 배수(px/s²) */
const GRAVITY_H = 0.55;
/** 공기 저항 계수. 속도가 `e^(-k·t)` 로 준다. dt 가 흔들려도 결과가 같다 */
const DRAG_K = 1.15;

export interface Fireworks {
  /** (x, y) 는 0~1 정규화 좌표 */
  burst: (x: number, y: number, count: number, power: number) => void;
  /** 반짝임 한 알. 폭죽 사이를 채운다 */
  twinkle: (x: number, y: number) => void;
  tick: (dt: number) => void;
  resize: () => void;
  clear: () => void;
  count: () => number;
}

export function createFireworks(canvas: HTMLCanvasElement, seedFn: () => number): Fireworks | null {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  let sparks: Spark[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    /* DPR 을 2 로 자른다. 3배 화면에서 전면 가산 합성은 채우기 비용이 9배가 된다 */
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const burst = (nx: number, ny: number, count: number, power: number) => {
    const x = nx * w;
    const y = ny * h;
    for (let i = 0; i < count; i += 1) {
      /* 각도를 균등 분할한 뒤 흔든다. 순수 난수로 뽑으면 뭉치는 방향이 생겨
         "터졌다"가 아니라 "흘렸다"로 보인다. */
      const a = (i / count) * Math.PI * 2 + (seedFn() - 0.5) * 0.5;
      /* 제곱근을 쓰면 반지름 분포가 원판에 고르게 퍼진다(중심 쏠림 방지).
         power 는 "초당 화면 높이의 몇 배"라 h 를 곱해 px/s 로 만든다. */
      const s = Math.sqrt(seedFn()) * power * (0.55 + seedFn() * 0.75) * h;
      const max = 0.9 + seedFn() * 1.5;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.82 - power * 0.18 * h, // 살짝 위로 — 불꽃은 솟았다 떨어진다
        life: max,
        max,
        size: 0.9 + seedFn() * 2.2,
        hue: (seedFn() < 0.62 ? 0 : seedFn() < 0.8 ? 1 : 2) as 0 | 1 | 2,
      });
    }
  };

  const twinkle = (nx: number, ny: number) => {
    const max = 1.1 + seedFn() * 1.4;
    sparks.push({
      x: nx * w,
      y: ny * h,
      vx: (seedFn() - 0.5) * 0.05 * h,
      vy: -(0.03 + seedFn() * 0.05) * h,
      life: max,
      max,
      size: 0.8 + seedFn() * 1.6,
      hue: (seedFn() < 0.5 ? 0 : 1) as 0 | 1,
    });
  };

  const tick = (dt: number) => {
    ctx.clearRect(0, 0, w, h);
    if (sparks.length === 0) return;

    ctx.globalCompositeOperation = "lighter";

    const next: Spark[] = [];
    for (const p of sparks) {
      p.life -= dt;
      if (p.life <= 0) continue;

      const px = p.x;
      const py = p.y;
      const drag = Math.exp(-DRAG_K * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + GRAVITY_H * h * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const t = p.life / p.max;
      /* 알파를 t 그대로 쓰면 마지막에 툭 꺼진다. 세제곱하면 꼬리가 길게 남는다 */
      const a = t * t * t;
      const rgb = PALETTE[p.hue];

      /* 꼬리 — 이전 위치까지 선을 긋는다. 점만 찍으면 속도감이 안 난다 */
      ctx.strokeStyle = `rgba(${rgb},${a * 0.5})`;
      ctx.lineWidth = p.size * 0.7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      /* 머리 — 중심이 흰색으로 뜨는 방사 그라디언트. 단색 원이면 플라스틱처럼 보인다 */
      const r = p.size * (1.6 + a * 2.2);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.35, `rgba(${rgb},${a * 0.85})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      next.push(p);
    }
    sparks = next;
    ctx.globalCompositeOperation = "source-over";
  };

  const clear = () => {
    sparks = [];
    ctx.clearRect(0, 0, w, h);
  };

  return { burst, twinkle, tick, resize, clear, count: () => sparks.length };
}
