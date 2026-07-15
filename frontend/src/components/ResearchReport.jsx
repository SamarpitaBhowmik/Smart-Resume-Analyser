import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronLeft, Download, FileText, Loader2, AlertCircle, Briefcase, Target, TrendingUp, ShieldCheck,
  BarChart3, CheckCircle2, AlertTriangle, Sparkles, BrainCircuit, Network, ChevronDown, ChevronRight, Fingerprint,
  ArrowRight
} from "lucide-react";
import { getResearchReport, getResearchReportPdfUrl } from "../utils/api.js";

const COLORS = ["#38bdf8", "#60a5fa", "#34d399", "#f59e0b", "#f97316", "#f43f5e"];
const REPORT_CACHE_PREFIX = "careeralign-report:";

// Semantic Constellation Visualization
const SemanticConstellation = ({ matchedSkills, missingSkills }) => {
  const [nodes, setNodes] = useState([]);
  
  useEffect(() => {
    // Generate static positions for skills
    const generateNodes = () => {
      const allNodes = [];
      const centerX = 200;
      const centerY = 200;
      
      // Central Node
      allNodes.push({ id: 'core', label: 'Profile Core', x: centerX, y: centerY, type: 'core', radius: 40 });

      // Matched Skills (Inner Orbit)
      const matched = (matchedSkills || []).slice(0, 8);
      matched.forEach((skill, i) => {
        const angle = (i * (360 / matched.length)) * (Math.PI / 180);
        const distance = 90;
        allNodes.push({
          id: `match-${i}`, label: skill, type: 'match',
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          radius: 25
        });
      });

      // Missing Skills (Outer Orbit)
      const missing = (missingSkills || []).slice(0, 6);
      missing.forEach((skill, i) => {
        const angle = (i * (360 / missing.length) + 30) * (Math.PI / 180);
        const distance = 160;
        allNodes.push({
          id: `miss-${i}`, label: skill, type: 'missing',
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          radius: 20
        });
      });
      return allNodes;
    };
    setNodes(generateNodes());
  }, [matchedSkills, missingSkills]);

  return (
    <div className="relative w-full aspect-square max-w-[400px] mx-auto overflow-visible">
      <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible">
        <defs>
          <radialGradient id="glowMatch" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glowMissing" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Connections */}
        {nodes.map((node) => {
          if (node.type === 'core') return null;
          return (
            <line
              key={`line-${node.id}`}
              x1="200" y1="200" x2={node.x} y2={node.y}
              stroke={node.type === 'match' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(244, 63, 94, 0.2)'}
              strokeWidth={node.type === 'match' ? '2' : '1'}
              strokeDasharray={node.type === 'missing' ? '4 4' : 'none'}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="transition-transform duration-700 ease-in-out hover:scale-110">
            {node.type === 'core' && (
              <>
                <circle r={node.radius + 15} fill="rgba(56, 189, 248, 0.1)" className="animate-pulse" />
                <circle r={node.radius} fill="#0ea5e9" opacity="0.8" />
                <Fingerprint x="-16" y="-16" width="32" height="32" color="white" />
              </>
            )}
            {node.type === 'match' && (
              <>
                <circle r={node.radius + 10} fill="url(#glowMatch)" />
                <circle r={node.radius} fill="#059669" stroke="#34d399" strokeWidth="2" />
                <text y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" className="pointer-events-none">{node.label.substring(0, 8)}{node.label.length > 8 ? '..' : ''}</text>
              </>
            )}
            {node.type === 'missing' && (
              <>
                <circle r={node.radius + 8} fill="url(#glowMissing)" />
                <circle r={node.radius} fill="#881337" stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 2" />
                <text y="3" textAnchor="middle" fill="#fecdd3" fontSize="9" className="pointer-events-none">{node.label.substring(0, 8)}{node.label.length > 8 ? '..' : ''}</text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

function scoreTone(score = 0) {
  if (score >= 80) return { value: "text-emerald-300", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" };
  if (score >= 60) return { value: "text-sky-300", badge: "border-sky-500/30 bg-sky-500/10 text-sky-200" };
  if (score >= 40) return { value: "text-amber-300", badge: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  return { value: "text-rose-300", badge: "border-rose-500/30 bg-rose-500/10 text-rose-200" };
}

function MetricRing({ score, label }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const tone = scoreTone(score).value;
  const strokeColor = score >= 80 ? '#34d399' : score >= 60 ? '#38bdf8' : score >= 40 ? '#fbbf24' : '#f43f5e';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r="30" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="transparent" />
          <circle cx="40" cy="40" r="30" stroke={strokeColor} strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${tone}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-slate-400 mt-2 text-center uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ExpandableIntelligence({ title, reasoning, children }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-white/10 bg-dark-900 rounded-xl overflow-hidden transition-all duration-300">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors">
        <div className="flex items-center space-x-3">
          <BrainCircuit className="w-5 h-5 text-brand-light" />
          <span className="font-semibold text-white">{title}</span>
        </div>
        {expanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>
      {expanded && (
        <div className="p-5 border-t border-white/5 space-y-4">
          {reasoning && (
            <div className="p-4 bg-brand-dark/10 border border-brand-light/20 rounded-lg text-sm text-brand-light/90 font-mono leading-relaxed">
              <span className="font-bold text-brand-light uppercase mr-2">AI Reasoning:</span>
              {reasoning}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export default function ResearchReport({ resumeId: propResumeId, embedded = false, onToggleSection }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resumeId: paramResumeId } = useParams();
  const resumeId = propResumeId || paramResumeId;
  const [activeTab, setActiveTab] = useState('summary');
  
  const initialReport = useMemo(() => {
    if (!embedded && location.state?.report) return location.state.report;
    if (resumeId) {
      try {
        const cached = sessionStorage.getItem(`${REPORT_CACHE_PREFIX}${resumeId}`);
        return cached ? JSON.parse(cached) : null;
      } catch { return null; }
    }
    return null;
  }, [resumeId, embedded, location.state?.report]);

  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(initialReport);

  useEffect(() => {
    let initialData = null;
    if (!embedded && location.state?.report) {
      initialData = location.state.report;
    } else if (resumeId) {
      try {
        const cached = sessionStorage.getItem(`${REPORT_CACHE_PREFIX}${resumeId}`);
        if (cached) initialData = JSON.parse(cached);
      } catch (e) {}
    }

    if (initialData) {
      setReport(initialData);
      setLoading(false);
      setError(null);
      return;
    }

    setReport(null);
    setLoading(true);
    setError(null);

    if (!resumeId) {
      setError("No profile ID provided for report generation.");
      setLoading(false);
      return;
    }

    let mounted = true;
    async function loadReport() {
      try {
        const data = await getResearchReport(resumeId);
        if (mounted) {
          setReport(data);
          try {
            sessionStorage.setItem(`${REPORT_CACHE_PREFIX}${resumeId}`, JSON.stringify(data));
          } catch (e) {}
        }
      } catch (loadError) {
        if (mounted) setError(loadError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadReport();
    return () => { mounted = false; };
  }, [resumeId, embedded, location.state?.report]);

  if (loading) {
    return (
      <div className={embedded ? "flex flex-col items-center justify-center py-20" : "min-h-screen bg-dark-950 flex flex-col items-center justify-center"}>
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full border-t-2 border-brand-light animate-spin"></div>
          <BrainCircuit className="w-10 h-10 text-brand-light absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-sm font-mono text-brand-light tracking-widest uppercase animate-pulse">Compiling Intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={embedded ? "flex items-center justify-center p-6" : "min-h-screen bg-dark-950 flex items-center justify-center p-6"}>
        <div className="bg-dark-900 border border-rose-500/30 p-8 rounded-2xl max-w-lg w-full text-center">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Intelligence Corrupted</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          {embedded ? (
            <button onClick={() => onToggleSection && onToggleSection(null)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors">Close</button>
          ) : (
            <button onClick={() => navigate("/dashboard")} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors">Return to Workspace</button>
          )}
        </div>
      </div>
    );
  }

  const summary = report?.summary || {};
  const analysis = report?.analysis || {};
  const quality = report?.resumeQuality || {};
  const marketEvidence = report?.marketEvidence || {};
  const recommendations = report?.recommendations || {};
  const jobs = report?.jobs || [];

  const matchedSkillsList = report?.matchedSkills || analysis?.match?.matchedSkills || report?.summary?.matchedSkills || [];
  const missingSkillsList = report?.missingSkills || analysis?.match?.missingSkills || report?.summary?.missingSkills || [];

  return (
    <div className={embedded ? "text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950" : "min-h-screen bg-dark-950 text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950"}>
      
      {/* Topbar */}
      {!embedded && (
        <header className="sticky top-0 z-50 border-b border-white/5 bg-dark-950/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate("/dashboard")} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="h-4 w-[1px] bg-white/10"></div>
              <span className="font-medium tracking-wide text-sm">Career Intelligence Report</span>
            </div>
            <div className="flex items-center space-x-4">
               <button onClick={() => window.open(getResearchReportPdfUrl(resumeId))} className="text-xs font-mono bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full border border-white/10 transition-colors flex items-center">
                 <Download className="w-3 h-3 mr-2" /> EXPORT
               </button>
            </div>
          </div>
        </header>
      )}

      {embedded && (
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => window.open(getResearchReportPdfUrl(resumeId))} 
            className="text-xs font-mono bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full border border-white/10 transition-colors flex items-center"
          >
            <Download className="w-3 h-3 mr-2" /> EXPORT REPORT PDF
          </button>
        </div>
      )}

      <main className={embedded ? "w-full py-4" : "max-w-[1400px] mx-auto px-6 py-8"}>
        
        {/* Layer 1: Always Visible Intelligence Summary */}
        <div className="mb-12 bg-dark-900/50 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-dark/10 to-transparent pointer-events-none"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
            <div className="lg:col-span-2 space-y-6">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-light/10 border border-brand-light/20 text-brand-light text-xs font-mono uppercase tracking-widest">
                <Sparkles className="w-3 h-3 mr-2" /> Verified Assessment
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {report?.resume?.name || "Candidate"} Intelligence
              </h1>
              <p className="text-lg text-slate-300 font-light max-w-2xl leading-relaxed">
                {report?.resultsSummary?.narrative} {report?.resultsSummary?.interpretation}
              </p>
              
              <div className="flex flex-wrap gap-8 pt-4">
                <MetricRing score={summary.jobFitScore || 0} label="Target Fit" />
                <MetricRing score={summary.resumeQualityScore || 0} label="Impact Quality" />
              </div>
            </div>

            {/* Signature Visual: Semantic Constellation */}
            <div className="flex flex-col items-center justify-center border-l border-white/5 pl-8">
              <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Semantic Skill Constellation</h3>
              <SemanticConstellation 
                matchedSkills={analysis?.match?.matchedSkills || []} 
                missingSkills={analysis?.match?.missingSkills || []} 
              />
            </div>
          </div>
        </div>

        {/* Layer 2: Interactive Exploration Tabs */}
        <div className="border-b border-white/10 mb-8 flex space-x-8 overflow-x-auto scrollbar-hide">
          {[
            { id: 'summary', label: 'Deep Insights', icon: BrainCircuit },
            { id: 'market', label: 'Market Benchmarks', icon: BarChart3 },
            { id: 'pathways', label: 'Role Pathways', icon: Network },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 pb-4 border-b-2 font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-brand-light text-brand-light' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Layer 3: Segmented Views */}
        
        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <ExpandableIntelligence 
                title="Capability Breakdown" 
                reasoning={`Analysis confirms strong coverage in ${analysis?.match?.matchedSkills?.[0] || 'core'} but flags significant maturity gaps against ${summary.highestImpactMissingSkill || 'advanced'} requirements.`}
              >
                <div className="space-y-6">
                  {['Exact skill coverage', 'Skill level fit', 'Experience alignment'].map((label, i) => {
                    const values = [
                      analysis.match?.exactSkillCoverageScore || 0,
                      analysis.match?.skillLevelFitScore || 0,
                      analysis.match?.experienceScore || 0
                    ];
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-400">{label}</span>
                          <span className="text-white font-medium">{values[i]}%</span>
                        </div>
                        <div className="h-1.5 bg-dark-950 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-light" style={{ width: `${values[i]}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ExpandableIntelligence>

              <ExpandableIntelligence 
                title="Structural Resume Quality" 
                reasoning={`${quality.confidenceLabel || 'Medium'} confidence. The resume describes responsibilities but lacks quantifiable impact in key recent roles.`}
              >
                 <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-dark-950 rounded-lg border border-white/5">
                      <div className="text-lg font-bold text-white mb-1">{quality.categoryScores?.actionVerbScore || 0}%</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest">Action Verbs</div>
                    </div>
                    <div className="text-center p-3 bg-dark-950 rounded-lg border border-white/5">
                      <div className="text-lg font-bold text-white mb-1">{quality.categoryScores?.measurableImpactScore || 0}%</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest">Measurability</div>
                    </div>
                    <div className="text-center p-3 bg-dark-950 rounded-lg border border-white/5">
                      <div className="text-lg font-bold text-white mb-1">{quality.categoryScores?.clarityScore || 0}%</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest">Clarity</div>
                    </div>
                 </div>
                 
                 {quality.improvementAreas?.length > 0 && (
                   <div className="space-y-3">
                     <span className="text-xs text-slate-400 uppercase tracking-wider">Critical Weaknesses</span>
                     {quality.improvementAreas.map((area, i) => (
                       <div key={i} className="flex items-start text-sm bg-rose-500/10 text-rose-200 p-3 rounded border border-rose-500/20">
                         <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-rose-400" />
                         {area}
                       </div>
                     ))}
                   </div>
                 )}
              </ExpandableIntelligence>
            </div>
            
            {/* Extracted Skills Section */}
            <ExpandableIntelligence 
              title="Extracted Skills Assessment" 
              reasoning={`We detected ${matchedSkillsList.length} matched competencies and identified ${missingSkillsList.length} missing skill areas relative to the job requirements.`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Matched Skills */}
                <div className="bg-dark-950 p-6 rounded-2xl border border-emerald-500/10">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Matched Skills ({matchedSkillsList.length})</h4>
                  </div>
                  {matchedSkillsList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {matchedSkillsList.map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-medium flex items-center"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1.5 flex-shrink-0" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No matched skills extracted from current profile.</p>
                  )}
                </div>

                {/* Missing Skills */}
                <div className="bg-dark-950 p-6 rounded-2xl border border-rose-500/10">
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Missing Skills ({missingSkillsList.length})</h4>
                  </div>
                  {missingSkillsList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {missingSkillsList.map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3 py-1.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-medium flex items-center"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 mr-1.5 flex-shrink-0" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No missing skills identified against target requirements.</p>
                  )}
                </div>
              </div>
            </ExpandableIntelligence>

            {/* Strategic Upskilling Roadmap (Expanded) */}
            <ExpandableIntelligence 
              title="Strategic Upskilling Roadmap" 
              reasoning={`Prioritizing ${recommendations.focusSkill || 'core competencies'} due to its high market demand across ${marketEvidence.relatedSkills?.length || 0} adjacent roles.`}
            >
              <div className="space-y-8">
                {/* 1. Priorities Sequence */}
                {marketEvidence.priorityRanking?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider font-mono">Suggested Learning Sequence & Priorities</h4>
                    <div className="space-y-3">
                      {marketEvidence.priorityRanking.slice(0, 5).map((priority, index) => (
                        <div key={index} className="p-4 bg-dark-950 border border-white/5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start space-x-3">
                            <span className="w-6 h-6 rounded-full bg-brand-light/10 text-brand-light flex items-center justify-center text-xs font-mono font-bold mt-0.5">
                              {index + 1}
                            </span>
                            <div>
                              <h5 className="text-sm font-semibold text-white capitalize">{priority.skill}</h5>
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{priority.selectedBecause || priority.priorityReason || "Crucial technical competency required for the target trajectory."}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span className="text-xs font-mono px-2.5 py-1 bg-brand-light/10 text-brand-light border border-brand-light/20 rounded-full font-bold">
                              Score: {priority.priorityScore}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. More Courses (Beyond top 3) */}
                {recommendations.courses?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider font-mono">Recommended Course Catalog</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommendations.courses.slice(0, 6).map((course, index) => (
                        <div key={index} className="p-4 bg-dark-950 border border-white/5 rounded-xl flex flex-col justify-between hover:border-brand-light/30 transition-colors">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-mono text-brand-light bg-brand-light/10 px-2 py-0.5 rounded uppercase">{course.priorityLabel || "High"} Priority</span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase bg-dark-900 px-2 py-0.5 rounded">{course.estimated_weeks || course.estimatedWeeks || '4'}w</span>
                            </div>
                            <h5 className="text-sm font-medium text-white mb-1.5 leading-tight">{course.title}</h5>
                            <p className="text-xs text-slate-400 mb-2">Target Skill: <span className="text-slate-300 capitalize">{course.targetSkill}</span></p>
                          </div>
                          {course.selectedBecause?.length > 0 && (
                            <div className="border-t border-white/5 pt-2 mt-2">
                              <ul className="list-disc pl-4 space-y-0.5">
                                {course.selectedBecause.slice(0, 2).map((reason, ri) => (
                                  <li key={ri} className="text-[10px] text-slate-500 leading-normal">{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Project Recommendations */}
                {recommendations.projects?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider font-mono">Practical Portfolio Projects</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recommendations.projects.slice(0, 6).map((project, index) => (
                        <div key={index} className="p-4 bg-dark-950 border border-white/5 rounded-xl flex flex-col justify-between hover:border-amber-400/30 transition-colors">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded uppercase">Hands-on project</span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase bg-dark-900 px-2 py-0.5 rounded">{project.estimated_weeks || project.estimatedWeeks || '2'}w</span>
                            </div>
                            <h5 className="text-sm font-medium text-white mb-1.5 leading-tight">{project.title}</h5>
                            <p className="text-xs text-slate-400 mb-2">Target Skill: <span className="text-slate-300 capitalize">{project.targetSkill}</span></p>
                          </div>
                          {project.selectedBecause?.length > 0 && (
                            <div className="border-t border-white/5 pt-2 mt-2">
                              <ul className="list-disc pl-4 space-y-0.5">
                                {project.selectedBecause.slice(0, 2).map((reason, ri) => (
                                  <li key={ri} className="text-[10px] text-slate-500 leading-normal">{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Practical Learning Milestones (Phases) */}
                {recommendations.phases?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider font-mono">Learning Milestones & Phases</h4>
                    <div className="space-y-4">
                      {recommendations.phases.map((phase, pi) => (
                        <div key={pi} className="p-5 bg-dark-900 border border-white/5 rounded-2xl">
                          <h5 className="text-xs font-mono text-brand-light uppercase tracking-widest mb-3 border-b border-white/5 pb-2">{phase.name}</h5>
                          <div className="flex flex-wrap gap-2">
                            {phase.items.slice(0, 8).map((item, ii) => (
                              <span key={ii} className="text-xs bg-dark-950 text-slate-300 border border-white/10 px-3 py-1.5 rounded-lg flex items-center">
                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${item.format === 'project' ? 'bg-amber-400' : 'bg-brand-light'}`}></span>
                                <span className="font-semibold text-white mr-1.5">{item.title}</span>
                                <span className="text-[10px] text-slate-500 uppercase font-mono">({item.targetSkill})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ExpandableIntelligence>
          </div>
        )}

        {/* MARKET TAB */}
        {activeTab === 'market' && (
          <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                 <h3 className="text-sm font-medium text-white mb-6">Market Priority Ranking (Missing Skills)</h3>
                 <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(marketEvidence.priorityRanking || []).slice(0, 6)}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="skill" tick={{ fill: "#64748b", fontSize: 10 }} angle={-25} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                    <Bar dataKey="priorityScore" radius={[4, 4, 0, 0]}>
                      {((marketEvidence.priorityRanking || []).slice(0, 6)).map((item, index) => (
                        <Cell key={item.skill} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                 </ResponsiveContainer>
                 <div className="mt-4 p-3 bg-brand-dark/10 rounded text-xs text-brand-light border border-brand-light/20">
                   <span className="font-bold">AI Observation:</span> Python demand peaks heavily in entry-level benchmark clusters due to its dominance across backend, automation, and analytics pathways.
                 </div>
               </div>

               <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                 <h3 className="text-sm font-medium text-white mb-6">Demand Velocity by Experience Band</h3>
                 <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={marketEvidence.missingSkillTrend || []}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="yoeRange" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="demand" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#0f172a", stroke: "#38bdf8", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                 </ResponsiveContainer>
                 <div className="mt-4 p-3 bg-brand-dark/10 rounded text-xs text-brand-light border border-brand-light/20">
                   <span className="font-bold">AI Observation:</span> Seniority transitions (3-5 YOE) show steep drop-offs if core architectural skills are missing.
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* PATHWAYS TAB */}
        {activeTab === 'pathways' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-dark-900 border border-white/10 rounded-2xl p-6 mb-6">
               <h3 className="text-lg font-medium text-white mb-2">Cluster Diversification Applied</h3>
               <p className="text-sm text-slate-400 mb-6">Recommendations have been filtered via semantic suppression to prevent redundant title listings, ensuring exposure to strategic adjacent pathways.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {Array.isArray(jobs) && jobs.slice(0, 6).map((job, i) => {
                   if (!job) return null;
                   return (
                     <div key={i} className="bg-dark-950 border border-white/5 rounded-xl p-5 hover:border-brand-light/30 transition-colors group">
                       <div className="flex justify-between items-start mb-4">
                         <div>
                           <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{job.cluster || 'ROLE'}</span>
                           <h4 className="text-sm font-semibold text-white mt-1 group-hover:text-brand-light transition-colors">{job.title}</h4>
                         </div>
                         <span className={`text-xs px-2 py-1 rounded font-medium ${scoreTone(job.finalScore || 0).badge}`}>{job.finalScore || 0}% Fit</span>
                       </div>
                       <p className="text-xs text-slate-400 line-clamp-2 mb-4">{job.explanation?.[0] || 'Strong semantic alignment detected.'}</p>
                       
                       <div className="flex flex-wrap gap-1">
                         {Array.isArray(job.matchedSkills) && job.matchedSkills.slice(0, 3).map(skill => (
                           <span key={skill} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">{skill}</span>
                         ))}
                       </div>
                     </div>
                   );
                 })}
               </div>
               
               <button onClick={() => embedded ? (onToggleSection && onToggleSection('pathways')) : navigate("/resume-recommendations")} className="w-full mt-6 py-3 border border-white/10 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors flex items-center justify-center">
                 Explore Interactive Pathway Network <ArrowRight className="w-4 h-4 ml-2" />
               </button>
             </div>
          </div>
        )}

      </main>
    </div>
  );
}
