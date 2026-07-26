import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LangProvider } from "./context/LangContext";
import { AuthProvider } from "./context/AuthContext";
import { MarketingLayout } from "./components/MarketingLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Home } from "./pages/Home";
import { CommandBar } from "./components/CommandBar";

// Home stays eager so the landing page renders instantly. Every other route is
// code split, so heavy pages (the ~1MB blog content behind Insights and
// Article) load only when visited, keeping the initial bundle small.
const Advisory = lazy(() => import("./pages/Advisory").then((m) => ({ default: m.Advisory })));
const Training = lazy(() => import("./pages/Training").then((m) => ({ default: m.Training })));
const Insights = lazy(() => import("./pages/Insights").then((m) => ({ default: m.Insights })));
const Knowledge = lazy(() => import("./pages/Knowledge").then((m) => ({ default: m.Knowledge })));
const Faq = lazy(() => import("./pages/Faq").then((m) => ({ default: m.Faq })));
const Article = lazy(() => import("./pages/Article").then((m) => ({ default: m.Article })));
const Legal = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Legal })));
const Book = lazy(() => import("./pages/Book").then((m) => ({ default: m.Book })));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Portal = lazy(() => import("./pages/Portal").then((m) => ({ default: m.Portal })));

export default function App() {
  return (
    <LangProvider>
    <AuthProvider>
      <BrowserRouter>
        <CommandBar />
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<Home />} />
            <Route path="advisory" element={<Advisory />} />
            <Route path="training" element={<Training />} />
            <Route path="insights" element={<Insights />} />
            <Route path="insights/:slug" element={<Article />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="faq" element={<Faq />} />
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
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LangProvider>
  );
}
