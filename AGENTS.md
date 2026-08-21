<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/`
before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 이 레포에서 지켜야 할 것

- **로컬 포트는 3100.** `package.json` 의 `next dev`/`next start` 에서 `--port 3100` 을
  지우거나 3000 으로 되돌리지 말 것. 다른 프로젝트와 3000 이 겹친다.
- 커밋 전 `npm run typecheck && npm run lint` 통과.
- 3D 를 건드렸으면 `npm run build && npm run analyze:chunk` 까지. 진입 청크가 오염되면
  스크립트가 exit 1 로 실패한다.
- `src/components/**` 는 `@/shared/i18n/messages` 를 import 하지 않는다.
- 섹션 간 `*.module.css` 교차 import 금지. 공용이 필요하면 `src/components/` 로 승격.
