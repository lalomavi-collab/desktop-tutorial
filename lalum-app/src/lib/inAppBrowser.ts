// Detects the handful of in-app WebViews that never fire `beforeinstallprompt`
// and, on iOS, cannot install a PWA at all — WhatsApp, Instagram, Facebook,
// Messenger, TikTok and LINE all open links in their own embedded browser
// rather than the visitor's real one. There is no API that reports "you are
// inside an in-app browser"; every implementation, including this one, reads
// the same handful of known User-Agent substrings these apps happen to add.
// A false negative (an app that doesn't match) just means the banner stays
// silent — the existing header/footer install controls still show through
// their own `beforeinstallprompt`/fallback logic, so nothing regresses.
const SIGNATURES = [
  /FBAN|FBAV|FB_IAB/i, // Facebook, Messenger
  /Instagram/i,
  /WhatsApp/i,
  /Line\//i,
  /MicroMessenger/i, // WeChat
  /TikTok/i,
  /Twitter/i,
];

export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  return SIGNATURES.some((re) => re.test(ua));
}
