import type { Locale } from "@/shared/config/i18n";

/**
 * GNB 네비게이션 트리 — Figma `2:2431` Navigation 에서 추출한 실제 라벨.
 *
 * ⚠️ 구분자가 가운뎃점(`·` U+00B7)이 아니라 **`∙` U+2219 (BULLET OPERATOR)** 다.
 *    복사해서 쓸 것. 눈으로는 구분이 안 되는데 검색·정렬에서 달라진다.
 *
 * 컴포넌트가 아니라 **데이터로 분리**한다. 그래야 PC 인라인 GNB / PC 메가메뉴 /
 * 모바일 2칼럼 패널 세 곳이 같은 소스를 쓴다. shin 에서 이걸 안 해서
 * 메뉴 하나 추가할 때마다 세 군데를 고쳤다.
 */

export interface NavChild {
  href: string;
  label: Record<Locale, string>;
}

export interface NavItem {
  href: string;
  label: Record<Locale, string>;
  children?: NavChild[];
}

const ko = (s: string): Record<Locale, string> => ({ ko: s, en: s, ja: s, zh: s });

export const NAV_TREE: NavItem[] = [
  {
    href: "/about",
    label: { ko: "밝은눈안과", en: "About", ja: "BGN について", zh: "关于 BGN" },
    children: [
      { href: "/about", label: ko("병원소개") },
      { href: "/about/doctors", label: ko("의료진 소개") },
      { href: "/about/location", label: ko("진료시간 / 오시는 길") },
    ],
  },
  { href: "/center/smile", label: ko("스마일라식∙프로") },
  { href: "/center/vision-correction", label: ko("시력교정술") },
  { href: "/center/cataract", label: ko("백내장∙노안") },
  { href: "/center/dream-lens", label: ko("드림렌즈") },
  { href: "/center/dry-eye", label: ko("안구건조증") },
  { href: "/center/examination", label: ko("안종합검진") },
  { href: "/community", label: ko("커뮤니티센터") },
];

/**
 * 모바일 메뉴에만 있고 PC 인라인 GNB 에는 없는 항목.
 * 시안 p4_04 좌측 1뎁스에 "블로그"가 추가로 들어가 있다.
 */
export const MOBILE_EXTRA_NAV: NavItem[] = [{ href: "/blog", label: ko("블로그") }];

export const SNS_LINKS = [
  { id: "youtube", label: "유튜브", href: "" },
  { id: "instagram", label: "인스타그램", href: "" },
  { id: "kakao", label: "카카오채널", href: "" },
  { id: "facebook", label: "페이스북", href: "" },
] as const;
