import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProductCard from "./pages/ProductCard";
import AdminPage from "./pages/AdminPage";
import PasswordGate from "./pages/PasswordGate";

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  const isAdmin = location.pathname === "/admin";
  const _sp = new URLSearchParams(location.search);
  const isProduct =
    location.pathname === "/" && (_sp.has("c") || _sp.has("article"));

  if (isAdmin) {
    return (
      <PasswordGate mode="admin">
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </PasswordGate>
    );
  }

  if (isProduct) {
    return (
      <PasswordGate mode="catalog">
        <Routes>
          <Route path="/" element={<ProductCard />} />
        </Routes>
      </PasswordGate>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;