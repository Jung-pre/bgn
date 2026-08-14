# 히어로 에셋 export 목록

Figma 파일: `2xzudppVSWEHbxVdzofgn3`
저장 위치: `C:\fe_work\bgn\public\main\hero\` (폴더는 만들어 뒀습니다)

Figma 에서 노드 선택 → 우측 하단 **Export** → 아래 배율/포맷으로 저장하면 됩니다.
파일명은 **정확히** 아래대로 — `hero-assets.ts` 가 이 경로를 그대로 참조합니다.

---

## 1순위 — 이것만 있으면 타워 씬이 완성됩니다

| 노드 ID | Figma 레이어명     | 원본 크기   | 저장 파일명   | 배율 | 포맷 |
| ------- | ------------------ | ----------- | ------------- | ---- | ---- |
| `2:930` | `TOWER (2) 2`      | 1405 × 1277 | `tower.png`   | 2x   | PNG  |
| `2:862` | `twi001t3387211 1` | 1920 × 1080 | `texture.png` | 1x   | PNG  |

- **타워는 반드시 PNG** — 배경이 투명해야 하늘 그라데이션 위에 얹힙니다. JPG 로 뽑으면
  검은 사각형이 됩니다.
- **텍스처는 1x 로 충분** — `mix-blend-mode: soft-light` 로 opacity 50% 에 깔리는
  노이즈라 해상도를 올려도 눈에 안 보이고 용량만 2배가 됩니다.

이 2장을 넣은 뒤 `src/features/main/sections/hero/hero-assets.ts` 의

```ts
export const HERO_ASSETS_READY = false;
```

를 `true` 로 바꾸면 자리표 그라데이션이 사라지고 실제 이미지가 들어갑니다.
(제가 대신 바꿔도 됩니다 — 파일만 넣어 주세요)

---

## 2순위 — 있으면 좋지만 배치 코드를 더 짜야 합니다

현재 `hero-section.tsx` 는 타워와 텍스처만 렌더합니다. 아래는 경로만 정의돼 있고
아직 화면에 안 붙어 있습니다. 넣어 주시면 스크롤 패럴랙스로 배선하겠습니다.

| 노드 ID | 용도   | 저장 파일명   | 배율 | 포맷 |
| ------- | ------ | ------------- | ---- | ---- |
| `2:863` | 구름 1 | `cloud-1.png` | 2x   | PNG  |
| `2:874` | 구름 2 | `cloud-2.png` | 2x   | PNG  |
| `2:934` | 광선 1 | `line-1.png`  | 2x   | PNG  |
| `2:937` | 광선 2 | `line-2.png`  | 2x   | PNG  |
| `2:938` | 광선 3 | `line-3.png`  | 2x   | PNG  |
| `2:939` | 광선 4 | `line-4.png`  | 2x   | PNG  |

---

## 더 이상 필요 없는 것

| 노드 ID  | 내용          | 사유                                                       |
| -------- | ------------- | ---------------------------------------------------------- |
| `2:416`  | 구체 (PC)     | 실시간 3D 파티클로 대체 (`scene-sphere.tsx`)               |
| `2:3746` | 구체 (모바일) | 동일. 뷰포트 종횡비로 자동 축소되므로 모바일 전용본 불필요 |

---

## 저장 후 제가 하는 것

1. `npm run assets:webp` — PNG → WebP 변환 후 `<picture>` 로 폴백 배선
   (타워 2x PNG 는 3~4MB 대라 그대로 쓰면 히어로 LCP 가 무너집니다)
2. 실측 크기에 맞춰 `hero-section.module.css` 의 `.towerImg` 위치·스케일 재조정
3. `HERO_ASSETS_READY = true`
4. 헤드리스 렌더로 시안(`2:3008`) 대조

## 참고 — 왜 제가 직접 못 받았는가

Figma MCP 는 에셋 URL 을 정상적으로 내줍니다. 다만 이 세션이 도는 클라우드 컨테이너에서
`figma.com` 이 이그레스 프록시에 막혀 있습니다.

```
curl  → CONNECT tunnel failed, response 403
WebFetch → ROBOTS_DISALLOWED
```

사용자 PC 쪽 셸(`device_bash`)도 네트워크가 없어 같은 벽에 막힙니다.
연결된 Chrome 확장을 경유하는 우회로는 가능하지만, 다운로드 폴더 권한이 한 번 더 필요하고
저장 위치가 Chrome 설정에 좌우돼 Figma 에서 직접 export 하는 쪽이 확실합니다.
