# BGN 잠실 — 프론트엔드 스타터

`fe_work/shin`(광주신세계안과)에서 검증된 구조를 추출하고, 거기서 문제가 됐던 부분을
고쳐 만든 출발점입니다. 3D·섹션 인터랙션이 많은 스크롤 랜딩을 전제로 합니다.

## 실행

```bash
npm install
npm run dev          # http://localhost:3000/ko
npm run build
npm run analyze:chunk   # 빌드 후 — three/drei 가 진입 청크로 샜는지 검사
npm run typecheck
npm run lint
```

Node 20 LTS 이상.

## 기술 스택

| 구분       | 사용                                      |
| ---------- | ----------------------------------------- |
| 런타임     | Next.js 16 (App Router, Turbopack)        |
| UI         | React 19, TypeScript 5                    |
| 스타일     | CSS Modules + `globals.css` 토큰          |
| 스크롤     | Lenis + GSAP ScrollTrigger                |
| 애니메이션 | GSAP(스크롤 구동), Motion(상태 전환 연출) |
| 3D         | React Three Fiber + drei + three          |

## 디렉터리 규칙

```
src/
  app/                      라우터만. page.tsx 는 사전 조회 + feature import 만 한다
    layout.tsx              폰트 + metadata
    [locale]/layout.tsx     provider 스택
  components/               여러 페이지가 쓰는 UI. i18n messages 를 import하지 않는다
  features/<영역>/          섹션·도메인. messages 를 props 로 받는다
    main/sections/<섹션>/   섹션당 폴더. tsx + module.css 가 기본, 필요하면 use-*.ts 를 옆에 둔다
  r3f/                      3D 공통 인프라 (Canvas 껍데기, 가시성 훅)
  shared/
    config/                 i18n, breakpoints 등 상수 단일 소스
    lib/                    gsap 진입점, 미디어쿼리 훅, 사전 조회
    i18n/messages.ts        문구 사전
```

역할 경계:

- **GSAP ScrollTrigger** = 스크롤을 진행도/인덱스로 변환
- **ref** = 매 프레임 값을 3D 로 전달 (state 금지)
- **Motion** = 인덱스가 바뀔 때의 크로스페이드
- **R3F** = 렌더

넷이 같은 요소의 같은 속성을 동시에 건드리지 않게 유지하세요. shin 에서 문제가 났던
대부분이 이 경계가 흐려진 지점이었습니다.

## 새 스크롤 섹션 만들기

`src/features/main/sections/showcase/` 를 복사해서 시작하세요. 레퍼런스 구현입니다.

```tsx
const { sectionRef, pinRef, activeIndex, progressRef } = usePinnedProgress({
  steps: slides.length,
  scrub: 1,
});

<section ref={sectionRef} style={{ height: `${slides.length * 100}vh` }}>
  <div ref={pinRef} className={styles.pinShell}>
    ...
  </div>
</section>;
```

단순 등장 모션만 필요하면 `useSectionReveal()` 하나면 됩니다.

```tsx
const sectionRef = useSectionReveal<HTMLElement>();
<section ref={sectionRef}>
  <h2 data-reveal-item>…</h2>
</section>;
```

## 새 3D 섹션 만들기

1. 씬 파일은 `next/dynamic(..., { ssr: false })` 로만 import (three 는 SSR 에서 죽음)
2. Canvas 는 `<CanvasShell>` 로 감쌀 것 — dpr 클램프, context-loss 가드,
   invalidate 브리지가 들어 있음
3. 가시성은 `useSceneActive()` 로 — 화면 밖이면 `frameloop="never"` 로 내려감
4. 스크롤 값은 **ref** 로 전달, `useFrame` 안에서 수렴하면 self-invalidate 중단
5. 빌드 후 `npm run analyze:chunk` 로 진입 청크 오염 확인

GLB 를 쓸 때 URL·숫자 상수는 three 를 import 하지 않는 별도 `*-config.ts` 로 분리하세요.
그러지 않으면 부모가 상수를 static import 하는 순간 `useGLTF.preload()` 가
초기 로드에 딸려옵니다.

Draco 압축본(`npm run gltf:optimize`)을 쓰려면 `public/draco/` 에 디코더를 두고
`useGLTF(url, "/draco/")` 로 불러야 합니다. 이걸 빼먹으면 로드가 실패합니다.

## shin 에서 고친 것

| shin 의 문제                                                       | 여기서                                              |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `registerPlugin` 이 70개 파일에 중복                               | `shared/lib/gsap.ts` 한 곳                          |
| 브레이크포인트 `1023/1024/1025/1026` 혼재                          | `shared/config/breakpoints.ts` 단일 소스            |
| matchMedia 훅이 4곳에 복붙 + 쿼리 불일치                           | `useMediaQuery` 제네릭 하나                         |
| reduced-motion 을 early-return 으로 처리 → 콘텐츠가 안 보이는 사고 | `settleReducedMotion()` 으로 최종 상태 + clearProps |
| `sr-only` 유틸 부재                                                | `globals.css` 에 추가                               |
| 스크롤 락이 두 벌(직접 body 조작 / ref count)                      | ref count 한 벌로                                   |
| 섹션 간 `*.module.css` 교차 import                                 | 금지. 공용은 `components/` 로 승격                  |
| draco 파이프라인은 있는데 런타임 디코더 설정 없음                  | 스크립트가 경고 출력                                |

## rem 기준 주의

`globals.css` 의 `html { font-size: clamp(10px, 0.8333vw, 16px) }` 때문에
**데스크톱에서 rem 은 뷰포트에 비례해 축소됩니다** (1920px→16px, 1200px→10px).
1024px 이하는 16px 고정입니다. 이걸 모르고 rem 을 16px 고정이라 가정하면
데스크톱 레이아웃이 전부 어긋납니다.
