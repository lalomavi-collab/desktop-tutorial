import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LangProvider, langBasename } from "./context/LangContext";
import { AuthProvider } from "./context/AuthContext";
import { MarketingLayout } from "./components/MarketingLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NytroLoader } from "./components/NytroLoader";
import { Home } from "./pages/Home";

// The command bar (Cmd/Ctrl+K scheduling) is a power feature, not needed for
// first paint, so it is code split and loaded after the page renders.
const CommandBar = lazy(() => import("./components/CommandBar").then((m) => ({ default: m.CommandBar })));

// Home stays eager so the landing page renders instantly. Every other route is
// code split, so heavy pages (the ~1MB blog content behind Insights and
// Article) load only when visited, keeping the initial bundle small.
const Advisory = lazy(() => import("./pages/Advisory").then((m) => ({ default: m.Advisory })));
const AiLegalAdvisory = lazy(() => import("./pages/AiLegalAdvisory").then((m) => ({ default: m.AiLegalAdvisory })));
const RealEstateLegalAdvisory = lazy(() => import("./pages/RealEstateLegalAdvisory").then((m) => ({ default: m.RealEstateLegalAdvisory })));
const Training = lazy(() => import("./pages/Training").then((m) => ({ default: m.Training })));
const Insights = lazy(() => import("./pages/Insights").then((m) => ({ default: m.Insights })));
const Knowledge = lazy(() => import("./pages/Knowledge").then((m) => ({ default: m.Knowledge })));
const Faq = lazy(() => import("./pages/Faq").then((m) => ({ default: m.Faq })));
const Risk = lazy(() => import("./pages/Risk").then((m) => ({ default: m.Risk })));
const RiskResult = lazy(() => import("./pages/Risk").then((m) => ({ default: m.RiskResult })));
const Article = lazy(() => import("./pages/Article").then((m) => ({ default: m.Article })));
const Legal = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Legal })));
const Book = lazy(() => import("./pages/Book").then((m) => ({ default: m.Book })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Portal = lazy(() => import("./pages/Portal").then((m) => ({ default: m.Portal })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));

// Scroll to a #hash target after navigation, including cross-page links like
// "/#pre-deal" from the top nav. React Router does not do this on its own.
function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (tries++ < 10) {
        // The target route may still be lazy-loading; retry briefly.
        setTimeout(tick, 80);
      }
    };
    const t = setTimeout(tick, 60);
    return () => clearTimeout(t);
  }, [hash, pathname]);
  return null;
}

export default function App() {
  return (
    <LangProvider>
    <AuthProvider>
      <BrowserRouter basename={langBasename()}>
        <NytroLoader />
        <ScrollToHash />
        <Suspense fallback={null}>
          <CommandBar />
        </Suspense>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<Home />} />
            <Route path="advisory" element={<Advisory />} />
            <Route path="ai-legal-advisory" element={<AiLegalAdvisory />} />
            <Route path="real-estate-legal-advisory" element={<RealEstateLegalAdvisory />} />
            <Route path="training" element={<Training />} />
            {/* /courses is the public URL for the Academy; it is the same page
                as /training (labelled "Courses" in the nav). Without this alias
                a direct visit to /courses fell through to the catch-all Home. */}
            <Route path="courses" element={<Training />} />
            <Route path="insights" element={<Insights />} />
            <Route path="insights/:slug" element={<Article />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="faq" element={<Faq />} />
            <Route path="risk" element={<Risk />} />
            <Route path="risk/:track/:band" element={<RiskResult />} />
            <Route path="legal" element={<Legal />} />
            <Route path="book" element={<Book />} />
            <Route path="login" element={<Login />} />
            <Route
              path="portal"
              element={
                <ProtectedRoute>
                  <Portal />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LangProvider>
  );
}
