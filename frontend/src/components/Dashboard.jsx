import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronLeft,
  FileText,
  Loader2,
  SearchCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  BrainCircuit,
  Fingerprint,
  Activity,
  Network
} from "lucide-react";
import {
  analyzeResumeAndJob,
  getJobSuggestions,
  getRoadmap,
  getResearchReport,
  uploadResume,
} from "../utils/api.js";
import AnalyticsDashboard from "./AnalyticsDashboard";
import ResumeRecommendations from "./ResumeRecommendations";
import ResearchReport from "./ResearchReport";

const REPORT_CACHE_PREFIX = "careeralign-report:";

function cacheReport(resumeId, report) {
  if (!resumeId || !report) return;
  try {
    sessionStorage.setItem(`${REPORT_CACHE_PREFIX}${resumeId}`, JSON.stringify(report));
  } catch (error) {
    console.error("Failed to cache report:", error);
  }
}

function buildLocalReportSnapshot({ resumeId, analysisResult, jobsResponse, roadmapResponse }) {
  const roadmap = roadmapResponse?.roadmap || analysisResult?.upskillingPlan || {};
  const jobs = jobsResponse?.jobs || [];
  const quality = analysisResult?.resumeQuality || {};
  const priorityRanking = roadmap.priorityRanking || analysisResult?.skillPriorityRanking || [];
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      resumeId,
    },
    summary: {
      jobFitScore: analysisResult?.match?.percentage || 0,
      resumeQualityScore: quality?.overallScore || 0,
      bestFitRole: jobs[0]?.title || "Best role unavailable",
      highestImpactMissingSkill: priorityRanking[0]?.skill || "No critical gap",
    },
    analysis: analysisResult,
    resumeQuality: quality,
    recommendations: roadmap,
    jobs,
    marketEvidence: {
      priorityRanking,
    },
    resultsSummary: {
      narrative: `${jobs[0]?.title || "Your strongest role match"} currently appears to be the best fit.`,
      interpretation: priorityRanking[0]?.skill
        ? `${priorityRanking[0].skill} is the strongest opportunity area and should be addressed first.`
        : "No priority gap was detected from the current analysis.",
    },
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const moduleContainerRef = useRef(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [resumeId, setResumeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState(null);
  
  // New state to hold dashboard results instead of redirecting
  const [dashboardData, setDashboardData] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null); // 'analytics' | 'pathways' | 'report' | null

  // States
  const loadingPhases = [
    { text: "Initializing Workspace...", progress: 10 },
    { text: "Extracting Semantic Graph...", progress: 30 },
    { text: "Querying Market Benchmarks...", progress: 50 },
    { text: "Calculating Confidence Matrix...", progress: 70 },
    { text: "Finalizing Intelligence Report...", progress: 90 }
  ];

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingPhase((prev) => (prev < loadingPhases.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (expandedSection && moduleContainerRef.current) {
      setTimeout(() => {
        moduleContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [expandedSection]);

  const resetAnalysis = () => {
    setResumeId(null);
    setLoadingPhase(0);
    setDashboardData(null);
    setExpandedSection(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("System requires a standard PDF for parsing.");
      return;
    }
    setResumeFile(file);
    resetAnalysis();
    setError(null);
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    resetAnalysis();
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jobDesc.trim()) {
      setError("Awaiting complete input payload: PDF & Job Profile required.");
      return;
    }
    setLoading(true);
    setLoadingPhase(0);
    setError(null);
    
    try {
      const uploadResponse = await uploadResume(resumeFile);
      setResumeId(uploadResponse.id);
      const analysisResponse = await analyzeResumeAndJob(uploadResponse.id, jobDesc);
      const jobsResponse = await getJobSuggestions(uploadResponse.id, 10);
      const roadmapResponse = await getRoadmap(uploadResponse.id, null);
      
      let finalReport;
      try {
        finalReport = await getResearchReport(uploadResponse.id);
      } catch (reportError) {
        finalReport = buildLocalReportSnapshot({
          resumeId: uploadResponse.id,
          analysisResult: analysisResponse,
          jobsResponse,
          roadmapResponse,
        });
      }
      cacheReport(uploadResponse.id, finalReport);
      
      // Instead of redirecting to /report, we stay in dashboard and show the workspace
      setDashboardData(finalReport);
    } catch (analysisError) {
      console.error(analysisError);
      setError(analysisError.message || "Intelligence synthesis failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950 flex flex-col">
      {/* Topbar */}
      <header className="border-b border-white/5 bg-dark-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate("/")} className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="h-6 w-[1px] bg-white/10"></div>
            <div className="flex items-center space-x-2">
              <BrainCircuit className="w-5 h-5 text-brand-light" />
              <span className="font-medium tracking-wide">Analysis Workspace</span>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono text-slate-500">
            {dashboardData && (
              <button 
                onClick={resetAnalysis}
                className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white mr-4"
              >
                NEW ANALYSIS
              </button>
            )}
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> System Optimal</span>
            <span>V2.0</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-dark/5 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-[1200px] w-full mx-auto z-10 flex-1 flex flex-col justify-center">
          
          {!dashboardData ? (
            // Pre-Analysis State
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto">
              {/* Left Side: Context / Readiness */}
              <div className="lg:col-span-5 space-y-8 flex flex-col justify-center">
                <div>
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
                    Initialize <br/><span className="text-slate-400">Intelligence Session</span>
                  </h1>
                  <p className="text-lg text-slate-400 font-light leading-relaxed max-w-md">
                    Deploy our AI engine to cross-reference your structural capabilities against live market demand benchmarks.
                  </p>
                </div>

                {/* Simulated Readiness Indicators */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">System Readiness</h3>
                  
                  <div className="flex items-center justify-between p-4 bg-dark-900 border border-white/5 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <Fingerprint className="w-5 h-5 text-brand-light" />
                      <span className="text-sm text-slate-300">Profile Artifact</span>
                    </div>
                    {resumeFile ? (
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">LOADED</span>
                    ) : (
                      <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-1 rounded">AWAITING INPUT</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-900 border border-white/5 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <Target className="w-5 h-5 text-brand-light" />
                      <span className="text-sm text-slate-300">Target Vector</span>
                    </div>
                    {jobDesc.length > 50 ? (
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">CALIBRATED</span>
                    ) : (
                      <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-1 rounded">AWAITING PARAMETERS</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-dark-900 border border-white/5 rounded-xl opacity-60">
                    <div className="flex items-center space-x-3">
                      <Activity className="w-5 h-5 text-slate-500" />
                      <span className="text-sm text-slate-400">Market Benchmarks</span>
                    </div>
                    <span className="text-xs font-mono text-brand-light bg-brand-light/10 px-2 py-1 rounded">ONLINE</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Upload Form */}
              <div className="lg:col-span-7">
                <div className="bg-dark-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden h-full flex flex-col justify-center">
                  
                  {loading && (
                    <div className="absolute inset-0 bg-dark-950/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-20 h-20 mb-8 relative">
                        <div className="absolute inset-0 rounded-full border-t-2 border-brand-light animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-b-2 border-accent animate-spin-slow"></div>
                        <BrainCircuit className="w-8 h-8 text-brand-light absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      
                      <h3 className="text-xl font-medium mb-2">{loadingPhases[loadingPhase].text}</h3>
                      <p className="text-sm text-slate-400 mb-8 font-mono">Process ID: 0x{Math.random().toString(16).substr(2, 8).toUpperCase()}</p>
                      
                      <div className="w-full max-w-sm bg-dark-800 rounded-full h-1 overflow-hidden">
                        <div 
                          className="bg-brand-light h-full transition-all duration-1000 ease-out"
                          style={{ width: `${loadingPhases[loadingPhase].progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">1. Candidate Profile (PDF)</label>
                      <label className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-brand-light/50 hover:bg-brand-light/5 transition-all">
                        {resumeFile ? (
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <FileText className="w-8 h-8 text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-100">{resumeFile.name}</span>
                            <button 
                              onClick={(e) => { e.preventDefault(); handleRemoveFile(); }}
                              className="absolute top-4 right-4 p-1.5 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="p-3 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                              <Upload className="w-6 h-6 text-brand-light" />
                            </div>
                            <span className="text-sm text-slate-400">Drag & drop or click to upload PDF</span>
                          </div>
                        )}
                        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">2. Target Role Vector (Job Description)</label>
                      <textarea
                        rows="6"
                        value={jobDesc}
                        onChange={(e) => { setJobDesc(e.target.value); setError(null); }}
                        className="w-full bg-dark-950 border border-white/10 rounded-2xl p-5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-light/50 focus:ring-1 focus:ring-brand-light/50 transition-all resize-none font-mono"
                        placeholder="Paste job description text here..."
                      />
                    </div>

                    {error && (
                      <div className="flex items-center space-x-2 text-rose-400 bg-rose-400/10 px-4 py-3 rounded-xl border border-rose-400/20">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                      </div>
                    )}

                    <button 
                      onClick={handleAnalyze} 
                      disabled={!resumeFile || !jobDesc.trim()}
                      className="w-full group relative overflow-hidden rounded-2xl bg-white text-dark-950 py-4 font-semibold tracking-wide transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <span className="relative z-10 flex items-center justify-center">
                        Execute Analysis
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>

                  </div>
                </div>
              </div>

            </div>
          ) : (
            // Post-Analysis Workspace State
            <div className="animate-fade-in space-y-8 py-8">
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
                    Intelligence <span className="text-brand-light">Synthesized</span>
                  </h1>
                  <p className="text-slate-400">
                    Analysis complete. Choose a module to explore the extracted insights.
                  </p>
                </div>
                
                <div className="flex items-center space-x-4 bg-dark-900 border border-white/10 p-4 rounded-xl">
                  <div className="text-center px-4 border-r border-white/5">
                    <div className="text-2xl font-bold text-white">{dashboardData.summary?.jobFitScore || 0}%</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Target Fit</div>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-2xl font-bold text-white">{dashboardData.summary?.resumeQualityScore || 0}%</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Profile Impact</div>
                  </div>
                </div>
              </div>

              {/* Actionable Portals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <button 
                  onClick={() => setExpandedSection(expandedSection === 'analytics' ? null : 'analytics')}
                  className={`bg-dark-900 border p-6 rounded-2xl text-left transition-all duration-300 group flex flex-col h-full ${
                    expandedSection === 'analytics' 
                      ? 'border-brand-light/60 bg-dark-900/90 shadow-[0_0_30px_rgba(56,189,248,0.15)] ring-1 ring-brand-light/30' 
                      : 'border-white/10 hover:border-brand-light/50'
                  }`}
                >
                  <div className={`mb-4 p-3 rounded-lg w-fit transition-colors ${
                    expandedSection === 'analytics' ? 'bg-brand-light/20' : 'bg-brand-light/10 group-hover:bg-brand-light/20'
                  }`}>
                    <BarChart3 className="w-6 h-6 text-brand-light" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-light transition-colors">Market Analytics</h3>
                  <p className="text-sm text-slate-400 mb-6 flex-1">
                    Explore demand curves, salary bands, and market readiness benchmarks for your missing skills.
                  </p>
                  <div className={`flex items-center text-sm font-medium text-white transition-all ${
                    expandedSection === 'analytics' ? 'text-brand-light' : 'group-hover:translate-x-1'
                  }`}>
                    {expandedSection === 'analytics' ? 'Collapse Module' : 'Explore Market Data'}
                    <ArrowRight className={`w-4 h-4 ml-2 transition-transform duration-300 ${
                      expandedSection === 'analytics' ? 'rotate-90 text-brand-light' : ''
                    }`} />
                  </div>
                </button>

                <button 
                  onClick={() => setExpandedSection(expandedSection === 'pathways' ? null : 'pathways')}
                  className={`bg-dark-900 border p-6 rounded-2xl text-left transition-all duration-300 group flex flex-col h-full ${
                    expandedSection === 'pathways' 
                      ? 'border-emerald-500/60 bg-dark-900/90 shadow-[0_0_30px_rgba(52,211,153,0.15)] ring-1 ring-emerald-500/30' 
                      : 'border-white/10 hover:border-emerald-500/50'
                  }`}
                >
                  <div className={`mb-4 p-3 rounded-lg w-fit transition-colors ${
                    expandedSection === 'pathways' ? 'bg-emerald-500/20' : 'bg-emerald-500/10 group-hover:bg-emerald-500/20'
                  }`}>
                    <Network className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">Pathway Engine</h3>
                  <p className="text-sm text-slate-400 mb-6 flex-1">
                    Discover adjacent roles and alternative career pathways matching your current baseline capabilities.
                  </p>
                  <div className={`flex items-center text-sm font-medium text-white transition-all ${
                    expandedSection === 'pathways' ? 'text-emerald-400' : 'group-hover:translate-x-1'
                  }`}>
                    {expandedSection === 'pathways' ? 'Collapse Module' : 'View Pathways'}
                    <ArrowRight className={`w-4 h-4 ml-2 transition-transform duration-300 ${
                      expandedSection === 'pathways' ? 'rotate-90 text-emerald-400' : ''
                    }`} />
                  </div>
                </button>

                <button 
                  onClick={() => setExpandedSection(expandedSection === 'report' ? null : 'report')}
                  className={`bg-dark-900 border p-6 rounded-2xl text-left transition-all duration-300 group flex flex-col h-full ${
                    expandedSection === 'report' 
                      ? 'border-violet-400/60 bg-dark-900/90 shadow-[0_0_30px_rgba(167,139,250,0.15)] ring-1 ring-violet-400/30' 
                      : 'border-white/10 hover:border-violet-400/50'
                  }`}
                >
                  <div className={`mb-4 p-3 rounded-lg w-fit transition-colors ${
                    expandedSection === 'report' ? 'bg-violet-400/20' : 'bg-violet-400/10 group-hover:bg-violet-400/20'
                  }`}>
                    <FileText className="w-6 h-6 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-400 transition-colors">Full Intelligence Report</h3>
                  <p className="text-sm text-slate-400 mb-6 flex-1">
                    Read the detailed breakdown, semantic constellation, and export the comprehensive PDF dossier.
                  </p>
                  <div className={`flex items-center text-sm font-medium text-white transition-all ${
                    expandedSection === 'report' ? 'text-violet-400' : 'group-hover:translate-x-1'
                  }`}>
                    {expandedSection === 'report' ? 'Collapse Module' : 'Open Report'}
                    <ArrowRight className={`w-4 h-4 ml-2 transition-transform duration-300 ${
                      expandedSection === 'report' ? 'rotate-90 text-violet-400' : ''
                    }`} />
                  </div>
                </button>

              </div>

              {/* Collapsible Expanded Module Container */}
              {expandedSection && (
                <div 
                  ref={moduleContainerRef}
                  className="mt-8 border-t border-white/5 pt-12 animate-fade-in space-y-6"
                >
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h2 className="text-2xl font-semibold flex items-center gap-3">
                      {expandedSection === 'analytics' && <><BarChart3 className="w-6 h-6 text-brand-light" /> Market Analytics</>}
                      {expandedSection === 'pathways' && <><Network className="w-6 h-6 text-emerald-400" /> Pathway Engine</>}
                      {expandedSection === 'report' && <><FileText className="w-6 h-6 text-violet-400" /> Full Intelligence Report</>}
                    </h2>
                    <button 
                      onClick={() => setExpandedSection(null)}
                      className="text-xs font-mono bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-colors text-slate-400 hover:text-white"
                    >
                      CLOSE MODULE
                    </button>
                  </div>
                  
                  <div className="w-full">
                    {expandedSection === 'analytics' && (
                      <AnalyticsDashboard 
                        resumeId={resumeId} 
                        embedded={true} 
                        onToggleSection={(sec) => setExpandedSection(sec)} 
                      />
                    )}
                    {expandedSection === 'pathways' && (
                      <ResumeRecommendations 
                        resumeId={resumeId} 
                        embedded={true} 
                        onToggleSection={(sec) => setExpandedSection(sec)} 
                      />
                    )}
                    {expandedSection === 'report' && (
                      <ResearchReport 
                        resumeId={resumeId} 
                        embedded={true} 
                        onToggleSection={(sec) => setExpandedSection(sec)} 
                      />
                    )}
                  </div>
                </div>
              )}

              {/* AI Reasoning Summary */}
              <div className="mt-8 bg-dark-950 border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center space-x-2 mb-4">
                  <BrainCircuit className="w-5 h-5 text-brand-light" />
                  <h3 className="font-semibold text-white">AI Engine Summary</h3>
                </div>
                <div className="p-4 bg-brand-dark/10 border border-brand-light/20 rounded-lg text-sm text-brand-light/90 font-mono leading-relaxed">
                  {dashboardData.resultsSummary?.narrative} {dashboardData.resultsSummary?.interpretation}
                </div>
              </div>

              {/* Strategic Roadmap */}
              {dashboardData.recommendations && (
                <div className="mt-8 bg-dark-950 border border-white/5 p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-amber-400" />
                      <h3 className="font-semibold text-white">Strategic Upskilling Roadmap</h3>
                    </div>
                    <span className="text-xs font-mono bg-amber-400/10 text-amber-400 px-3 py-1 rounded-full border border-amber-400/20">
                      Focus: {dashboardData.recommendations.focusSkill || 'Core Competencies'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...(dashboardData.recommendations.courses || []), ...(dashboardData.recommendations.projects || [])].slice(0, 3).map((item, i) => (
                      <div key={i} className="p-4 bg-dark-900 border border-white/5 rounded-xl hover:border-amber-400/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">{item.priorityLabel || 'High'} Priority</span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase bg-dark-950 px-2 py-0.5 rounded">{item.estimated_weeks || item.estimatedWeeks || '4'}w</span>
                        </div>
                        <h4 className="text-sm font-medium text-white mb-2 leading-tight">{item.title}</h4>
                        <p className="text-xs text-slate-400 mb-1">Target: <span className="text-slate-300">{item.targetSkill || item.skill}</span></p>
                      </div>
                    ))}
                  </div>
                  {(!dashboardData.recommendations.courses?.length && !dashboardData.recommendations.projects?.length) && (
                    <div className="text-sm text-slate-400 py-4 text-center">
                      No critical capability gaps detected for target trajectory.
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
