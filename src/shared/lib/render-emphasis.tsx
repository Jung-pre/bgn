import { Fragment, type ReactNode } from "react";

/**
 * 본문 안의 **강조 어절**을 `<strong>` 으로 감싼다 — 수정요청 p2(공통).
 *
 * 시안의 설명문은 앞 절만 SemiBold 인 경우가 많다
 * (`48:1113`: "25년 안과 노하우를 결합"만 SemiBold, "한 AI 시스템으로"는 Regular).
 * 사전(i18n)에 마크업을 넣지 않고 **강조할 문자열을 따로 두어** 매칭하는 방식이다.
 *
 * 이렇게 하는 이유:
 *  - 사전 값이 그대로 평문이라 번역자가 마크업 문법을 몰라도 된다.
 *  - `white-space: pre-line` 로 살려 둔 `\n` 을 건드리지 않는다.
 *  - `dangerouslySetInnerHTML` 을 쓰지 않는다.
 *
 * 첫 번째 일치만 감싼다. 같은 어절이 뒤에 또 나와도 강조하지 않는다 —
 * 시안의 강조는 항상 문장 앞머리 한 곳이다.
 */
export function renderWithEmphasis(text: string, emphasis?: string): ReactNode {
  if (!emphasis) return text;
  const at = text.indexOf(emphasis);
  if (at < 0) return text;

  const before = text.slice(0, at);
  const after = text.slice(at + emphasis.length);

  return (
    <Fragment>
      {before}
      <strong className="desc-em">{emphasis}</strong>
      {after}
    </Fragment>
  );
}
