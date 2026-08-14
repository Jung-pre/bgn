# Color 시스템

전부 Figma 변수 실값이다.

## Primary

| Figma 변수            | HEX           | 용도                                            |
| --------------------- | ------------- | ----------------------------------------------- |
| `primary/primary/50`  | `#f2f8ff`     | 아주 옅은 배경                                  |
| `primary/primary/100` | `#e2effe`     | 형광 마커 배경, 태그                            |
| `primary/primary/200` | `#b7d8fd`     |                                                 |
| `primary/primary/300` | `#7cb9ff`     | 다크 위 영문 아이브로우, 센터카드 그라데이션 끝 |
| `primary/primary/500` | **`#0072ec`** | ★ 브랜드 기본 — CTA, 활성 탭/메뉴, 링크         |
| `primary/primary/700` | `#0c3ca2`     |                                                 |
| `primary/primary/800` | `#102c87`     |                                                 |
| `primary/primary/900` | `#0a2048`     | 헤드라인 최농도                                 |
| `primary/sub/500`     | `#8d79ff`     | 그라데이션의 보라 끝                            |

## Grayscale

| Figma 변수                   | HEX       | 용도                      |
| ---------------------------- | --------- | ------------------------- |
| `grayscale/white`            | `#ffffff` |                           |
| `grayscale/neutral gray/50`  | `#f9f9f9` |                           |
| `grayscale/neutral gray/100` | `#f2f2f2` | 아이콘 hover 배경         |
| `grayscale/neutral gray/200` | `#e4e4e4` | 보더                      |
| `grayscale/neutral gray/300` | `#d9d9d9` |                           |
| `grayscale/neutral gray/400` | `#a3a3a3` | GNB 구분선                |
| `grayscale/neutral gray/500` | `#737373` | 보조 텍스트               |
| `grayscale/neutral gray/600` | `#525252` |                           |
| `grayscale/neutral gray/700` | `#3d3d3d` | GNB 로그인/회원가입, 본문 |
| `grayscale/neutral gray/800` | `#242424` | **GNB 네비게이션 텍스트** |
| `grayscale/neutral gray/900` | `#171717` |                           |
| `grayscale/black`            | `#000000` |                           |
| `back_1`                     | `#f7f7f7` |                           |

## 알파 배경

| Figma 변수                        | 값                         |
| --------------------------------- | -------------------------- |
| `grayscale/background/whitebg-90` | `#ffffffe5` ← **GNB 배경** |
| `grayscale/background/whitebg-80` | `#ffffffcc`                |
| `grayscale/background/whitebg-70` | `#ffffffb2`                |
| `grayscale/background/whitebg-50` | `#ffffff80`                |
| `grayscale/background/whitebg-30` | `#ffffff4d`                |
| `grayscale/background/whitebg-20` | `#ffffff33`                |
| `grayscale/background/whitebg-10` | `#ffffff1a`                |
| `grayscale/background/blackbg-50` | `#00000080`                |
| `grayscale/background/blackbg-30` | `#0000004d`                |
| `grayscale/background/blackbg-20` | `#00000033`                |

## ⚠️ 그라데이션

Figma 에 `gradiant 1` / `gradiant 2` / `gradiant 3` 변수가 존재하나
**MCP 로 값이 해석되지 않는다**(빈 문자열 반환). 아래는 노드에서 추출한 값이다.

| 이름                   | 값                                                                                 | 출처              |
| ---------------------- | ---------------------------------------------------------------------------------- | ----------------- |
| 센터 카드              | `linear-gradient(180deg, #9c96b9, #7cb9ff)` + 노이즈(`mix-blend-mode: color-burn`) | `2:5400` **확정** |
| CTA / 모바일 활성 메뉴 | `linear-gradient(135deg, #0072ec, #8d79ff)`                                        | PDF 실측 **근사** |
| 다크 섹션 (Web blog)   | `linear-gradient(135deg, #002040, #003870, #002850)`                               | PDF 실측 **근사** |

→ 근사값 2개는 디자이너에게 `gradiant 1~3` 의 실제 정의를 요청할 것.

## 섹션 배경 (Figma 변수 미관리)

| 구간          | 톤                                 |
| ------------- | ---------------------------------- |
| 대부분 섹션   | `#eef3fb` 옅은 블루                |
| 의료진        | `#ece8f7` 라벤더                   |
| **AI 상담폼** | `#8a93a8` 슬레이트 — 유일한 중간톤 |
| **Web blog**  | 네이비 그라데이션 — 유일한 다크    |
| 클로징 / 푸터 | `#7f8aa4` 라벤더그레이             |
| 브랜드 필름   | 일몰 웜톤 — 유일한 웜톤            |
