# Border Radius

|     값 | 사용처                                  | 출처          |
| -----: | --------------------------------------- | ------------- |
| **12** | 모바일 GNB 바                           | PDF 실측      |
| **16** | PC GNB 바, 드롭다운                     | `2:2404` 확정 |
| **24** | 진료센터 카드                           | `2:5400` 확정 |
|   full | CTA 필 버튼, 지점 탭, 아이콘 버튼, 도트 | PDF 실측      |

`globals.css` 매핑:

```css
--radius-sm: 0.5rem; /*  8 */
--radius-md: 1rem; /* 16  ← GNB */
--radius-lg: 1.5rem; /* 24  ← 센터 카드 */
--radius-xl: 2rem; /* 32 */
--radius-full: 999px;
--gnb-radius: 16px;
--center-card-radius: 24px;
```

> radius 는 Figma 변수로 관리되지 않는다(노드 직접 지정).
> 값이 더 필요하면 해당 노드에 `get_design_context` 를 걸어 확인할 것.
