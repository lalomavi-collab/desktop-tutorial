import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ChatWidget } from "./ChatWidget";
import { WhatsAppButton } from "./WhatsAppButton";
import { BottomTabBar } from "./BottomTabBar";
import { A11yWidget } from "./A11yWidget";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { CookieConsent } from "./CookieConsent";
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
          <Outlet />
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
      <ChatWidget />
      <BottomTabBar />
      <AccessibilityMenu />
      <A11yWidget />
      <CookieConsent />
      <UserGuide />
    </>
  );
}
