import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LangProvider } from "./context/LangContext";
import { AuthProvider } from "./context/AuthContext";
import { MarketingLayout } from "./components/MarketingLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Home } from "./pages/Home";
import { Advisory } from "./pages/Advisory";
import { Training } from "./pages/Training";
import { Insights } from "./pages/Insights";
import { Article } from "./pages/Article";
import { Legal } from "./pages/Legal";
import { Book } from "./pages/Book";
import { Login } from "./pages/Login";
import { Portal } from "./pages/Portal";

export default function App() {
  return (
    <LangProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<Home />} />
            <Route path="advisory" element={<Advisory />} />
            <Route path="training" element={<Training />} />
            <Route path="insights" element={<Insights />} />
            <Route path="insights/:slug" element={<Article />} />
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
