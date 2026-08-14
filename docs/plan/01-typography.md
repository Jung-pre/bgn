# Typography

폰트는 **Figma 변수에서 확정**된 값이다. 추정 아님.

| 용도                                           | 폰트           |
| ---------------------------------------------- | -------------- |
| 국문·본문 전체                                 | **Pretendard** |
| 영문 포인트 (아이브로우, 로고타입, 마퀴, 연도) | **Belleza**    |

> Belleza 는 Regular 400 **단일 웨이트**만 존재한다. 볼드가 필요하면
> 합성 볼드를 쓰지 말고 디자이너에게 대체 폰트를 요청할 것.

`letterSpacing` 은 **% 단위**다. `-3` → `-0.03em`
(검증: title 4 = 20px, Figma 출력 `tracking-[-0.6px]` = 20 × -0.03 ✓)

## PC 스타일

| Figma 변수                     | family      |    weight | size | lineHeight | letterSpacing |
| ------------------------------ | ----------- | --------: | ---: | ---------: | ------------: |
| `pc/headline/headline 1`       | Pretendard  |       700 |   42 |       1.25 |           -3% |
| `pc/headline/headline 2`       | Pretendard  |       700 |   32 |       1.25 |           -3% |
| `pc/headline/headline 4`       | Pretendard  |       600 |   20 |       1.25 |           -3% |
| `pc/title/title 1`             | Pretendard  |       700 |   42 |        1.5 |           -3% |
| `pc/title/title 2`             | Pretendard  |       700 |   32 |        1.5 |           -3% |
| `pc/title/title 3`             | Pretendard  |       600 |   26 |        1.5 |           -3% |
| `pc/title/title 4`             | Pretendard  |       600 |   20 |        1.5 |           -3% |
| `pc/body/body 0`               | Pretendard  |       400 |   20 |        1.5 |           -3% |
| `pc/body/body 1` / `1 - M`     | Pretendard  | 400 / 600 |   18 |        1.5 |           -3% |
| `pc/body/body 2` / `2 - M`     | Pretendard  | 400 / 600 |   16 |        1.5 |           -3% |
| `pc/body/body 3` / `3 - M`     | Pretendard  | 400 / 600 |   14 |        1.5 |           -3% |
| `pc/caption/caption 1`         | Pretendard  |       400 |   13 |       1.25 |           -3% |
| `pc/caption/caption 2 - M`     | Pretendard  |       600 |   13 |       1.25 |       **-5%** |
| `pc/eng - point/eng - point 1` | **Belleza** |       400 |   32 |        1.1 |       **+1%** |
| `pc/eng - point/eng - point 2` | **Belleza** |       400 |   24 |       1.25 |       **+1%** |

## 모바일 스타일

| Figma 변수                     |        weight | size | lineHeight |
| ------------------------------ | ------------: | ---: | ---------: |
| `mo/headline/headline 1`       |           700 |   32 |       1.25 |
| `mo/headline/headline 2`       |           700 |   24 |       1.25 |
| `mo/title/title 1`             |           700 |   32 |        1.5 |
| `mo/title/title 2`             |           700 |   24 |        1.5 |
| `mo/title/title 3`             |           600 |   20 |        1.5 |
| `mo/title/title 4`             |           600 |   18 |        1.5 |
| `mo/body/body 0`               |           400 |   18 |        1.5 |
| `mo/body/body 1` / `1 - M`     |     400 / 600 |   16 |        1.5 |
| `mo/body/body 2` / `2 - M`     |     400 / 600 |   15 |        1.5 |
| `mo/body/body 3 - M`           |           600 |   14 |        1.5 |
| `mo/caption/caption 1`         |           400 |   13 |       1.25 |
| `mo/eng - point/eng - point 2` | 400 (Belleza) |   20 |       1.25 |

## ⚠️ 변수 밖의 디스플레이 크기

**텍스트 스타일 체계는 42px 이 최대다.** 그보다 큰 텍스트는 전부 개별 지정이다.

| 위치                                | 실측                   |
| ----------------------------------- | ---------------------- |
| 히어로 `BGN` (`2:3073~5`)           | 글자 높이 144 → ≈120px |
| 히어로 `세상을 선명하게` (`2:3070`) | 256×53 → ≈40px         |
| 마퀴 / 푸터 대표번호 / 연도 숫자    | 80~120 (PDF 실측)      |

→ `globals.css` 에서 `--fs-display-*` 로 분리해 뒀다. 변수 스케일(`--fs-42` 이하)과
섞지 말 것. 디자이너에게 이 값들을 스타일로 등록해 달라고 요청하는 게 좋다.

## PC → MO 대응 (clamp 근거)

clamp 의 min 값은 임의 축소가 아니라 **`mo/*` 실값**이다.

```
pc headline 1  42 → mo headline 1  32   →  --fs-42
pc title 2     32 → mo title 2     24   →  --fs-32
pc title 3     26 → mo title 3     20   →  --fs-26
pc body 0      20 → mo body 0      18   →  --fs-20
pc body 1      18 → mo body 1      16   →  --fs-18
pc body 2      16 → mo body 2      15   →  --fs-16
pc eng 1       32 → mo eng 2       20   →  --fs-eng-32
```
