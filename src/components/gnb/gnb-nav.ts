import type { Locale } from "@/shared/config/i18n";

/**
 * GNB 네비게이션 트리 (대분류 9 + 소분류).
 *
 * ⚠️ `src/shared/config/nav.ts` 의 `NAV_TREE` 는 소분류가 `밝은눈안과` 하나뿐이라
 *    시안(Figma `8:540` 전체메뉴)의 4열 소분류 그리드를 채울 수 없었다.
 *    그 파일은 다른 에이전트가 소유하고 있어 손대지 않고, GNB 가 쓰는 트리를
 *    여기(컴포넌트 소유 디렉터리)로 옮겼다. `NAV_TREE`/`MOBILE_EXTRA_NAV` 는
 *    이제 GNB 에서 쓰지 않으므로 정리 대상이다(`SNS_LINKS` 는 푸터가 계속 쓴다).
 *
 * ⚠️ 구분자는 가운뎃점(`·` U+00B7)이 아니라 **`∙` U+2219 (BULLET OPERATOR)** 다.
 *    눈으로는 구분이 안 되는데 검색·정렬에서 달라진다. 복사해서 쓸 것.
 *
 * 라벨/소분류 출처: Figma `8:540`(전체메뉴) 1920×920 렌더 실측.
 * 시안 프레임이 920px 에서 잘려 있어 7행 이후(안종합검진·블로그·커뮤니티센터)의
 * 소분류는 시안에서 읽을 수 없었다 — 아래 `unverified: true` 로 표시해 뒀다.
 */

export interface GnbNavChild {
  href: string;
  label: Record<Locale, string>;
}

export interface GnbNavItem {
  href: string;
  label: Record<Locale, string>;
  /** PC 인라인 GNB 에도 노출할지. 시안 인라인은 8개(블로그 제외)다. */
  inline?: boolean;
  /** 시안에서 소분류를 확인하지 못한 항목 — 확정 전까지 표시 */
  unverified?: boolean;
  children?: GnbNavChild[];
}

/** en/ja/zh 번역 원문이 아직 없다 — ko 를 복제해 두고 오면 교체한다. */
const t = (s: string): Record<Locale, string> => ({ ko: s, en: s, ja: s, zh: s });

export const GNB_NAV: GnbNavItem[] = [
  {
    href: "/about-us",
    label: { ko: "밝은눈안과", en: "About BGN", ja: "BGN について", zh: "关于 BGN" },
    inline: true,
    children: [
      { href: "/about-us", label: t("병원소개") },
      { href: "/about-us/doctors", label: t("의료진소개") },
      { href: "/about-us/location", label: t("진료시간 / 오시는길") },
      { href: "/about-us/dry-eye-care", label: t("수술 전후 건조증 관리") },
    ],
  },
  {
    href: "/smile",
    label: t("스마일라식∙프로"),
    inline: true,
    children: [
      { href: "/smile", label: t("병원소개") },
      { href: "/smile/doctors", label: t("의료진소개") },
      { href: "/smile/precautions", label: t("수술 전후 주의사항") },
    ],
  },
  {
    href: "/vision-correction",
    label: t("시력교정술"),
    inline: true,
    children: [
      { href: "/vision-correction/lasik", label: t("라식") },
      { href: "/vision-correction/lasek", label: t("라섹") },
      { href: "/vision-correction/icl", label: t("렌즈삽입술") },
      { href: "/vision-correction/avellino", label: t("아벨리노 검사") },
      { href: "/vision-correction/precautions", label: t("수술 전후 주의사항") },
      { href: "/vision-correction/dry-eye-care", label: t("수술 전후 건조증 관리") },
    ],
  },
  {
    href: "/cataract",
    label: t("백내장∙노안"),
    inline: true,
    children: [
      { href: "/cataract/surgery", label: t("백내장 수술") },
      { href: "/cataract/presbyopia-lens", label: t("노안 렌즈삽입술") },
      { href: "/cataract/precautions", label: t("수술 전후 주의사항") },
    ],
  },
  {
    href: "/dreamlens",
    label: t("드림렌즈"),
    inline: true,
    children: [
      { href: "/dreamlens", label: t("드림렌즈") },
      { href: "/dreamlens/types", label: t("드림렌즈 종류") },
      { href: "/dreamlens/care", label: t("드림렌즈 관리법") },
      { href: "/dreamlens/exam", label: t("드림렌즈 검사") },
    ],
  },
  {
    href: "/xeroma",
    label: t("안구건조증"),
    inline: true,
    children: [
      { href: "/xeroma", label: t("안구건조증") },
      { href: "/xeroma/exam", label: t("안구건조증 검사") },
      { href: "/xeroma/treatment", label: t("안구건조증 치료") },
    ],
  },
  {
    href: "/eye-disease",
    label: t("안종합검진"),
    inline: true,
    unverified: true,
    children: [
      { href: "/eye-disease", label: t("안종합검진") },
      { href: "/eye-disease/programs", label: t("검진 프로그램") },
      { href: "/eye-disease/reservation", label: t("검진 예약") },
    ],
  },
  {
    href: "/blog",
    label: t("블로그"),
    unverified: true,
  },
  {
    href: "/customer",
    label: t("커뮤니티센터"),
    inline: true,
    unverified: true,
    children: [
      { href: "/customer/notice", label: t("공지사항") },
      { href: "/customer/event", label: t("이벤트") },
      { href: "/customer/counsel", label: t("온라인 상담") },
      { href: "/customer/faq", label: t("자주 묻는 질문") },
    ],
  },
];

/** PC 인라인 GNB — 시안 `8:283` 은 8개다(블로그 없음). */
export const GNB_INLINE_NAV = GNB_NAV.filter((item) => item.inline);

/**
 * 전체메뉴 좌측 패널의 SNS.
 * 시안 `8:540` 은 각 채널 **브랜드 컬러 원형 아이콘**이다(회색 원 + 글자 아님).
 */
export const GNB_SNS = [
  { id: "youtube", label: "유튜브", href: "https://www.youtube.com/" },
  { id: "instagram", label: "인스타그램", href: "https://www.instagram.com/" },
  { id: "kakao", label: "카카오톡 채널", href: "https://pf.kakao.com/" },
  { id: "facebook", label: "페이스북", href: "https://www.facebook.com/" },
] as const;

export type GnbSnsId = (typeof GNB_SNS)[number]["id"];
