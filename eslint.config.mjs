/**
 * eslint-config-next 16 은 flat config 배열을 직접 export 한다.
 * (FlatCompat 로 감싸면 circular structure 에러가 난다 — 예전 문서를 따라가지 말 것)
 */
import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"],
  },
];

export default config;
