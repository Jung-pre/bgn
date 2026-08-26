"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  GLOBE_TUNE_DEFAULTS,
  getGlobeTune,
  resetGlobeTune,
  setGlobeTune,
  subscribeGlobeTune,
  type GlobeTune,
} from "./globe-tune";
import styles from "./globe-tune-panel.module.css";

function clientEnabled() {
  return new URLSearchParams(window.location.search).has("tune");
}

const subscribeNever = () => () => {};
const clientTrue = () => true;

function Slider({
  label,
  k,
  min,
  max,
  step,
  tune,
}: {
  label: string;
  k: keyof GlobeTune;
  min: number;
  max: number;
  step: number;
  tune: GlobeTune;
}) {
  const value = tune[k];
  if (typeof value !== "number") return null;
  const def = GLOBE_TUNE_DEFAULTS[k];
  const changed = typeof def === "number" && Math.abs(value - def) > step * 0.49;

  return (
    <label className={styles.row} data-changed={changed || undefined}>
      <span>
        {label}
        <code className={styles.key}>{k}</code>
      </span>
      <span className={styles.nums}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(4))}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setGlobeTune({ [k]: n });
          }}
        />
        {changed && typeof def === "number" ? (
          <button
            type="button"
            className={styles.undo}
            title={`기본 ${def}`}
            onClick={() => setGlobeTune({ [k]: def })}
          >
            {def}
          </button>
        ) : null}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setGlobeTune({ [k]: Number(e.target.value) })}
      />
    </label>
  );
}

function Toggle({
  label,
  k,
  tune,
}: {
  label: string;
  k: keyof GlobeTune;
  tune: GlobeTune;
}) {
  const on = Boolean(tune[k]);
  return (
    <label>
      <input type="checkbox" checked={on} onChange={(e) => setGlobeTune({ [k]: e.target.checked })} />
      {label}
    </label>
  );
}

function Group({
  title,
  hint,
  startOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  startOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <details
      className={styles.group}
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className={styles.legend}>{title}</summary>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {children}
    </details>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const tune = useSyncExternalStore(subscribeGlobeTune, getGlobeTune, () => GLOBE_TUNE_DEFAULTS);
  const [copied, setCopied] = useState(false);

  return (
    <aside className={styles.panel} data-lenis-prevent aria-label="지구본 옵션">
      <div className={styles.head}>
        <div>
          <p className={styles.title}>히어로 지구본</p>
          <p className={styles.sub}>지금 화면 기본값 기준 · 히어로만</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" onClick={() => resetGlobeTune()}>
            리셋
          </button>
          <button type="button" onClick={onClose}>
            숨기기
          </button>
        </div>
      </div>

      <Group title="레이어" hint="꺼도 드로우콜은 남고, 화면에서만 숨깁니다. 지금: 바디·껍질·육지 켜짐.">
        <div className={styles.toggles}>
          <Toggle label="바디 평판" k="showBody" tune={tune} />
          <Toggle label="헤이즈" k="showHaze" tune={tune} />
          <Toggle label="헤일로" k="showHalo" tune={tune} />
          <Toggle label="껍질" k="showShell" tune={tune} />
          <Toggle label="육지" k="showLand" tune={tune} />
          <Toggle label="코어" k="showCore" tune={tune} />
        </div>
      </Group>

      <Group
        title="크기 · 밝기"
        hint="size 0.86 이 지금 화면. intensity 는 파티클만, haze 는 가산 산란, cover 는 바디가 마퀴를 가리는 양."
      >
        <Slider label="크기" k="size" min={0.4} max={1.4} step={0.01} tune={tune} />
        <Slider label="파티클 밝기" k="intensity" min={0} max={2} step={0.01} tune={tune} />
        <Slider label="헤이즈" k="haze" min={0} max={1.5} step={0.01} tune={tune} />
        <Slider label="바디 가림" k="cover" min={0} max={1.2} step={0.01} tune={tune} />
      </Group>

      <Group
        title="파티클"
        hint="헤일로(성긴 외곽) · 껍질(바다 포함 구면) · 육지(대륙). 점 크기는 월드 단위."
      >
        <Slider label="헤일로 알파" k="haloOpacity" min={0} max={1.5} step={0.01} tune={tune} />
        <Slider label="껍질 알파" k="shellOpacity" min={0} max={1.5} step={0.01} tune={tune} />
        <Slider label="육지 알파" k="landOpacity" min={0} max={1.5} step={0.01} tune={tune} />
        <Slider label="헤일로 점" k="haloSize" min={0.008} max={0.08} step={0.001} tune={tune} />
        <Slider label="껍질 점" k="shellSize" min={0.008} max={0.08} step={0.001} tune={tune} />
        <Slider label="육지 점" k="landSize" min={0.008} max={0.08} step={0.001} tune={tune} />
      </Group>

      <Group
        title="바디 평판"
        hint="카메라향 원반. 점 사이로 마퀴가 비치는 걸 막습니다. 지금 fill 1 / edge 0.98."
        startOpen={false}
      >
        <Slider label="채움 알파" k="bodyFill" min={0.4} max={1} step={0.005} tune={tune} />
        <Slider label="가장자리" k="bodyEdge" min={0.7} max={1} step={0.005} tune={tune} />
        <Slider label="림" k="bodyRim" min={0} max={0.2} step={0.005} tune={tune} />
        <Slider label="반사" k="bodySpec" min={0} max={1.2} step={0.01} tune={tune} />
        <Slider label="반사 속도" k="bodySpecSpeed" min={0} max={2.4} step={0.05} tune={tune} />
        <Slider label="코스틱" k="bodyCau" min={0} max={0.15} step={0.005} tune={tune} />
        <Slider label="진주 산란" k="bodyPearl" min={0} max={0.4} step={0.01} tune={tune} />
      </Group>

      <Group
        title="모션"
        hint="지금 자전 0.025 rad/s ≈ 4분에 한 바퀴. 피치 X 0.655, 스크롤 요 0.35."
        startOpen={false}
      >
        <Slider label="자전" k="spinRate" min={0} max={0.4} step={0.005} tune={tune} />
        <Slider label="등장 요" k="introYaw" min={0} max={0.8} step={0.01} tune={tune} />
        <Slider label="스크롤 요" k="scrollYaw" min={0} max={1} step={0.01} tune={tune} />
        <Slider label="포인터 요" k="pointerYaw" min={0} max={1} step={0.01} tune={tune} />
        <Slider label="포인터 피치" k="pointerPitch" min={0} max={0.6} step={0.01} tune={tune} />
        <Slider label="피치 X" k="pitchX" min={0} max={1.2} step={0.01} tune={tune} />
        <Slider label="요 트림 °" k="yawTrimDeg" min={-30} max={30} step={0.5} tune={tune} />
      </Group>

      <Group
        title="커서 반발"
        hint="NDC. 반경 0.5 ≈ 화면 높이의 25%, 세기 0.06 ≈ 3%."
        startOpen={false}
      >
        <Slider label="반경" k="pushRadius" min={0.1} max={1.2} step={0.01} tune={tune} />
        <Slider label="세기" k="pushMax" min={0} max={0.2} step={0.005} tune={tune} />
        <Slider label="헤일로 배수" k="haloPush" min={0} max={2} step={0.05} tune={tune} />
        <Slider label="껍질 배수" k="shellPush" min={0} max={2} step={0.05} tune={tune} />
        <Slider label="육지 배수" k="landPush" min={0} max={2} step={0.05} tune={tune} />
      </Group>

      <Group
        title="타워 전환"
        hint="pin 진행도 0~1. 확대 후 유지는 큐 시트(0.40~0.58). 라인 크로스는 축소 뒤 0.66~0.84."
        startOpen={false}
      >
        <Slider label="페이드 시작" k="fadeStart" min={0} max={0.8} step={0.01} tune={tune} />
        <Slider label="페이드 끝" k="fadeEnd" min={0.4} max={1} step={0.01} tune={tune} />
        <Slider label="축소량" k="gxShrink" min={0} max={6} step={0.05} tune={tune} />
        <Slider label="형성 시작" k="gxStart" min={0} max={1} step={0.01} tune={tune} />
        <Slider label="형성 끝" k="gxEnd" min={0} max={1} step={0.01} tune={tune} />
        <Slider label="라인 시작" k="gxCrossStart" min={0} max={1} step={0.01} tune={tune} />
        <Slider label="라인 끝" k="gxCrossEnd" min={0} max={1} step={0.01} tune={tune} />
      </Group>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(JSON.stringify(getGlobeTune(), null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "복사됨" : "값 복사"}
        </button>
      </div>
      <p className={styles.note}>맞춘 값을 복사해 주세요. 클로징·푸터 구체에는 안 들어갑니다.</p>
    </aside>
  );
}

export function GlobeTunePanel() {
  const mounted = useSyncExternalStore(subscribeNever, clientTrue, () => false);
  const [open, setOpen] = useState(true);

  if (!mounted || !clientEnabled()) return null;

  return createPortal(
    open ? (
      <Panel onClose={() => setOpen(false)} />
    ) : (
      <button type="button" className={styles.fab} onClick={() => setOpen(true)}>
        지구본 옵션
      </button>
    ),
    document.body,
  );
}
