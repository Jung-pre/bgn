#!/usr/bin/env python3
"""
피그마 원본에서 **다시 크게** 뽑는 스크립트.

## 왜 필요했나
최초 반입은 `_figma/place.py` 가 폭 상한을 일괄로 걸었다 — 배경 2400 / 카드 1600 /
나머지 2000. 그런데 실제 렌더 크기를 재보니 몇 개는 그 상한 때문에 **화면보다 작게**
들어가 있었다. 대표적으로 `line-2` 는 원본이 4096×470 인데 2000×229 로 줄어
화면에서 1.42배 확대되고 있었다.

## 원칙
목표 폭 = **실측 렌더 CSS 폭 × 2** (2배 화면 기준). 단 원본보다 크게는 못 뽑는다 —
늘리기만 한 건 선명해지지 않는다. 실제로 대부분의 자산은 피그마 원본이 이미
현재 파일과 같은 크기여서 손댈 게 없었다. 아래 5개만 여유가 있었다.

## 실행
`_figma/raw/` (피그마 원본 PNG 450장)가 있는 환경에서:
    python3 scripts/reexport-hi-res.py
"""
# 렌더 실측(CSS px) x2 를 목표 폭으로 다시 뽑는다.
# place.py 의 일괄 상한(2400/2000/1600) 때문에 원본보다 작게 들어간 것들만 대상.
import glob, os, re
from PIL import Image

# raw 파일 번호 → (목적지, 목표 폭)
JOBS = [
    ("0248", "main/hero/line-2.webp",   4096),  # 렌더 2829 → 2x 5658, 원본 4096 이 상한
    ("0033", "main/hero/particles.webp",3600),  # 렌더 2102 → 2x 4204, 4096 은 용량 과함
    ("0044", "main/hero/cloud-1.webp",  2296),  # 렌더 1134 → 2x 2268, 원본 2296
    ("0025", "main/menu/bg.webp",       3200),  # 전체메뉴 배경 (풀스크린)
    ("0053", "main/team/bg.webp",       3200),  # 의료진 섹션 배경 (풀스크린)
]
RAW = os.environ.get("BGN_FIGMA_RAW", "_figma")
OUT = "public"
for num, dest, cap in JOBS:
    g = glob.glob(os.path.join(RAW, "raw", f"{num}-*.png"))
    if not g:
        print("SKIP(원본없음)", dest); continue
    im = Image.open(g[0])
    ow, oh = im.size
    if im.width > cap:
        im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
    out = os.path.normpath(os.path.join(OUT, dest))
    old = os.path.getsize(out) if os.path.exists(out) else 0
    oldsz = Image.open(out).size if os.path.exists(out) else (0,0)
    # q 88 → 90, effort 4 → 6, 크로마 서브샘플링 개선
    im.save(out, "WEBP", quality=90, method=6, alpha_quality=95)
    new = os.path.getsize(out)
    print(f"{dest}: 원본 {ow}x{oh} / 이전 {oldsz[0]}x{oldsz[1]} {old//1024}kB → {im.width}x{im.height} {new//1024}kB")
