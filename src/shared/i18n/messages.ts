import type { Locale } from "@/shared/config/i18n";

/**
 * 섹션별 messages 인터페이스 + 사전.
 *
 * 문구는 시안(docs/design/2026_BGN 잠실.pdf)에서 추출한 실제 카피다.
 * 시안 PDF 는 한글이 Type3(아웃라인)로 익스포트돼 있어 텍스트 복사가 안 되므로,
 * 렌더 이미지를 읽어 옮겨 적었다. **오탈자 검수 필요.**
 *
 * 규칙:
 *  - `src/features/**` 만 이 타입을 import 한다. `src/components/**` 는 금지.
 *  - 모바일 전용 카피는 `xxxMobile?` 옵셔널로 두고 `?? xxx` 폴백.
 *  - en/ja/zh 는 아직 원문이 없다. ko 를 복제해 두고 번역이 오면 교체할 것.
 */

/* ── 공통 ───────────────────────────────────────────────────────────────── */

export interface SectionHeaderMessages {
  /** 영문 아이브로우 — 시안 전 섹션 공통 3단 구조의 1단 */
  eyebrow: string;
  /** 국문 헤드라인 */
  title: string;
  /** 헤드라인 중 형광 마커로 감쌀 어절 (있는 섹션만) */
  titleMarker?: string;
  /** 본문 2행 */
  description?: string;
  /**
   * 본문 중 SemiBold 로 강조할 어절 — 수정요청 p2(공통).
   * 시안은 설명문 앞 절만 굵게 쓴다(`48:1113`). `description` 안에 그대로
   * 들어 있는 부분 문자열을 적으면 첫 번째 일치만 `<strong>` 으로 감싼다.
   */
  descriptionEmphasis?: string;
}

/* ── 히어로 ─────────────────────────────────────────────────────────────── */

export interface HeroSlideMessages {
  /** 상단 작은 카피 */
  eyebrow: string;
  /** 메인 헤드라인 — `brandToken` 부분만 로고타입 강조 */
  title: string;
  brandToken?: string;
}

export interface HeroSectionMessages {
  slides: HeroSlideMessages[];
  /** 하단 무한 마퀴 문구 */
  marquee: string;
  scrollLabel: string;
}

/* ── 의료진 ─────────────────────────────────────────────────────────────── */

export interface DoctorMessages {
  name: string;
  title: string;
  /**
   * 누끼 인물 사진(WebP). Figma 원본에서 추출해 `public/main/` 에 `img_02_doctorNN` 으로 넣었다.
   * 이름 ↔ 얼굴 대응은 전부 확인된 것이다(추측 아님) — 아래 `doctors` 주석 참고.
   */
  photo: string;
}

export interface MedicalTeamSectionMessages extends SectionHeaderMessages {
  cta: string;
  doctors: DoctorMessages[];
}

/* ── AI 정밀 검사 시스템 ─────────────────────────────────────────────────── */

export interface AiStepMessages {
  step: string;
  title: string;
  description: string;
  /** 카드 안 데이터 비주얼 라벨 */
  dataLabel?: string;
}

export interface AiSystemSectionMessages extends SectionHeaderMessages {
  steps: AiStepMessages[];
  marquee: string;
}

/* ── AI 상담 신청 ───────────────────────────────────────────────────────── */

export interface AiConsultSectionMessages extends SectionHeaderMessages {
  namePlaceholder: string;
  phonePlaceholder: string;
  agreement: string;
  agreementLink: string;
  submit: string;
}

/* ── AI 브랜드 스토리(영상 탭) ───────────────────────────────────────────── */

export interface AiStorySectionMessages {
  tabs: string[];
  videoEyebrow: string;
  videoTitle: string;
  playLabel: string;
}

/* ── 진료 센터 ──────────────────────────────────────────────────────────── */

export interface CenterMessages {
  /** 아코디언 축소 상태의 세로쓰기 라벨 */
  shortName: string;
  name: string;
  nameEn: string;
  description: string;
  href: string;
  /** 카드 배경 사진(WebP). 시안 `8:5162` center card 세트에서 추출 */
  image: string;
}

export interface CentersSectionMessages extends SectionHeaderMessages {
  centers: CenterMessages[];
}

/* ── 히스토리 타임라인 ──────────────────────────────────────────────────── */

export interface HistoryEraMessages {
  period: string;
  title: string;
  quote: string;
  quoteAuthor: string;
  points: string[];
}

export interface HistorySectionMessages {
  introTitle: string;
  introTitleMarker: string;
  eras: HistoryEraMessages[];
}

/* ── Web blog ───────────────────────────────────────────────────────────── */

export interface BlogPostMessages {
  tags: string[];
  title: string;
  href: string;
  /** 카드 썸네일(WebP). 시안 `8:2419`~`8:2739` 에서 추출 */
  image: string;
}

export interface BlogSectionMessages {
  title: string;
  posts: BlogPostMessages[];
}

/* ── 이벤트 ─────────────────────────────────────────────────────────────── */

export interface EventItemMessages {
  title: string;
  subtitle: string;
  href: string;
  /** 정사각 배너(WebP). 시안 `8:2700` 에서 추출 */
  image: string;
}

export interface EventSectionMessages extends SectionHeaderMessages {
  /**
   * 시안 `2:2846` 의 본문은 두 굵기가 섞여 있다 —
   * "BGN의 특별한 혜택"만 SemiBold, 나머지는 Regular.
   * 문자열을 쪼개 두면 번역마다 굵기 구간이 달라져도 사전만 고치면 되므로,
   * `description` 안에 그대로 등장하는 **부분 문자열**을 여기에 둔다.
   * (컴포넌트는 `description.split(descriptionStrong)` 으로 감싸면 된다.)
   */
  descriptionStrong: string;
  cta: string;
  events: EventItemMessages[];
}

/* ── 푸터 ───────────────────────────────────────────────────────────────── */

export interface BranchMessages {
  id: string;
  label: string;
  address: string;
  hours: { label: string; value: string }[];
}

export interface FooterMessages {
  /** 기획안 p30 — 지점 소개 카피 2단락 */
  intro: string[];
  tel: string;
  closedNotice: string;
  hoursNote: string;
  branches: BranchMessages[];
  policyLinks: { label: string; href: string; strong?: boolean }[];
  business: { label: string; value: string }[];
  copyright: string;
}

/* ── GNB ────────────────────────────────────────────────────────────────── */

export interface GnbMessages {
  login: string;
  signup: string;
  menuOpen: string;
  menuClose: string;
  languageLabel: string;
  /** 우하단 퀵메뉴 토글 원 안에 들어가는 라벨 (시안 `2:2403`) */
  quickMenu: string;
  quickActions: { id: string; label: string }[];
  chatbotBubble: string;
}

/* ── 사전 ───────────────────────────────────────────────────────────────── */

export interface Dictionary {
  gnb: GnbMessages;
  heroSection: HeroSectionMessages;
  medicalTeamSection: MedicalTeamSectionMessages;
  aiSystemSection: AiSystemSectionMessages;
  aiConsultSection: AiConsultSectionMessages;
  aiStorySection: AiStorySectionMessages;
  centersSection: CentersSectionMessages;
  historySection: HistorySectionMessages;
  blogSection: BlogSectionMessages;
  eventSection: EventSectionMessages;
  footer: FooterMessages;
}

const ko: Dictionary = {
  gnb: {
    login: "로그인",
    signup: "회원가입",
    menuOpen: "전체 메뉴 열기",
    menuClose: "전체 메뉴 닫기",
    languageLabel: "언어 선택",
    quickMenu: "퀵메뉴",
    quickActions: [
      { id: "naver", label: "네이버예약" },
      { id: "event", label: "이벤트" },
      { id: "kakao", label: "카톡상담" },
      { id: "map", label: "오시는 길" },
    ],
    chatbotBubble: "무엇이든 물어보세요!",
  },

  heroSection: {
    slides: [
      { eyebrow: "세계를 향한", title: "BGN의 도약", brandToken: "BGN" },
      { eyebrow: "세상을 선명하게", title: "BGN 밝은눈안과", brandToken: "BGN" },
    ],
    marquee: "BGN Eyeclinic Jamsil",
    scrollLabel: "Scroll",
  },

  medicalTeamSection: {
    eyebrow: "BGN Medical Team",
    title: "BGN 의료진",
    // 시안 2:1009 — "풍부한 수술 경험과 전문성"만 SemiBold, 나머지 Regular.
    description: "풍부한 수술 경험과 전문성을 바탕으로 더 나은 결과를 고민합니다.",
    descriptionEmphasis: "풍부한 수술 경험과 전문성",
    cta: "의료진소개 보러가기",
    // 시안 도트 인디케이터가 8개 → 의료진 8인.
    //
    // 배열 순서는 **시안 초기 상태를 그대로 재현하도록** 맞췄다.
    // 캐러셀은 activeIndex 0 에서 시작해 0번을 가운데 두고 좌우로 순환 배치하므로
    // (use-cross-carousel.ts `signedOffset`), 시안 `8:868` 의
    // 김소현 · 이수민 · [박세광] · 김정완 · 한정엽 배열을 맞추려면
    // 박세광이 0, 왼쪽 두 명이 배열 끝(6·7)으로 가야 한다.
    // 카드 지그재그 레인(index 홀짝)도 이 순서일 때만 시안과 일치한다.
    //
    /*
      ## 이름 ↔ 얼굴 대응 근거
      시안 `8:868` 은 캐러셀 초기 상태라 **5명만 이름이 보인다**(나머지 3장은
      프레임 밖으로 잘려 있다). 그래서 한동안 3명을 빈 문자열로 뒀는데,
      화면에는 이름 없는 카드로 그대로 나왔다.
      나머지 3명은 병원 공식 의료진 페이지(bgneye.com)에서 확인했다.
      잠실점 소속이 정확히 8명이고 시안 도트 수와 일치한다.

      이름을 순서만 보고 끼워 맞추면 얼굴이 바뀔 수 있어서(의료 정보라 치명적),
      **원본 사진의 픽셀 크기로 대조**했다. Figma 에서 뽑은 파일과 병원 페이지의
      원본이 같은 소스라 크기가 그대로 일치한다:
        송윤중 577×958 = song-yunjung.webp 577×958
        김민경 470×780 = kim-minkyung.webp 470×780
        이연호 597×1010 → 남은 한 장(lee-yeonho.webp). 사진도 육안 대조했다.
      앞의 5명은 시안 카드에 이름이 찍혀 있어 그대로 읽었다.
    */
    doctors: [
      { name: "박세광", title: "대표원장", photo: "/main/img_02_doctor01.webp" },
      { name: "김정완", title: "원장", photo: "/main/img_02_doctor02.webp" },
      { name: "한정엽", title: "원장", photo: "/main/img_02_doctor03.webp" },
      { name: "송윤중", title: "원장", photo: "/main/img_02_doctor04.webp" },
      { name: "김민경", title: "원장", photo: "/main/img_02_doctor05.webp" },
      { name: "이연호", title: "원장", photo: "/main/img_02_doctor06.webp" },
      { name: "김소현", title: "원장", photo: "/main/img_02_doctor07.webp" },
      { name: "이수민", title: "원장", photo: "/main/img_02_doctor08.webp" },
    ],
  },

  aiSystemSection: {
    eyebrow: "AI Precision System",
    title: "BGN AI 정밀 검사 시스템",
    // 시안 2:1106 — 헤드라인 뒤쪽 "정밀 검사 시스템"만 primary/700 로 강조된다.
    titleMarker: "정밀 검사 시스템",
    // 시안 2:1107 — 2행. 앞줄 "16년간 축적된 안과 데이터"가 SemiBold.
    description:
      "16년간 축적된 안과 데이터를 기반으로\n환자에게 가장 적합한 시력교정 솔루션을 제안합니다",
    descriptionEmphasis: "16년간 축적된 안과 데이터",
    // 카드 본문은 각 카드의 본문 노드에서 그대로 옮겼다(2:1113 / 2:1128 / 2:1143 / 2:1155).
    steps: [
      {
        step: "1",
        title: "데이터 수집",
        description: "안구를 정밀 스캔하여\n다양한 정보를 수집합니다",
        dataLabel: "OPTICAL MAPPING",
      },
      {
        step: "2",
        title: "AI 빅데이터 분석",
        description: "76만 건 이상의 임상 데이터를\nAI가 분석하고 학습합니다",
        dataLabel: "760,000+ CLINICAL CASES",
      },
      {
        step: "3",
        title: "AI 시뮬레이션",
        description: "개인별 눈 상태를 분석하여\n수술 결과를 가상으로 예측합니다",
        dataLabel: "ACCURACY 99.2%",
      },
      {
        step: "4",
        title: "맞춤형 제안",
        description: "AI 분석 결과를 기반으로\n최적의 시력교정 솔루션을 제안합니다",
        dataLabel: "SMILE PRO / ICL / LASIK",
      },
    ],
    marquee: "AI Precision System",
  },

  aiConsultSection: {
    eyebrow: "AI Consultation",
    title: "BGN AI 정밀 검사 상담 신청",
    titleMarker: "상담 신청",
    // 시안 2:1218 — 2행. 앞줄 "25년 안과 노하우를 결합"이 SemiBold.
    // `.desc` 가 white-space: pre-line 이라 개행이 그대로 살아난다.
    description:
      "25년 안과 노하우를 결합한 AI 시스템으로\n가장 안전하고 정확한 눈 건강 솔루션을 제안합니다",
    descriptionEmphasis: "25년 안과 노하우를 결합",
    namePlaceholder: "이름을 입력해주세요",
    phonePlaceholder: "연락처를 입력해주세요",
    agreement: "개인정보 처리방침 동의",
    agreementLink: "약관보기",
    submit: "AI 검사 신청하기",
  },

  aiStorySection: {
    tabs: ["밝은눈안과 AI 히스토리", "AI 기반 맞춤형 진단 시스템", "AI 기술 미래 전망"],
    videoEyebrow: "정밀성, 안전성, 맞춤형 치료의 새로운 지평",
    videoTitle: "AI 혁신이 이끄는\n시력교정의 새로운 미래",
    playLabel: "영상 재생",
  },

  centersSection: {
    eyebrow: "BGN Center",
    title: "진료 센터",
    // ⚠️ 시안에서 명칭 표기가 섞여 있었다(스마일센터 / 스마일라식센터).
    //    개발 전 용어 통일 필요 — 일단 GNB 메뉴 표기를 기준으로 맞춰 둔다.
    //
    // description 은 센터 카드 컴포넌트 세트 `2:5292` 의 각 variant 본문을 그대로 옮겼다.
    // 시안은 3행이지만 `.desc` 에 white-space 지정이 없어 현재는 한 줄로 흐른다
    // (개행 의도를 잃지 않도록 `\n` 은 남겨 둔다).
    centers: [
      {
        shortName: "스마일센터",
        name: "스마일라식센터",
        nameEn: "Smart Lasik Center",
        // 2:5298 — 시안 본문은 제목과 달리 "스마트라식센터"로 적혀 있다(시안 원문 유지).
        description:
          "정밀한 검사와 첨단 장비를 바탕으로\n눈 상태에 맞는 안전한 시력교정을\n제공하는 스마트라식센터",
        href: "/center/smile",
        image: "/main/img_07_center01.webp",
      },
      {
        shortName: "시력교정센터",
        name: "시력교정센터",
        nameEn: "Vision Correction Center",
        // 2:5304
        description:
          "최첨단 장비와 노하우로 안전하게!\n눈 건강을 최우선으로 생각하는\n밝은눈안과 시력교정센터",
        href: "/center/vision-correction",
        // vision.webp 는 exam.webp 와 **같은 사진**이라 안종합검진 카드와 겹친다.
        // 시안 8:5205 는 세극등 검사 컷이므로 consult.webp 가 맞다.
        image: "/main/img_07_center02.webp",
      },
      {
        shortName: "백내장센터",
        name: "백내장센터",
        nameEn: "Cataract Center",
        // 2:5310
        description:
          "정밀한 진단과 체계적인 수술 시스템으로\n개인의 눈 상태에 맞는 맞춤형 백내장 치료를\n제공하는 백내장센터",
        href: "/center/cataract",
        image: "/main/img_07_center03.webp",
      },
      {
        shortName: "드림렌즈센터",
        name: "드림렌즈센터",
        nameEn: "Dream Lens Center",
        // 2:5316
        description:
          "자는 동안 시작되는 근시 관리\n성장기 아이의 눈 상태를 꼼꼼히 확인하고\n근시 진행을 고려한 드림렌즈를 처방합니다.",
        href: "/center/dream-lens",
        image: "/main/img_07_center04.webp",
      },
      {
        shortName: "건성안센터",
        name: "건성안센터",
        nameEn: "Dry Eye Center",
        // 2:5322
        description:
          "정밀한 눈물막·안구표면 검사부터\n개인의 건조증 원인에 맞춘 체계적인 치료를\n제공하는 건성안센터",
        href: "/center/dry-eye",
        image: "/main/img_07_center05.webp",
      },
      {
        shortName: "안종합검진센터",
        name: "안종합검진센터",
        nameEn: "Comprehensive Eye Examination Center",
        // 2:5328
        description:
          "정밀한 안과 검진과 체계적인 검사 시스템으로\n눈 건강 상태를 꼼꼼하게 확인하고\n질환을 조기에 발견하는 안종합검진센터",
        href: "/center/examination",
        image: "/main/img_07_center06.webp",
      },
    ],
  },

  historySection: {
    introTitle: "소중한 눈을 위한 단 한 번의 선택,\nBGN의 발자취가 곧 신뢰의 기준입니다.",
    introTitleMarker: "단 한 번의 선택,",
    eras: [
      {
        period: "2009 ~ 2010",
        title: "도전과 혁신의 첫걸음",
        quote: "우수한 장비가 뒷받침될 때, 정밀한 진료가 가능합니다.",
        quoteAuthor: "박세광 대표원장",
        points: [
          "독일 ZEISS 사의 스마일라식 선제적 도입",
          "스마일라식 EXPERIENCED SURGEON 선정 안과",
          "자체 기술력을 바탕으로 한 'AI 라식/라섹 정밀 검사 프로그램' 도입",
        ],
      },
      {
        period: "2011 ~ 2013",
        title: "세계로 확장된 BGN, 눈부신 성장",
        quote: "눈 건강을 지키는 의료 기술에는 국경이 없습니다.",
        quoteAuthor: "박세광 대표원장",
        points: [
          "글로벌 네트워크 안과병원(아이얼안과) 협력 및 공동 라식 센터 설립",
          "독일 ZEISS 사와 스마일라식 장비(VISUMAX) 공동 연구 진행",
          "ZEISS 공식 인증 '스마일 라식 센터' 선정 및 코리아 스마일 포럼 참석",
        ],
      },
      {
        period: "2014 ~ 2023",
        title: "끊임없는 연구, 맞춤형 의료 솔루션",
        quote: "환자를 위한 아낌없는 투자와 기술 혁신은 계속됩니다.",
        quoteAuthor: "박세광 대표원장",
        points: [
          "글로벌 학회(WOC TOKYO) 비쥬맥스 라식 부문 수상",
          "빅데이터 기반 자체 특화 프로그램 개발 (트리플 / 콰트로 / 펜타 자이스스마일)",
          "진보된 시력교정 장비 '스마일 프로' 도입 및 ZEISS 사의 핵심 장비 다수 보유",
        ],
      },
      {
        period: "2024 ~ 2026",
        title: "안과 의료계의 새로운 지평",
        quote: "끊임없는 학술 교류가 더 나은 의료 서비스를 만듭니다.",
        // 기획안에 이 인용만 발화자 표기가 없다. 확인 필요.
        quoteAuthor: "박세광 대표원장",
        points: [
          "세계적인 안과학회(ESCRS 바르셀로나, ZEISS APAC 등) 지속적 참여 및 연구 발표",
          "EVO ICL 렌즈삽입술 영닥터 심포지움 참여",
          "대한민국 국가대표 선수협회 및 한국야구위원회(KBO) 공식 의료 제휴 안과 선정",
        ],
      },
    ],
  },

  blogSection: {
    title: "BGN Web blog",
    posts: [
      {
        tags: ["Doctor's Story", "히포크라테스의 생각"],
        title: "백내장 명의? 증세의 정도를 확인하는 판단력이 필요합니다.",
        href: "/blog/1",
        image: "/main/img_09_post01.webp",
      },
      {
        tags: ["Doctor's Story"],
        title: "스마일라식, 후기로는 알 수 없는 이야기",
        href: "/blog/2",
        image: "/main/img_09_post02.webp",
      },
      {
        tags: ["서선의 기술", "안(眼)목 있는 이야기"],
        title: "부드러운 햇살에 속지 마세요, 눈 건강에 더 위험한 이유",
        href: "/blog/3",
        image: "/main/img_09_post03.webp",
      },
    ],
  },

  eventSection: {
    eyebrow: "BGN EVENT",
    title: "BGN밝은눈안과 EVENT",
    // 시안 2:2846 — 2행, 둘째 줄 앞부분만 SemiBold.
    description: "더 밝은 세상을 향한\nBGN의 특별한 혜택을 만나보세요",
    descriptionStrong: "BGN의 특별한 혜택",
    cta: "이벤트 보러가기",
    events: [
      {
        title: "SUMMER EVENT 뜨거운 8월",
        subtitle: "8월 한정 시력교정술 특별혜택",
        href: "/event/1",
        image: "/main/img_10_banner01.webp",
      },
      {
        title: "여름준비, 시력부터",
        subtitle: "혜택이 왔썸머",
        href: "/event/2",
        image: "/main/img_10_banner03.webp",
      },
      {
        title: "노안·백내장 수술 최대혜택 이벤트",
        subtitle: "",
        href: "/event/3",
        image: "/main/img_10_banner02.webp",
      },
    ],
  },

  footer: {
    intro: [
      "BGN밝은눈안과 잠실점은\n잠실역 롯데타워 11층에 위치해있습니다\n첨단 시설에서 숙련된 의료진이 제공하는\n검사와 수술을 만나보실 수 있습니다",
      "BGN밝은눈안과 잠실점은\n9세부터 80세까지 당신의 평생의 눈 건강을\n믿고 맡길 수 있는 곳이 되도록 노력하겠습니다",
    ],
    tel: "1600-5770",
    closedNotice: "일요일 휴진 | 공휴일 정상 진료(본원 사정에 따라 변동)",
    hoursNote: "* 일요일은 정기 휴진입니다.",
    branches: [
      {
        id: "jamsil",
        label: "BGN밝은눈안과의원 잠실",
        address: "서울특별시 송파구 올림픽로 300 롯데월드타워 11층",
        hours: [
          { label: "평일(월~금)", value: "09:30 - 18:00" },
          { label: "토요일", value: "09:30 - 17:00" },
          { label: "점심시간", value: "13:00 - 14:00" },
        ],
      },
      {
        id: "busan",
        label: "BGN밝은눈안과병원 부산",
        address: "",
        hours: [],
      },
    ],
    policyLinks: [
      { label: "개인정보처리방침", href: "/policy/privacy", strong: true },
      { label: "이용약관", href: "/policy/terms" },
      { label: "환자권리장전", href: "/policy/patient-rights" },
      // 시안 2:2949 는 "비급여재료비"다(이전 표기 "비급여자료고지"는 시안에 없다).
      { label: "비급여재료비", href: "/policy/non-covered" },
    ],
    business: [
      // ⚠️ 상호명 — 시안 2:2953 은 "밝은눈안과병원", 기획안(09-brief.md)은 "의원"으로 정정 지시.
      //    법적 표기라 임의로 못 정한다. 시안 기준으로 두되 **디자이너/법무 확인 필요**.
      { label: "상호명", value: "밝은눈안과병원" },
      // 시안 2:2956 — 대표자는 "박세광"(히스토리 인용문 발화자와도 일치).
      { label: "대표자", value: "박세광" },
      { label: "사업자 등록번호", value: "110-99-05290" },
      { label: "주소", value: "서울특별시 송파구 올림픽로 300 롯데월드타워 11층" },
      { label: "대표번호", value: "1600-5770" },
      // 시안에는 없는 항목이다(기획안 추가분). 시안 반영 시 지우지 말 것.
      { label: "개인정보보호책임자", value: "허서윤" },
    ],
    // 시안 2:2995 는 "EyeClinic"(붙여 씀)이다.
    copyright: "Copyright © BGN EyeClinic. All rights reserved.",
  },
};

/**
 * en/ja/zh 는 아직 원문이 없다. 번역이 오기 전까지 ko 를 그대로 노출한다
 * (빈 화면보다 낫고, 타입이 강제되므로 누락 시 컴파일 에러로 잡힌다).
 */
export const dictionaries: Record<Locale, Dictionary> = {
  ko,
  en: ko,
  ja: ko,
  zh: ko,
};
