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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-analysis" element={<NewAnalysis />} />
          <Route path="/offer-intake" element={<OfferIntake />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/risk-scoring" element={<RiskScoring />} />
          <Route path="/priorities" element={<SellerPriorities />} />
          <Route path="/leverage" element={<Leverage />} />
          <Route path="/counter-strategy" element={<CounterStrategy />} />
          <Route path="/delta-view" element={<DeltaView />} />
          <Route path="/buyer-readiness" element={<BuyerReadiness />} />
          <Route path="/report" element={<Report />} />
          <Route path="/portal/:token" element={<SellerPortal />} />
          <Route path="/portal/:token/present" element={<SellerPresent />} />
          <Route path="/seller-report/:token" element={<SellerReportPDF />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
