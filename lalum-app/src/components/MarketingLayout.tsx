import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ChatWidget } from "./ChatWidget";
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
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
