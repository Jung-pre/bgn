/**
 * 반응형 회귀 점검 — 여러 뷰포트에서 레이아웃 사고를 자동으로 잡는다.
 *
 *   node scripts/audit-responsive.mjs
 *   VPS="375x812,768x1024" node scripts/audit-responsive.mjs
 *
 * 사전 준비: `npm i -D playwright` 후 `npx playwright install chromium`,
 *           그리고 `npm run dev` 로 3100 포트가 떠 있어야 한다.
 *
 * 잡아내는 것
 *   · 가로 넘침       — 문서 스크롤 폭이 뷰포트보다 넓은가(모바일에서 페이지가 옆으로 끌림)
 *   · 넘침 원인 요소   — 클리핑 조상이 없는 채로 화면 밖에 나간 요소
 *   · 깨진 이미지      — naturalWidth 0
 *   · 글자 잘림        — nowrap 인데 내용이 상자보다 넓은 것
 *   · 11px 미만 글자
 *   · 콘솔 에러
 *
 * ⚠️ 스크롤을 끝까지 한 번 훑은 **뒤에** 재는 것이 중요하다. 가로 넘침은 로드 직후가
 *    아니라 스크롤 트리거가 돌고 난 뒤에 생기는 경우가 있다(실제로 그랬다).
 */
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:3100/ko';
const VIEWPORTS = (process.env.VPS || '1920x920,1440x900,1280x800,1024x768,768x1024,375x812')
  .split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { w, h }; });

const probe = () => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const out = { vw, scrollW: de.scrollWidth, docH: de.scrollHeight, overflowers: [], broken: [], clipped: [], tiny: [] };
  const name = (el) => {
    const c = (el.className && el.className.toString ? el.className.toString() : '')
      .split(' ').map((s) => s.replace(/^[a-z-]+-module__[A-Za-z0-9_-]+__/, '')).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1.5 && cs.position !== 'fixed') {
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') { clipped = true; break; }
      }
      if (!clipped) out.overflowers.push({ el: name(el), right: Math.round(r.right), w: Math.round(r.width) });
    }
    if (cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 8
        && el.children.length === 0 && el.textContent.trim()
        && !el.closest('.sr-only') && !(el instanceof SVGElement))
      out.clipped.push({ el: name(el), txt: el.textContent.trim().slice(0, 18), need: el.scrollWidth, has: el.clientWidth });
    if (el.children.length === 0 && el.textContent.trim() && parseFloat(cs.fontSize) < 11)
      out.tiny.push({ el: name(el), size: cs.fontSize });
  }
  for (const im of document.images) if (im.complete && im.naturalWidth === 0) out.broken.push(im.currentSrc || im.src);
  const uniq = (a, k) => { const s = new Set(); return a.filter((x) => !s.has(k(x)) && s.add(k(x))); };
  out.overflowers = uniq(out.overflowers, (x) => x.el).slice(0, 8);
  out.clipped = uniq(out.clipped, (x) => x.el + x.txt).slice(0, 8);
  out.tiny = uniq(out.tiny, (x) => x.el).slice(0, 5);
  out.broken = [...new Set(out.broken)].slice(0, 6);
  return out;
};

const browser = await chromium.launch();
let failed = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w <= 768 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 120)));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(vp.h * 0.7)) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(90); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(800);
  const r = await page.evaluate(probe);
  const over = r.scrollW - r.vw;
  const bad = over > 0 || r.broken.length || r.clipped.length || r.tiny.length;
  if (bad) failed++;
  console.log(`${vp.w}x${vp.h}`.padStart(10), `scrollW=${r.scrollW}`.padStart(14), (over > 0 ? `가로넘침 +${over}px` : 'OK'));
  for (const o of r.overflowers) console.log(`             ↳ 넘침 ${o.el} right=${o.right}`);
  for (const c of r.clipped) console.log(`             ↳ 잘림 ${c.el} "${c.txt}" ${c.has}<${c.need}`);
  for (const t of r.tiny) console.log(`             ↳ 작은글자 ${t.el} ${t.size}`);
  for (const b of r.broken) console.log(`             ↳ 깨진이미지 ${b}`);
  for (const e of [...new Set(errs)].slice(0, 3)) console.log(`             ↳ 콘솔 ${e}`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
