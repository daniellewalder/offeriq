import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NewAnalysis from "./pages/NewAnalysis.tsx";
import OfferIntake from "./pages/OfferIntake.tsx";
import Comparison from "./pages/Comparison.tsx";
import RiskScoring from "./pages/RiskScoring.tsx";
import SellerPriorities from "./pages/SellerPriorities.tsx";
import Leverage from "./pages/Leverage.tsx";
import CounterStrategy from "./pages/CounterStrategy.tsx";
import DeltaView from "./pages/DeltaView.tsx";
import BuyerReadiness from "./pages/BuyerReadiness.tsx";
import Report from "./pages/Report.tsx";
import SellerPortal from "./pages/SellerPortal.tsx";
import SellerPresent from "./pages/SellerPresent.tsx";
import SellerReportPDF from "./pages/SellerReportPDF.tsx";
import Auth from "./pages/Auth.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/new-analysis" element={<ProtectedRoute><NewAnalysis /></ProtectedRoute>} />
          <Route path="/offer-intake" element={<ProtectedRoute><OfferIntake /></ProtectedRoute>} />
          <Route path="/comparison" element={<ProtectedRoute><Comparison /></ProtectedRoute>} />
          <Route path="/risk-scoring" element={<ProtectedRoute><RiskScoring /></ProtectedRoute>} />
          <Route path="/priorities" element={<ProtectedRoute><SellerPriorities /></ProtectedRoute>} />
          <Route path="/leverage" element={<ProtectedRoute><Leverage /></ProtectedRoute>} />
          <Route path="/counter-strategy" element={<ProtectedRoute><CounterStrategy /></ProtectedRoute>} />
          <Route path="/delta-view" element={<ProtectedRoute><DeltaView /></ProtectedRoute>} />
          <Route path="/buyer-readiness" element={<ProtectedRoute><BuyerReadiness /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/portal/:token" element={<SellerPortal />} />
          <Route path="/portal/:token/present" element={<SellerPresent />} />
          <Route path="/seller-report/:token" element={<SellerReportPDF />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
