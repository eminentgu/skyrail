import english from "./english.json";

export type Language = "zh-CN" | "en";
const translations: Record<string, string> = english;
const cookiePreference = document.cookie.match(
  /(?:^|;\s*)skyrail_language=(en|zh-CN)(?:;|$)/,
)?.[1];
const preference = cookiePreference || localStorage.getItem("skyrail.language");
let language: Language =
  preference === "en" ||
  (!preference && !navigator.language.toLowerCase().startsWith("zh"))
    ? "en"
    : "zh-CN";

export function setLanguage(value: Language) {
  language = value;
  localStorage.setItem("skyrail.language", value);
  document.documentElement.lang = value;
  document.cookie =
    "skyrail_language=" + value + "; Path=/; SameSite=Lax; Max-Age=31536000";
}

export function getLanguage() {
  return language;
}

export function t(text: string, ...values: unknown[]) {
  const label = language === "en" ? translations[text] || text : text;
  return label.replace(/\{(\d+)\}/g, (match, index) =>
    index < values.length ? String(values[index]) : match,
  );
}
