# Figma 변수 → CSS 변수 매핑

`src/app/globals.css` 에 이미 적용돼 있다. 이 문서는 대조표다.

## Color

| Figma                                     | CSS                                 |
| ----------------------------------------- | ----------------------------------- |
| `primary/primary/50`                      | `--primary-50`                      |
| `primary/primary/100`                     | `--primary-100` / `--brand-tint`    |
| `primary/primary/200`                     | `--primary-200`                     |
| `primary/primary/300`                     | `--primary-300`                     |
| `primary/primary/500`                     | `--primary-500` / `--brand-primary` |
| `primary/primary/700`                     | `--primary-700`                     |
| `primary/primary/800`                     | `--primary-800`                     |
| `primary/primary/900`                     | `--primary-900` / `--brand-navy`    |
| `primary/sub/500`                         | `--primary-sub-500`                 |
| `grayscale/neutral gray/{50..900}`        | `--gray-{50..900}`                  |
| `grayscale/white` / `black`               | `--color-white` / `--color-black`   |
| `grayscale/background/whitebg-{10..90}`   | `--whitebg-{10..90}`                |
| `grayscale/background/blackbg-{20,30,50}` | `--blackbg-{20,30,50}`              |
| `back_1`                                  | `--back-1`                          |

## Typography

Figma 텍스트 스타일은 `font` 단축 속성으로 그대로 옮겼다.

| Figma                              | CSS                    |
| ---------------------------------- | ---------------------- |
| `pc/headline/headline {1,2,4}`     | `--t-headline-{1,2,4}` |
| `pc/title/title {1..4}`            | `--t-title-{1..4}`     |
| `pc/body/body {0..3}`              | `--t-body-{0..3}`      |
| `pc/caption/caption 1`             | `--t-caption-1`        |
| `pc/eng - point/eng - point {1,2}` | `--t-eng-{1,2}`        |

`-M` 변형(SemiBold)은 별도 변수를 만들지 않고 `font-weight: 600` 으로 덮는다.

반응형이 필요한 곳은 위 단축 속성 대신 **`--fs-*` (clamp px)** 를 쓴다.
clamp 의 min 은 `mo/*` 실값이다 — 임의 축소가 아니다.

| CSS           |  PC |  MO |
| ------------- | --: | --: |
| `--fs-42`     |  42 |  32 |
| `--fs-32`     |  32 |  24 |
| `--fs-26`     |  26 |  20 |
| `--fs-20`     |  20 |  18 |
| `--fs-18`     |  18 |  16 |
| `--fs-16`     |  16 |  15 |
| `--fs-eng-32` |  32 |  20 |

변수 밖 디스플레이 크기: `--fs-display-120`, `--fs-display-92`, `--fs-display-80`

## letterSpacing

Figma 값은 **%** 다.

| Figma                  | CSS                            |
| ---------------------- | ------------------------------ |
| `-3` (거의 전부)       | `--tracking-default: -0.03em`  |
| `-5` (`caption 2 - M`) | `--tracking-caption2: -0.05em` |
| `+1` (`eng - point`)   | `--tracking-eng: 0.01em`       |

## Layout

| 실측                              | CSS                                            |
| --------------------------------- | ---------------------------------------------- |
| 콘텐츠 1760 / 여백 80             | `--content-width` / `--content-side-pad`       |
| GNB 1840 × 80, top 24, inset 40   | `--gnb-*`                                      |
| GNB radius 16 / blur 25 / shadow  | `--gnb-radius` / `--gnb-blur` / `--gnb-shadow` |
| 모바일 거터 20                    | `--mobile-gutter`                              |
| 센터카드 240 / 1120 / 64 / gap 32 | `--center-card-*`                              |

## 미해결

- `gradiant 1` / `gradiant 2` / `gradiant 3` — Figma 변수는 존재하나
  MCP 가 값을 반환하지 않는다. CTA·다크섹션 그라데이션은 현재 PDF 근사값이다.
- radius 는 Figma 변수로 관리되지 않는다(노드 직접 지정).
- 섹션 배경색도 변수 밖이다.
