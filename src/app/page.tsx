import { redirect } from "next/navigation";
import { defaultLocale } from "@/shared/config/i18n";

/** middleware 가 이미 리다이렉트하지만, 이중 안전장치. */
export default function RootRedirect() {
  redirect(`/${defaultLocale}`);
}
