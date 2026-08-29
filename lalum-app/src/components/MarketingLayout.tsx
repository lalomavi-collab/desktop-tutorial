import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
// The chat bot is deferred: it is not needed for first paint, so splitting it
// out keeps it (and its dependencies) off the initial load.
const ChatWidget = lazy(() => import("./ChatWidget").then((m) => ({ default: m.ChatWidget })));
// Same treatment for the floating video bubble: it carries a video element and
// is pure marketing, so it has no business in the first paint.
const VideoBubble = lazy(() => import("./VideoBubble").then((m) => ({ default: m.VideoBubble })));
import { BottomTabBar } from "./BottomTabBar";
import { ContactRail } from "./ContactRail";
import { A11yWidget } from "./A11yWidget";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { CookieConsent } from "./CookieConsent";
import { PrivacyUpdateNotice } from "./PrivacyUpdateNotice";
import { UserGuide } from "./UserGuide";
import { useLang } from "../context/LangContext";

export function MarketingLayout() {
  const { pathname, hash } = useLocation();
  const { t } = useLang();

  // Scroll to top on route change (unless the route targets an anchor).
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <>
      <a href="#main" className="skip-link">{t.ui.skipToContent}</a>
      <Header />
      <main id="main">
        {/* Keyed by path so each navigation replays the reveal (app-like page transition). */}
        <div key={pathname} className="route-view">
          {/* Code-split routes suspend while their chunk loads; the header and
              footer stay put, and a min-height spacer avoids layout shift. */}
          <Suspense fallback={<div style={{ minHeight: "70vh" }} />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
      <Suspense fallback={null}>
        <VideoBubble />
      </Suspense>
      <ContactRail />
      <BottomTabBar />
      <AccessibilityMenu />
      <A11yWidget />
      <CookieConsent />
      <PrivacyUpdateNotice />
      <UserGuide />
    </>
  );
}
