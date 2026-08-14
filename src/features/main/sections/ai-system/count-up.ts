/**
 * 데이터 라벨 숫자 카운트업 유틸.
 *
 * ## 왜 훅(`use-count-up.ts`)이 아닌가
 * 카운트업은 "카드가 안착한 **뒤에**" 시작해야 순서가 맞는다. 즉 섹션의
 * 단일 타임라인 안에서 `tl.add(...)` 로 위치를 잡아야 하는데, 그 위치는
 * GSAP 콜백/타임라인 조립 코드 안이라 훅을 호출할 수 없는 자리다.
 * (`useCountUp()` 이름으로 만들면 react-hooks 규칙이 조건부 호출로 잡는다.)
 * 그래서 훅이 아니라 **타임라인에 꽂아 넣는 트윈 팩토리**로 만든다.
 *
 * ## 왜 라벨 문자열을 파싱하는가
 * `760,000+ CLINICAL CASES` / `ACCURACY 99.2%` 처럼 숫자가 i18n 문구 안에
 * 박혀 있다. 숫자를 컴포넌트에 하드코딩하면 번역본이 들어오는 순간 어긋난다.
 * 라벨에서 첫 숫자 토큰만 떼어내 그 자리만 애니메이션한다.
 */
import { gsap } from "@/shared/lib/gsap";

export interface NumericLabel {
  /** 숫자 앞 텍스트 */
  before: string;
  /** 숫자 뒤 텍스트 */
  after: string;
  /** 최종 도달값 */
  value: number;
  /** 소수 자릿수 — 원문 표기를 그대로 따른다(99.2 → 1) */
  decimals: number;
  /** 원문에 천 단위 구분자가 있었는가 */
  grouped: boolean;
}

/** 천 단위 구분자를 포함한 첫 번째 숫자 토큰 */
const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/;

export function parseNumericLabel(label: string): NumericLabel | null {
  const match = NUMBER_TOKEN.exec(label);
  const raw = match?.[0];
  if (!match || !raw) return null;

  const plain = raw.replace(/,/g, "");
  const value = Number(plain);
  if (!Number.isFinite(value)) return null;

  const dot = plain.indexOf(".");
  return {
    before: label.slice(0, match.index),
    after: label.slice(match.index + raw.length),
    value,
    decimals: dot === -1 ? 0 : plain.length - dot - 1,
    grouped: raw.includes(","),
  };
}

/**
 * 원문 표기(자릿수·구분자)를 유지한 채 포맷한다.
 *
 * `Intl.NumberFormat` 을 쓰지 않는 이유: 로케일에 따라 구분자가 `.` 로
 * 바뀌어 영문 데이터 라벨이 `760.000+` 이 돼 버린다. 표기는 시안 고정값이다.
 */
export function formatNumeric(value: number, spec: Pick<NumericLabel, "decimals" | "grouped">) {
  const fixed = value.toFixed(spec.decimals);
  if (!spec.grouped) return fixed;
  const [int = "", frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

/**
 * 카운트업 트윈. 타임라인에 `tl.add(countUpTween(...), position)` 으로 꽂는다.
 *
 * DOM 텍스트를 직접 쓰고 state 를 건드리지 않는다 — 매 프레임 setState 는
 * 이 프로젝트에서 금지다.
 */
export function countUpTween(el: HTMLElement, spec: NumericLabel, duration = 1.4) {
  const proxy = { value: 0 };
  return gsap.to(proxy, {
    value: spec.value,
    duration,
    // 큰 수가 초반에 확 튀어야 "빅데이터"처럼 읽힌다.
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = formatNumeric(proxy.value, spec);
    },
  });
}
