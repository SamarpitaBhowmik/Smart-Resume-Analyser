import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "../components/LandingPage";
import Dashboard from "../components/Dashboard";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import ResearchReport from "../components/ResearchReport";

export default function Router(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage/>} />
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/analytics" element={<AnalyticsDashboard/>} />
        <Route path="/report/:resumeId" element={<ResearchReport/>} />
      </Routes>
    </BrowserRouter>
  );
}



