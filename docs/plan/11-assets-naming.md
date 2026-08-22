# 이미지 에셋 네이밍

`public/main/` **한 곳에 평탄화**한다. 하위 폴더를 만들지 않는다.

```
img_<섹션번호>_<역할><일련번호>.webp
```

섹션번호는 `main-page.tsx` 렌더 순서다. `00` 은 특정 섹션에 속하지 않는 전역 UI.

| 번호 | 섹션                              |
| ---: | --------------------------------- |
|   00 | 전역 (GNB · 메가메뉴 · 플로팅 퀵) |
|   01 | 히어로 (구체 → 타워)              |
|   02 | BGN 의료진                        |
|   03 | 브랜드 필름                       |
|   04 | BGN AI 정밀 검사 시스템           |
|   05 | AI 정밀 검사 상담 신청            |
|   06 | AI 브랜드 스토리                  |
|   07 | 진료 센터                         |
|   08 | 히스토리                          |
|   09 | Web blog                          |
|   10 | 이벤트                            |
|   11 | 클로징 스피어 (전용 에셋 없음)    |
|   12 | 컨택트 + 푸터                     |

연속물의 일련번호는 **화면에 나오는 순서**다 — `img_02_doctor01` 은 의료진 배열의 첫 번째,
`img_07_center01` 은 진료센터 배열의 첫 번째, `img_08_photo01` 은 연혁 첫 스텝이다.
파일명만으로는 어느 원장·어느 센터인지 알 수 없으므로 **아래 표가 유일한 대응표**다.

## 대응표

| 새 이름 (`public/main/`)       | 원래 경로                            | 사용 |
| ------------------------------ | ------------------------------------ | :--: |
| `img_00_mascot-icon-sm01.webp` | `brand/mascot-icon-sm.webp`          |  —   |
| `img_00_mascot-icon01.webp`    | `brand/mascot-icon.webp`             |  ○   |
| `img_00_mascot01.webp`         | `brand/mascot.webp`                  |  —   |
| `img_00_menu-bg01.webp`        | `main/menu/bg.webp`                  |  ○   |
| `img_00_orb01.webp`            | `brand/orb-sm.webp`                  |  —   |
| `img_01_bg01.webp`             | `main/hero/bg-1.webp`                |  ○   |
| `img_01_bg02.webp`             | `main/hero/bg-2.webp`                |  —   |
| `img_01_cloud-dark01.webp`     | `main/hero/cloud-dark-1.webp`        |  —   |
| `img_01_cloud-dark02.webp`     | `main/hero/cloud-dark-2.webp`        |  —   |
| `img_01_cloud01.webp`          | `main/hero/cloud-1.webp`             |  ○   |
| `img_01_cloud02.webp`          | `main/hero/cloud-2.webp`             |  ○   |
| `img_01_cloud03.webp`          | `main/hero/cloud-3.webp`             |  ○   |
| `img_01_cloud04.webp`          | `main/hero/cloud-4.webp`             |  ○   |
| `img_01_cloud05.webp`          | `main/hero/cloud-5.webp`             |  —   |
| `img_01_cloud06.webp`          | `main/hero/cloud-6.webp`             |  —   |
| `img_01_glow01.webp`           | `main/hero/glow.webp`                |  —   |
| `img_01_line01.webp`           | `main/hero/line-1.webp`              |  ○   |
| `img_01_line02.webp`           | `main/hero/line-2.webp`              |  ○   |
| `img_01_line03.webp`           | `main/hero/line-3.webp`              |  ○   |
| `img_01_line04.webp`           | `main/hero/line-4.webp`              |  —   |
| `img_01_line05.webp`           | `main/hero/line-5.webp`              |  —   |
| `img_01_line06.webp`           | `main/hero/line-6.webp`              |  —   |
| `img_01_line07.webp`           | `main/hero/line-7.webp`              |  —   |
| `img_01_line08.webp`           | `main/hero/line-8.webp`              |  —   |
| `img_01_line09.webp`           | `main/hero/line-9.webp`              |  ○   |
| `img_01_orb01.webp`            | `main/hero/orb.webp`                 |  —   |
| `img_01_particles01.webp`      | `main/hero/particles.webp`           |  ○   |
| `img_01_sphere-soft01.webp`    | `main/hero/sphere-soft.webp`         |  —   |
| `img_01_watermark01.svg`       | (Figma 8:759 에서 새로 추출)          |  ○   |
| `img_01_sphere01.webp`         | `main/hero/sphere.webp`              |  —   |
| `img_01_tower01.webp`          | `main/hero/tower.webp`               |  ○   |
| `img_01_wave01.webp`           | `main/hero/wave.webp`                |  —   |
| `img_02_bg01.webp`             | `main/team/bg.webp`                  |  ○   |
| `img_02_bg02.webp`             | `main/team/bg-2.webp`                |  —   |
| `img_02_doctor01.webp`         | `main/team/park-segwang.webp`        |  ○   |
| `img_02_doctor02.webp`         | `main/team/kim-jeongwan.webp`        |  ○   |
| `img_02_doctor03.webp`         | `main/team/han-jeongyeop.webp`       |  ○   |
| `img_02_doctor04.webp`         | `main/team/song-yunjung.webp`        |  ○   |
| `img_02_doctor05.webp`         | `main/team/kim-minkyung.webp`        |  ○   |
| `img_02_doctor06.webp`         | `main/team/lee-yeonho.webp`          |  ○   |
| `img_02_doctor07.webp`         | `main/team/kim-sohyun.webp`          |  ○   |
| `img_02_doctor08.webp`         | `main/team/lee-sumin.webp`           |  ○   |
| `img_03_overlay01.webp`        | `main/brand-film/overlay-spark.webp` |  ○   |
| `img_03_overlay02.webp`        | `main/brand-film/overlay-typo.webp`  |  ○   |
| `img_03_poster01.webp`         | `main/brand-film/poster.webp`        |  ○   |
| `img_03_poster02.webp`         | `main/brand-film/poster-2.webp`      |  ○   |
| `img_04_bg01.webp`             | `main/ai/bg-2.webp`                  |  ○   |
| `img_04_eye01.webp`            | `main/ai/eye-1.webp`                 |  ○   |
| `img_04_eye02.webp`            | `main/ai/eye-4.webp`                 |  ○   |
| `img_04_eye03.webp`            | `main/ai/eye-hero.webp`              |  ○   |
| `img_04_eye04.webp`            | `main/ai/eye-2.webp`                 |  —   |
| `img_04_eye05.webp`            | `main/ai/eye-3.webp`                 |  —   |
| `img_05_bg01.webp`             | `main/ai/bg.webp`                    |  ○   |
| `img_05_logo-glass-sm01.webp`  | `main/ai/logo-glass-sm.webp`         |  —   |
| `img_05_logo-glass01.webp`     | `main/ai/logo-glass.webp`            |  ○   |
| `img_06_card01.webp`           | `main/ai/story-card.webp`            |  ○   |
| `img_07_bg01.webp`             | `main/centers/bg.webp`               |  ○   |
| `img_07_bg02.webp`             | `main/centers/bg-2.webp`             |  —   |
| `img_07_center01.webp`         | `main/centers/smile.webp`            |  ○   |
| `img_07_center02.webp`         | `main/centers/consult.webp`          |  ○   |
| `img_07_center03.webp`         | `main/centers/cataract.webp`         |  ○   |
| `img_07_center04.webp`         | `main/centers/dream-lens.webp`       |  ○   |
| `img_07_center05.webp`         | `main/centers/dry-eye.webp`          |  ○   |
| `img_07_center06.webp`         | `main/centers/exam.webp`             |  ○   |
| `img_07_center07.webp`         | `main/centers/vision.webp`           |  —   |
| `img_08_bg01.webp`             | `main/history/bg.webp`               |  ○   |
| `img_08_bg02.webp`             | `main/history/bg-2.webp`             |  ○   |
| `img_08_photo01.webp`          | `main/history/event-2.webp`          |  ○   |
| `img_08_photo02.webp`          | `main/history/award.webp`            |  ○   |
| `img_08_photo03.webp`          | `main/history/cert.webp`             |  ○   |
| `img_08_photo04.webp`          | `main/history/zeiss.webp`            |  ○   |
| `img_08_photo05.webp`          | `main/history/group-2.webp`          |  ○   |
| `img_08_photo06.webp`          | `main/history/event-1.webp`          |  —   |
| `img_08_photo07.webp`          | `main/history/group-1.webp`          |  —   |
| `img_09_bg01.webp`             | `main/blog/bg.webp`                  |  ○   |
| `img_09_post01.webp`           | `main/blog/post-1.webp`              |  ○   |
| `img_09_post02.webp`           | `main/blog/post-2.webp`              |  ○   |
| `img_09_post03.webp`           | `main/blog/post-3.webp`              |  ○   |
| `img_09_post04.webp`           | `main/blog/post-4.webp`              |  ○   |
| `img_09_post05.webp`           | `main/blog/post-5.webp`              |  —   |
| `img_09_post06.webp`           | `main/blog/post-6.webp`              |  —   |
| `img_09_poster01.webp`         | `main/blog/video-poster.webp`        |  —   |
| `img_10_banner01.webp`         | `main/event/banner-1.webp`           |  ○   |
| `img_10_banner02.webp`         | `main/event/banner-2.webp`           |  ○   |
| `img_10_banner03.webp`         | `main/event/banner-3.webp`           |  ○   |
| `img_10_banner04.webp`         | `main/event/banner-4.webp`           |  —   |
| `img_10_banner05.webp`         | `main/event/banner-5.webp`           |  —   |
| `img_12_sphere01.webp`         | `main/footer/sphere.webp`            |  ○   |
| `img_12_wire01.webp`           | `main/footer/wire-1.webp`            |  —   |
| `img_12_wire02.webp`           | `main/footer/wire-2.webp`            |  —   |
| `img_12_wire03.webp`           | `main/footer/wire-3.webp`            |  ○   |
| `img_12_wire04.webp`           | `main/footer/wire-4.webp`            |  ○   |

`—` 는 현재 코드가 참조하지 않는 여분 에셋이다(시안 대체안·저해상도 중복본 등).
지우지 않고 남겨 뒀으니 필요해지면 그대로 쓰면 된다. 현재 59 / 92 사용 중.
