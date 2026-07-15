import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine
} from "recharts";
import {
  ArrowRight, BarChart3, Briefcase, ChevronLeft, Loader2, Sparkles, Target, TrendingUp, Network, BrainCircuit, Activity
} from "lucide-react";
import { getGlobalMarketInsights, getUserMarketInsights } from "../utils/analyticsApi.js";

const PRIORITY_COLORS = ["#38bdf8", "#60a5fa", "#818cf8", "#f59e0b", "#f97316", "#f43f5e"];
const TOOLTIP_STYLE = { backgroundColor: "#020617", border: "1px solid rgba(148, 163, 184, 0.2)", borderRadius: "16px", color: "#e2e8f0" };

function StatCard({ icon, label, value, note, accent }) {
  return (
    <div className="bg-dark-950 border border-white/5 rounded-2xl p-5 hover:border-brand-light/30 transition-colors">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          {React.createElement(icon, { className: `h-5 w-5 ${accent}` })}
        </div>
        <Activity className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="text-2xl font-semibold text-white truncate">{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-300">{label}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{note}</div>
    </div>
  );
}

function InsightFeed({ title, bullets, type = "market" }) {
  return (
    <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center space-x-2 mb-6">
        <BrainCircuit className="w-5 h-5 text-brand-light" />
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-4">
        {(bullets || []).map((bullet, i) => (
          <div key={i} className="flex items-start bg-dark-950 p-4 rounded-xl border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-light mt-2 mr-3 flex-shrink-0"></span>
            <p className="text-sm text-slate-300 leading-relaxed font-mono">{bullet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ resumeId: propResumeId, embedded = false, onToggleSection }) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryResumeId = searchParams.get("resumeId");
  const resumeId = propResumeId || queryResumeId;
  const requestedSkill = searchParams.get("skill") || "";

  const [loading, setLoading] = useState(Boolean(resumeId) || true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [globalInsights, setGlobalInsights] = useState(null);
  const [activeTab, setActiveTab] = useState('demand'); // 'demand', 'roles', 'bundles', 'impact'
  const [activeSkill, setActiveSkill] = useState(requestedSkill);

  const currentSkill = embedded ? activeSkill : (requestedSkill || "");

  useEffect(() => {
    async function loadInsights() {
      try {
        setLoading(true);
        setError(null);
        if (resumeId) {
          const response = await getUserMarketInsights(resumeId, currentSkill || null);
          setInsights(response.insights);
          setGlobalInsights(null);
        } else {
          const response = await getGlobalMarketInsights(currentSkill || null);
          setGlobalInsights(response.insights);
          setInsights(null);
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadInsights();
  }, [resumeId, currentSkill]);

  const handleSelectSkill = (skill) => {
    if (!skill) return;
    if (embedded) {
      setActiveSkill(skill);
    } else {
      const params = new URLSearchParams();
      if (resumeId) params.set("resumeId", resumeId);
      params.set("skill", skill);
      navigate(`/analytics?${params.toString()}`);
    }
  };

  const isGlobal = !resumeId;
  const data = isGlobal ? globalInsights : insights;

  if (loading) {
    return (
      <div className={embedded ? "flex flex-col items-center justify-center py-20" : "min-h-screen bg-dark-950 flex flex-col items-center justify-center"}>
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-full border-t-2 border-brand-light animate-spin"></div>
          <BarChart3 className="w-8 h-8 text-brand-light absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-sm font-mono text-brand-light tracking-widest uppercase animate-pulse">Querying Market Database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={embedded ? "flex items-center justify-center p-6" : "min-h-screen bg-dark-950 flex items-center justify-center p-6"}>
        <div className="bg-dark-900 border border-rose-500/30 p-8 rounded-2xl max-w-lg w-full text-center">
          <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-rose-400 font-bold text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analytics Unavailable</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          {embedded ? (
            <button onClick={() => onToggleSection && onToggleSection(null)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors">Close</button>
          ) : (
            <button onClick={() => navigate("/dashboard")} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors">Return to Dashboard</button>
          )}
        </div>
      </div>
    );
  }

  const spotlight = isGlobal ? data?.spotlight : { trend: data?.demandCurve?.series, relatedSkills: data?.adjacency?.series, topRoles: data?.roleImpact?.roles };
  const topSkills = isGlobal ? data?.topSkills : data?.priorityChart;
  const overviewBullets = isGlobal ? data?.overview?.bullets : data?.overview?.bullets;
  const summary = data?.summary || {};

  return (
    <div className={embedded ? "text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950" : "min-h-screen bg-dark-950 text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950"}>
      
      {/* Topbar */}
      {!embedded && (
        <header className="sticky top-0 z-50 border-b border-white/5 bg-dark-950/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="h-4 w-[1px] bg-white/10"></div>
              <span className="font-medium tracking-wide text-sm">{isGlobal ? 'Global Market Intelligence' : 'Candidate Impact Analytics'}</span>
            </div>
            <div className="flex items-center space-x-3">
               <span className="px-3 py-1 bg-brand-light/10 text-brand-light border border-brand-light/20 rounded-full text-xs font-mono uppercase">
                 {data?.dataset?.benchmarkJobCount || 0} Benchmarks Active
               </span>
            </div>
          </div>
        </header>
      )}

      <main className={embedded ? "w-full py-4" : "max-w-[1400px] mx-auto px-6 py-8"}>
        
        {/* Spotlight Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-2">
              Market Intelligence: <br/> <span className="text-brand-light">{isGlobal ? (summary.spotlightSkill || "Overall") : summary.focusSkill}</span>
            </h1>
            <p className="text-slate-400 max-w-2xl text-lg">
              {isGlobal 
                ? "Exploring broader market signals and canonical skill demands across the tech landscape."
                : "Analyzing how the selected missing skill impacts your market positioning and benchmark readiness."}
            </p>
          </div>
          {!isGlobal && (
             <div className="flex gap-4">
                <div className="px-4 py-2 bg-dark-900 border border-white/10 rounded-lg">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Target Band</span>
                  <span className="font-mono text-white text-sm">{summary.targetExperienceBand}</span>
                </div>
                <div className="px-4 py-2 bg-dark-900 border border-white/10 rounded-lg">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Fit Score</span>
                  <span className="font-mono text-emerald-400 text-sm">{summary.jobFitScore}%</span>
                </div>
             </div>
          )}
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {isGlobal ? (
            <>
              <StatCard icon={Sparkles} label="Top Market Skill" value={summary.topSkill} note="Leading canonical skill" accent="text-brand-light" />
              <StatCard icon={Briefcase} label="Top Role Family" value={summary.topRoleFamily} note="Most active cluster" accent="text-emerald-400" />
              <StatCard icon={TrendingUp} label="Busiest YOE Band" value={summary.busiestYoeBand} note="Highest demand volume" accent="text-amber-400" />
              <StatCard icon={Target} label="Spotlight" value={summary.spotlightSkill || "None"} note="Currently tracked" accent="text-violet-400" />
            </>
          ) : (
            <>
              <StatCard icon={Target} label="Focus Priority" value={`${summary.focusPriorityScore || 0}%`} note="Calculated urgency" accent="text-amber-400" />
              <StatCard icon={Briefcase} label="Role Uplift" value={`+${summary.expectedRoleLift || 0}`} note="Max fit projection" accent="text-brand-light" />
              <StatCard icon={Sparkles} label="Readiness" value={`${summary.benchmarkReadySkills || 0}/${summary.trackedSkills || 0}`} note="Benchmark matched" accent="text-emerald-400" />
              <StatCard icon={Network} label="Target Fit" value={`${summary.jobFitScore || 0}%`} note="Current JD baseline" accent="text-violet-400" />
            </>
          )}
        </div>

        {/* Interactive Navigation */}
        <div className="border-b border-white/10 mb-8 flex space-x-8 overflow-x-auto scrollbar-hide">
          {[
            { id: 'demand', label: 'Demand Dynamics', icon: TrendingUp },
            { id: 'roles', label: 'Role Alignment', icon: Briefcase },
            { id: 'bundles', label: 'Skill Bundles', icon: Network },
            ...(!isGlobal ? [{ id: 'impact', label: 'Candidate Impact', icon: Target }] : [])
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

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
             {activeTab === 'demand' && (
                <div className="animate-fade-in space-y-8">
                  <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white mb-2">Demand by Experience Band</h3>
                    <p className="text-sm text-slate-400 mb-6">Tracking when this capability transitions from 'optional' to 'mandatory'.</p>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={spotlight?.trend || []}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="yoeRange" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2}} contentStyle={TOOLTIP_STYLE} />
                        {!isGlobal && data?.demandCurve?.candidateBand && <ReferenceLine x={data.demandCurve.candidateBand} stroke="#34d399" strokeDasharray="3 3" />}
                        {!isGlobal && data?.demandCurve?.targetBand && <ReferenceLine x={data.demandCurve.targetBand} stroke="#f59e0b" strokeDasharray="3 3" />}
                        <Line type="monotone" dataKey="demand" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#0f172a", stroke: "#38bdf8", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white mb-2">Market Priority Ranking</h3>
                    <p className="text-sm text-slate-400 mb-6">Top skills prioritized by market demand and structural requirement.</p>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={topSkills || []} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="skill" width={120} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey={isGlobal ? "demand" : "priorityScore"} radius={[0, 4, 4, 0]} onClick={(d) => handleSelectSkill(d?.skill)}>
                          {(topSkills || []).map((item, index) => (
                            <Cell key={item.skill} fill={item.skill === (isGlobal ? summary.spotlightSkill : summary.focusSkill) ? "#38bdf8" : "#1e293b"} cursor="pointer" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
             )}

             {activeTab === 'roles' && (
               <div className="animate-fade-in space-y-8">
                 <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white mb-2">Role Cluster Reliance</h3>
                    <p className="text-sm text-slate-400 mb-6">Roles that utilize this capability the most frequently in benchmarks.</p>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={spotlight?.topRoles || []} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="title" tick={{ fill: "#64748b", fontSize: 10 }} angle={-25} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey={isGlobal ? "demand" : "projectedFit"} fill="#818cf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
             )}

             {activeTab === 'bundles' && (
               <div className="animate-fade-in space-y-8">
                 <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white mb-2">Adjacent Capability Bundles</h3>
                    <p className="text-sm text-slate-400 mb-6">Capabilities frequently requested alongside this skill.</p>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={spotlight?.relatedSkills || []} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="skill" width={120} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {(spotlight?.relatedSkills || []).map((item) => (
                            <Cell key={item.skill} fill={item.alreadyOwned ? "#34d399" : "#38bdf8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
             )}

             {activeTab === 'impact' && !isGlobal && (
               <div className="animate-fade-in space-y-8">
                 <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-medium text-white mb-2">Simulated Profile Uplift</h3>
                    <p className="text-sm text-slate-400 mb-6">Projected job fit score increase if this capability is acquired.</p>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={data?.roleImpact?.roles || []} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="title" tick={{ fill: "#64748b", fontSize: 10 }} angle={-25} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#64748b" }} domain={[0, 100]} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="currentFit" name="Current Fit" fill="#1e293b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="projectedFit" name="Projected Fit" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
             )}
          </div>

          <div className="lg:col-span-1 space-y-6">
             <InsightFeed title="AI Market Observations" bullets={overviewBullets} />
             
             {!isGlobal && data?.focusSkillBreakdown && (
               <div className="bg-dark-900 border border-white/10 rounded-2xl p-6">
                 <div className="flex items-center space-x-2 mb-4">
                   <Target className="w-5 h-5 text-amber-400" />
                   <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Priority Logic</h3>
                 </div>
                 <div className="space-y-4 font-mono text-xs">
                   <div className="flex justify-between items-center border-b border-white/5 pb-2">
                     <span className="text-slate-400">Target Role Need</span>
                     <span className="text-brand-light">{data.focusSkillBreakdown.roleNeedScore}%</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-white/5 pb-2">
                     <span className="text-slate-400">Market Demand</span>
                     <span className="text-brand-light">{data.focusSkillBreakdown.marketDemandScore}%</span>
                   </div>
                   <div className="flex justify-between items-center border-b border-white/5 pb-2">
                     <span className="text-slate-400">Readiness</span>
                     <span className="text-brand-light">{data.focusSkillBreakdown.readinessScore}%</span>
                   </div>
                   <div className="flex justify-between items-center pb-2">
                     <span className="text-slate-400">Est. Effort</span>
                     <span className="text-brand-light">{data.focusSkillBreakdown.estimatedWeeks}w</span>
                   </div>
                 </div>
               </div>
             )}
          </div>

        </div>
      </main>
    </div>
  );
}
