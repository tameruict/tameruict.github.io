export type Locale = "vi" | "en";

export const languageNames: Record<Locale, string> = {
  vi: "VI",
  en: "EN",
};

export const localeFromPath = (pathname: string): Locale =>
  pathname === "/en" || pathname.startsWith("/en/") ? "en" : "vi";

export const localizedPath = (path: string, locale: Locale) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "vi") return normalized.replace(/^\/en(?=\/|$)/, "") || "/";
  return normalized === "/" ? "/en/" : `/en${normalized}`;
};

export const alternateLocalePath = (pathname: string) =>
  localeFromPath(pathname) === "vi"
    ? localizedPath(pathname, "en")
    : localizedPath(pathname, "vi");

export const writeupPath = (translationKey: string, locale: Locale) =>
  localizedPath(`/writeups/${translationKey}/`, locale);

export const ui = {
  vi: {
    home: "Trang chủ",
    navLabel: "Điều hướng chính",
    homeLabel: "Tameru Write-ups, trang chủ",
    switchLabel: "Chuyển sang tiếng Anh",
    skip: "Đi đến nội dung",
  },
  en: {
    home: "Home",
    navLabel: "Main navigation",
    homeLabel: "Tameru Write-ups, home",
    switchLabel: "Switch to Vietnamese",
    skip: "Skip to content",
  },
} as const;
