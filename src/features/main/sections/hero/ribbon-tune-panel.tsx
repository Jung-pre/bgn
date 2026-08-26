"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  RIBBON_LAYER_IDS,
  RIBBON_LAYER_LABELS,
  RIBBON_TUNE_DEFAULTS,
  getRibbonTune,
  resetRibbonTune,
  setRibbonLayer,
  setRibbonTune,
  subscribeRibbonTune,
  type RibbonLayerId,
  type RibbonLayerTune,
  type RibbonTune,
} from "./ribbon-tune";
import styles from "./globe-tune-panel.module.css";

function clientEnabled() {
  if (process.env.NODE_ENV !== "production") return true;
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
  k: keyof RibbonTune;
  min: number;
  max: number;
  step: number;
  tune: RibbonTune;
}) {
  const value = tune[k];
  if (typeof value !== "number") return null;
  const def = RIBBON_TUNE_DEFAULTS[k];
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
            if (Number.isFinite(n)) setRibbonTune({ [k]: n });
          }}
        />
        {changed && typeof def === "number" ? (
          <button
            type="button"
            className={styles.undo}
            title={`기본 ${def}`}
            onClick={() => setRibbonTune({ [k]: def })}
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
        onChange={(e) => setRibbonTune({ [k]: Number(e.target.value) })}
      />
    </label>
  );
}

function LayerSlider({
  label,
  id,
  k,
  min,
  max,
  step,
  layer,
}: {
  label: string;
  id: RibbonLayerId;
  k: keyof RibbonLayerTune;
  min: number;
  max: number;
  step: number;
  layer: RibbonLayerTune;
}) {
  const value = layer[k];
  const def = RIBBON_TUNE_DEFAULTS[id][k];
  const changed = Math.abs(value - def) > step * 0.49;

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
            if (Number.isFinite(n)) setRibbonLayer(id, { [k]: n });
          }}
        />
        {changed ? (
          <button
            type="button"
            className={styles.undo}
            title={`기본 ${def}`}
            onClick={() => setRibbonLayer(id, { [k]: def })}
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
        onChange={(e) => setRibbonLayer(id, { [k]: Number(e.target.value) })}
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
  k: keyof RibbonTune;
  tune: RibbonTune;
}) {
  const on = Boolean(tune[k]);
  return (
    <label>
      <input type="checkbox" checked={on} onChange={(e) => setRibbonTune({ [k]: e.target.checked })} />
      {label}
    </label>
  );
}

function Group({
  title,
  hint,
  open = true,
  children,
}: {
  title: string;
  hint?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={styles.group} open={open}>
      <summary className={styles.legend}>{title}</summary>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {children}
    </details>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const tune = useSyncExternalStore(subscribeRibbonTune, getRibbonTune, () => RIBBON_TUNE_DEFAULTS);
  const [copied, setCopied] = useState(false);

  return (
    <aside className={clsx(styles.panel, styles.dockLeft)} data-lenis-prevent aria-label="라인 옵션">
      <div className={styles.head}>
        <div>
          <p className={styles.title}>라인 옵션</p>
          <p className={styles.sub}>타워 씬 실크 라인 · 현재 값 기준</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" onClick={() => resetRibbonTune()}>
            리셋
          </button>
          <button type="button" onClick={onClose}>
            숨기기
          </button>
        </div>
      </div>

      <Group title="레이어" hint="꺼도 지오메트라는 남고, 화면에서만 숨깁니다.">
        <div className={styles.toggles}>
          <Toggle label="멤브레인" k="showMembrane" tune={tune} />
          <Toggle label="띠 1 흰·파랑" k="show0" tune={tune} />
          <Toggle label="띠 2 알록달록" k="show1" tune={tune} />
          <Toggle label="띠 3 알록달록" k="show2" tune={tune} />
          <Toggle label="띠 4 흰·파랑" k="show3" tune={tune} />
        </div>
      </Group>

      <Group title="전체 배율" hint="네 장에 한꺼번에 곱합니다. 개별 띠 값은 아래 그룹에서.">
        <Slider label="파동" k="ampMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="꼬임" k="twistMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="속도" k="speedMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="시간" k="timeScale" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="멤브레인 알파" k="bodyAlphaMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="그레인" k="grainMul" min={0} max={3} step={0.01} tune={tune} />
      </Group>

      <Group title="색" hint="1이 지금 화면입니다. 올리면 그 색이 진해지고 0이면 빠집니다. 흰·파랑 띠도 이 전체 배율이 먹습니다.">
        <Slider label="장미" k="roseMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="금" k="goldMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="파랑" k="blueMul" min={0} max={3} step={0.01} tune={tune} />
        <Slider label="간섭색" k="iridMul" min={0} max={3} step={0.01} tune={tune} />
      </Group>

      <Group title="배치 · 스크롤" hint="스크롤 Y/회전은 타워 진행도 u 에 곱합니다. 기본 0.04 / -0.04.">
        <Slider label="크기" k="groupScale" min={0.4} max={1.8} step={0.01} tune={tune} />
        <Slider label="X" k="posX" min={-1.5} max={1.5} step={0.01} tune={tune} />
        <Slider label="Y" k="posY" min={-1.5} max={1.5} step={0.01} tune={tune} />
        <Slider label="스크롤 Y" k="groupY" min={-0.4} max={0.4} step={0.005} tune={tune} />
        <Slider label="스크롤 회전" k="groupRot" min={-0.4} max={0.4} step={0.005} tune={tune} />
      </Group>

      {RIBBON_LAYER_IDS.map((id) => (
        <Group key={id} title={RIBBON_LAYER_LABELS[id]} open={false}>
          <LayerSlider label="파동" id={id} k="amp" min={0} max={0.6} step={0.005} layer={tune[id]} />
          <LayerSlider label="꼬임 폭" id={id} k="twAmp" min={0} max={5} step={0.05} layer={tune[id]} />
          <LayerSlider label="꼬임 주기" id={id} k="twFreq" min={0.2} max={3} step={0.05} layer={tune[id]} />
          <LayerSlider label="꼬임 방향" id={id} k="twistDir" min={-1} max={1} step={1} layer={tune[id]} />
          <LayerSlider label="위상" id={id} k="phase" min={0} max={8} step={0.05} layer={tune[id]} />
          <LayerSlider label="속도" id={id} k="speed" min={0} max={1.5} step={0.01} layer={tune[id]} />
          <LayerSlider label="알파" id={id} k="bodyAlpha" min={0} max={1} step={0.01} layer={tune[id]} />
          <LayerSlider label="장미" id={id} k="rose" min={0} max={1.5} step={0.01} layer={tune[id]} />
          <LayerSlider label="금" id={id} k="gold" min={0} max={1.5} step={0.01} layer={tune[id]} />
          <LayerSlider label="파랑" id={id} k="blue" min={0} max={1.5} step={0.01} layer={tune[id]} />
          <LayerSlider label="색 길이" id={id} k="streak" min={0.08} max={1.2} step={0.01} layer={tune[id]} />
        </Group>
      ))}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(JSON.stringify(getRibbonTune(), null, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "복사됨" : "값 복사"}
        </button>
      </div>
      <p className={styles.note}>맞춘 값을 복사해서 넘겨 주세요. 포인트 도트는 그리지 않습니다. 질감은 멤브레인 그레인입니다.</p>
    </aside>
  );
}

export function RibbonTunePanel() {
  const mounted = useSyncExternalStore(subscribeNever, clientTrue, () => false);
  const [open, setOpen] = useState(true);

  if (!mounted || !clientEnabled()) return null;

  return createPortal(
    open ? (
      <Panel onClose={() => setOpen(false)} />
    ) : (
      <button type="button" className={clsx(styles.fab, styles.dockLeft)} onClick={() => setOpen(true)}>
        라인 옵션
      </button>
    ),
    document.body,
  );
}
