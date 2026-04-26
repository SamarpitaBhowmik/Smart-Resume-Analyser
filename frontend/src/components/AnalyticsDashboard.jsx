import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  ChevronLeft,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { getGlobalMarketInsights, getUserMarketInsights } from "../utils/analyticsApi.js";

const PRIORITY_COLORS = ["#38bdf8", "#60a5fa", "#818cf8", "#f59e0b", "#f97316", "#f43f5e"];
const TOOLTIP_STYLE = {
  backgroundColor: "#020617",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "16px",
  color: "#e2e8f0",
};

function StatCard({ icon, label, value, note, accent = "text-sky-300" }) {
  return (
    <div className="app-panel-soft rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-2.5 backdrop-blur-sm">
          {React.createElement(icon, { className: `h-5 w-5 ${accent}` })}
        </div>
        <TrendingUp className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm font-medium text-white">{label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{note}</div>
    </div>
  );
}

function SectionCard({ eyebrow, title, subtitle, children, action }) {
  return (
    <section className="app-panel rounded-3xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-blue-300">{eyebrow}</div>
          ) : null}
          <div className="mt-2 text-xl font-semibold text-white">{title}</div>
          {subtitle ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Chip({ children, tone = "slate" }) {
  const tones = {
    slate: "border-white/20 bg-white/10 text-slate-200",
    blue: "border-blue-400/30 bg-blue-500/15 text-blue-100",
    amber: "border-amber-400/30 bg-amber-500/15 text-amber-200",
    emerald: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
    rose: "border-rose-400/30 bg-rose-500/15 text-rose-200",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function ProgressRow({ label, value, color = "bg-sky-500" }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}
        />
      </div>
    </div>
  );
}

function truncateLabel(value = "", max = 18) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const resumeId = searchParams.get("resumeId");
  const requestedSkill = searchParams.get("skill") || "";

  const [loading, setLoading] = useState(Boolean(resumeId));
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [globalInsights, setGlobalInsights] = useState(null);

  useEffect(() => {
    async function loadInsights() {
      try {
        setLoading(true);
        setError(null);
        if (resumeId) {
          const response = await getUserMarketInsights(resumeId, requestedSkill || null);
          setInsights(response.insights);
          setGlobalInsights(null);
        } else {
          const response = await getGlobalMarketInsights(requestedSkill || null);
          setGlobalInsights(response.insights);
          setInsights(null);
        }
      } catch (loadError) {
        console.error("Error loading market insights:", loadError);
        setError(loadError.message || "Failed to load market analytics.");
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, [resumeId, requestedSkill]);

  const handleSelectSkill = (skill) => {
    if (!skill) return;
    const params = new URLSearchParams();
    if (resumeId) params.set("resumeId", resumeId);
    params.set("skill", skill);
    navigate(`/analytics?${params.toString()}`);
  };

  const priorityData = insights?.priorityChart || [];
  const focusSkillBreakdown = insights?.focusSkillBreakdown || null;
  const demandCurve = insights?.demandCurve || { series: [] };
  const roleImpact = insights?.roleImpact || { roles: [] };
  const adjacency = insights?.adjacency || { series: [] };
  const maturity = insights?.maturity || { chartData: [], signals: [] };
  const roadmapLinkage = insights?.roadmapLinkage || { topItems: [] };
  const summary = insights?.summary || {};
  const overview = insights?.overview || { bullets: [] };
  const globalTopSkills = globalInsights?.topSkills || [];
  const globalRoleFamilies = globalInsights?.roleFamilies || [];
  const globalYoeDistribution = globalInsights?.yoeDistribution || [];
  const globalSpotlight = globalInsights?.spotlight || { trend: [], relatedSkills: [], topRoles: [], learningOptions: [] };
  const globalSummary = globalInsights?.summary || {};
  const globalOverview = globalInsights?.overview || { bullets: [] };

  if (!resumeId) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <div className="app-topbar">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="rounded-xl border border-white/20 bg-black/50 p-2 text-slate-200 transition hover:border-blue-400/40 hover:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-blue-300">Market intelligence</div>
                  <h1 className="mt-1 text-2xl font-semibold text-white">Benchmark trends and skill demand</h1>
                  <p className="mt-2 text-sm text-slate-300">
                    Explore market signals without uploading a resume. Select a skill to review demand, common bundles, and related roles.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip tone="blue">{globalInsights?.dataset?.benchmarkJobCount || 0} benchmark roles</Chip>
                <Chip tone="slate">{globalInsights?.dataset?.courseCatalogCount || 0} learning resources indexed</Chip>
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
            <SectionCard
              eyebrow="Global View"
              title={globalOverview.headline}
                subtitle="These charts summarize what the market benchmark values overall, not what a specific candidate is missing."
              action={
                <button
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-black/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
                >
                  Open candidate workspace
                  <ArrowRight className="h-4 w-4" />
                </button>
              }
            >
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  {(globalOverview.bullets || []).map((bullet, index) => (
                    <div key={`global-bullet-${index}`} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                      {bullet}
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
                  <div className="text-sm font-medium text-white">Spotlight skill snapshot</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip tone="amber">{globalSpotlight.skill || "No skill selected"}</Chip>
                    <Chip tone="blue">Peak band: {globalSummary.spotlightPeakBand || "Unknown"}</Chip>
                    <Chip tone="emerald">{globalInsights?.dataset?.courseCatalogCount || 0} learning options</Chip>
                  </div>
                  <div className="mt-5 space-y-4">
                    <ProgressRow label="Top-skill demand score" value={globalTopSkills[0]?.demandScore || 0} color="bg-blue-500" />
                    <ProgressRow label="Data quality score" value={globalInsights?.dataset?.retainedRowRate || 0} color="bg-emerald-500" />
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Sparkles} label="Top skill" value={globalSummary.topSkill || "Unknown"} note={`${globalSummary.topSkillDemand || 0} benchmark facts for the leading canonical skill.`} accent="text-blue-300" />
              <StatCard icon={Briefcase} label="Top role family" value={globalSummary.topRoleFamily || "Unknown"} note={`${globalSummary.topRoleFamilyDemand || 0} benchmark role profiles in this family.`} accent="text-emerald-300" />
              <StatCard icon={TrendingUp} label="Busiest YOE band" value={globalSummary.busiestYoeBand || "Unknown"} note="Experience band with the widest overall benchmark demand activity." accent="text-amber-300" />
              <StatCard icon={Target} label="Spotlight skill" value={globalSummary.spotlightSkill || "Unknown"} note="Currently selected skill for the deep-dive panels below." accent="text-violet-300" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <SectionCard
                eyebrow="Skill Demand"
                title="Which skills dominate the benchmark market?"
                subtitle="This ranks canonical skills by how often they appear across benchmark roles and how widely they spread across role families."
              >
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={globalTopSkills} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: "#cbd5e1" }} />
                    <YAxis type="category" dataKey="skill" width={120} tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value) => truncateLabel(value, 14)} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="demand" radius={[0, 12, 12, 0]} onClick={(data) => handleSelectSkill(data?.skill)}>
                      {globalTopSkills.map((item, index) => (
                        <Cell key={item.skill} fill={item.skill === globalSpotlight.skill ? "#f59e0b" : PRIORITY_COLORS[index % PRIORITY_COLORS.length]} cursor="pointer" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard
                eyebrow="Role Families"
                title="Which benchmark roles are the most developed?"
                subtitle="Role families are ordered by how many benchmark role profiles they contain and how dense their skill expectations are."
              >
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={globalRoleFamilies} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="title" tick={{ fill: "#cbd5e1", fontSize: 11 }} angle={-18} textAnchor="end" height={70} tickFormatter={(value) => truncateLabel(value, 16)} />
                    <YAxis tick={{ fill: "#cbd5e1" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: "12px" }} />
                    <Bar dataKey="demand" name="Profiles" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="avgSkillLoad" name="Avg skill load" fill="#a78bfa" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <SectionCard
                eyebrow="Experience Demand"
                title={`How does demand change by experience band for ${globalSpotlight.skill || "this skill"}?`}
                subtitle="The spotlight trend shows when the selected skill matters most across benchmark experience bands."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={globalSpotlight.trend}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="yoeRange" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#cbd5e1" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="demand" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#38bdf8", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip tone="amber">Peak band: {globalSummary.spotlightPeakBand || "Unknown"}</Chip>
                  <Chip tone="blue">Tracked bands: {globalSpotlight.trend?.length || 0}</Chip>
                </div>
              </SectionCard>

              <SectionCard
                eyebrow="Whole Market"
                title="Where is overall benchmark demand concentrated?"
                subtitle="This view summarizes total benchmark activity, unique-skill breadth, and role-family breadth by experience band."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={globalYoeDistribution}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="yoeRange" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#cbd5e1" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: "12px" }} />
                    <Bar dataKey="demand" name="Demand facts" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="uniqueSkillsCount" name="Unique skills" fill="#34d399" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <SectionCard
                eyebrow="Skill Bundle"
                title={`Which skills usually travel with ${globalSpotlight.skill || "the spotlight skill"}?`}
                subtitle="These adjacent skills come from benchmark co-occurrence across the same role profiles."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={globalSpotlight.relatedSkills} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: "#cbd5e1" }} />
                    <YAxis type="category" dataKey="skill" width={120} tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(value) => truncateLabel(value, 14)} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[0, 12, 12, 0]}>
                      {globalSpotlight.relatedSkills.map((item, index) => (
                        <Cell key={item.skill} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard
                eyebrow="Role Match"
                title={`Which roles rely on ${globalSpotlight.skill || "this skill"} the most?`}
                subtitle="These roles show where the selected skill appears most often across the benchmark role set."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={globalSpotlight.topRoles} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="title" tick={{ fill: "#cbd5e1", fontSize: 11 }} angle={-18} textAnchor="end" height={70} tickFormatter={(value) => truncateLabel(value, 16)} />
                    <YAxis tick={{ fill: "#cbd5e1" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="demand" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            <SectionCard
              eyebrow="Learning Linkage"
              title={`How can someone start learning ${globalSpotlight.skill || "this skill"}?`}
              subtitle="This ties the standalone trend page back to normalized learning coverage from the course catalog, so the trends page is meaningful instead of just decorative."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                {(globalSpotlight.learningOptions || []).slice(0, 6).map((item) => (
                  <div key={`${item.title}-${item.provider}`} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-2 text-sm text-slate-300">
                      {item.provider} | {item.format} | {item.estimatedWeeks} weeks
                    </div>
                    <div className="mt-3">
                      <Chip tone="blue">{item.level}</Chip>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </main>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-content flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-300" />
            <p className="text-sm text-slate-300">Building contextual market intelligence...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell">
        <div className="app-content mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
          <SectionCard
            eyebrow="Market Intelligence"
            title="This analysis is not ready yet"
            subtitle={error}
            action={
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-black/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
              >
                Back to dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            }
          >
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              Run or rerun the main resume analysis so the analytics page has a fresh roadmap, fit score, and missing-skill evidence to work with.
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <div className="app-topbar">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="rounded-xl border border-white/20 bg-black/50 p-2 text-slate-200 transition hover:border-blue-400/40 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-blue-300">Market intelligence</div>
                <h1 className="mt-1 text-2xl font-semibold text-white">Why this roadmap is prioritizing {summary.focusSkill || "your next skill"}</h1>
                <p className="mt-2 text-sm text-slate-300">
                  A user-centered analytics layer built around missing-skill priority, experience timing, role uplift, and benchmark maturity.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip tone="blue">{insights?.dataset?.benchmarkJobCount || 0} benchmark roles</Chip>
              <Chip tone="slate">{insights?.dataset?.courseCatalogCount || 0} learning resources indexed</Chip>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
          <SectionCard
            eyebrow="Executive View"
            title={overview.headline}
            subtitle="This page only keeps graphs that directly influence the roadmap. Each chart either changes the selected skill, explains its timing, or shows its effect on role fit."
            action={
              <div className="flex flex-wrap gap-2">
                <Chip tone="amber">Current band: {summary.candidateExperienceBand}</Chip>
                <Chip tone="blue">Target band: {summary.targetExperienceBand}</Chip>
              </div>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-3">
                {(overview.bullets || []).map((bullet, index) => (
                  <div key={`insight-${index}`} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                    {bullet}
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
                <div className="text-sm font-medium text-white">Focus skill snapshot</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip tone="amber">{summary.focusSkill}</Chip>
                  <Chip tone="blue">{summary.focusPriorityScore}% priority</Chip>
                  <Chip tone="emerald">{summary.expectedRoleLift} pt max uplift</Chip>
                </div>
                <div className="mt-5 space-y-4">
                  <ProgressRow label="Current job fit" value={summary.jobFitScore} color="bg-blue-500" />
                  <ProgressRow
                    label="Benchmark-ready skills"
                    value={summary.trackedSkills ? Math.round((summary.benchmarkReadySkills / summary.trackedSkills) * 100) : 0}
                    color="bg-emerald-500"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Target}
              label="Current JD Fit"
              value={`${summary.jobFitScore || 0}%`}
              note="The current hybrid-v2 fit score against the active job description."
              accent="text-blue-300"
            />
            <StatCard
              icon={Sparkles}
              label="Benchmark-Ready Skills"
              value={`${summary.benchmarkReadySkills || 0}/${summary.trackedSkills || 0}`}
              note="Skills already matched at the expected maturity level for the target benchmark."
              accent="text-emerald-300"
            />
            <StatCard
              icon={BarChart3}
              label="Focus Skill Priority"
              value={`${summary.focusPriorityScore || 0}%`}
              note={`${summary.focusSkill || "Selected skill"} is ranked using role need, market demand, experience demand, readiness, and effort.`}
              accent="text-amber-300"
            />
            <StatCard
              icon={Briefcase}
              label="Projected Role Lift"
              value={`+${summary.expectedRoleLift || 0}`}
              note="Maximum fit uplift across the strongest benchmark role matches if the focus gap is closed."
              accent="text-violet-300"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard
              eyebrow="Priority Map"
              title="Which missing skills matter most right now?"
              subtitle="Bars are ordered by the same skill-priority engine that drives roadmap order. Click a bar to refocus the entire analytics page."
            >
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={priorityData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: "#cbd5e1" }} domain={[0, 100]} />
                  <YAxis
                    type="category"
                    dataKey="skill"
                    width={120}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    tickFormatter={(value) => truncateLabel(value, 14)}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="priorityScore" radius={[0, 12, 12, 0]} onClick={(data) => handleSelectSkill(data?.skill)}>
                    {priorityData.map((item, index) => (
                      <Cell
                        key={item.skill}
                        fill={item.selected ? "#f59e0b" : PRIORITY_COLORS[index % PRIORITY_COLORS.length]}
                        cursor="pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard
              eyebrow="Selected Skill"
              title={`Why ${focusSkillBreakdown?.skill || "this skill"} is being pushed up`}
              subtitle="These are the exact components used by the priority engine for the current focus skill."
            >
              {focusSkillBreakdown ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="amber">{focusSkillBreakdown.priorityLabel} priority</Chip>
                    <Chip tone="blue">Target level: {focusSkillBreakdown.targetLevel}</Chip>
                    <Chip tone="slate">Estimated effort: {focusSkillBreakdown.estimatedWeeks} weeks</Chip>
                  </div>
                  <div className="space-y-4">
                    <ProgressRow label="Target role need" value={focusSkillBreakdown.roleNeedScore} color="bg-blue-500" />
                    <ProgressRow label="Market demand" value={focusSkillBreakdown.marketDemandScore} color="bg-violet-500" />
                    <ProgressRow label="Target-band demand" value={focusSkillBreakdown.targetYoeDemandScore} color="bg-amber-500" />
                    <ProgressRow label="Learning readiness" value={focusSkillBreakdown.readinessScore} color="bg-emerald-500" />
                    <ProgressRow label="Effort inverse" value={focusSkillBreakdown.effortInverseScore} color="bg-rose-500" />
                  </div>
                  <div className="space-y-3">
                    {(focusSkillBreakdown.reasons || []).map((reason, index) => (
                      <div key={`reason-${index}`} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                  No selected skill evidence is available yet.
                </div>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              eyebrow="Timing"
              title={`When does ${demandCurve.skill || "this skill"} start to matter most?`}
              subtitle="The curve shows demand across benchmark experience bands. Candidate and target markers make it clear whether this skill is urgent now or part of the next maturity jump."
            >
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={demandCurve.series}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                  <XAxis dataKey="yoeRange" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#cbd5e1" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  {demandCurve.candidateBand ? (
                    <ReferenceLine x={demandCurve.candidateBand} stroke="#34d399" strokeDasharray="4 4" />
                  ) : null}
                  {demandCurve.targetBand ? (
                    <ReferenceLine x={demandCurve.targetBand} stroke="#f59e0b" strokeDasharray="4 4" />
                  ) : null}
                  <Line type="monotone" dataKey="demand" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#38bdf8", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone="emerald">Candidate band: {demandCurve.candidateBand || "Unknown"}</Chip>
                <Chip tone="amber">Target band: {demandCurve.targetBand || "Unknown"}</Chip>
                <Chip tone="blue">Peak demand: {demandCurve.peakBand || "Unknown"}</Chip>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Role Lift"
              title={`What changes for top roles if ${roleImpact.skill || "this skill"} is closed?`}
              subtitle="This simulation keeps the current semantic and experience baseline stable, then recomputes role fit after adding the focus skill to the resume."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={roleImpact.roles} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="title"
                    tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    angle={-18}
                    textAnchor="end"
                    height={70}
                    tickFormatter={(value) => truncateLabel(value, 16)}
                  />
                  <YAxis tick={{ fill: "#cbd5e1" }} domain={[0, 100]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: "12px" }} />
                  <Bar dataKey="currentFit" name="Current fit" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="projectedFit" name="Projected fit" fill="#a78bfa" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone="blue">Average uplift: +{roleImpact.averageLift || 0}</Chip>
                <Chip tone="amber">Maximum uplift: +{roleImpact.maxLift || 0}</Chip>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              eyebrow="Skill Bundle"
              title={`Which nearby skills should move with ${adjacency.skill || "this skill"}?`}
              subtitle="Co-occurrence highlights complementary skills that commonly appear with the focus skill in similar roles."
            >
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={adjacency.series} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: "#cbd5e1" }} />
                  <YAxis
                    type="category"
                    dataKey="skill"
                    width={120}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    tickFormatter={(value) => truncateLabel(value, 14)}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[0, 12, 12, 0]}>
                    {adjacency.series.map((item) => (
                      <Cell key={item.skill} fill={item.alreadyOwned ? "#34d399" : "#38bdf8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone="emerald">Green means already on the resume</Chip>
                <Chip tone="blue">Blue means useful supporting bundle</Chip>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Maturity Diagnostic"
              title="Are the current skills broad enough and deep enough?"
              subtitle="This diagnostic uses per-skill maturity evidence from the JD analysis to show which requirements are already strong, which need depth, and which are still missing."
            >
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={maturity.chartData}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {maturity.chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="emerald">Ready now: {maturity.readySkills || 0}</Chip>
                    <Chip tone="blue">Needs depth: {(maturity.matchedBelowTargetMaturity || 0) + (maturity.matchedUnknownMaturity || 0)}</Chip>
                    <Chip tone="amber">High-impact gaps: {maturity.missingHighImpact || 0}</Chip>
                  </div>
                  {(maturity.signals || []).map((signal) => (
                    <div key={`${signal.skill}-${signal.status}`} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-medium text-white">{signal.skill}</div>
                        <Chip tone={signal.status === "missing_high_impact" ? "amber" : "blue"}>{signal.label}</Chip>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-300">
                        Expected maturity: {signal.expectedYoe} years | Market demand: {signal.marketDemandScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            eyebrow="Roadmap Linkage"
            title={`How the analytics page changes the learning plan for ${summary.focusSkill || "the selected skill"}`}
            subtitle="These recommended roadmap items are filtered and ranked around the same focus skill selected on this page. The analytics layer exists to justify this order, not to sit separately from it."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {(roadmapLinkage.topItems || []).map((item) => (
                <div key={`${item.title}-${item.targetSkill}`} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-2 text-sm text-slate-300">
                        {item.targetSkill} | {item.format} | {item.estimatedWeeks} weeks
                      </div>
                    </div>
                    <Chip tone="amber">{item.priorityScore}%</Chip>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">
                    {item.selectedBecause?.[0] || "Ranked highly because it supports the current highest-impact gap."}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Methodology"
            title="What powers these analytics"
            subtitle="Insights combine your latest analysis, the priority engine, and benchmark market evidence. Role-fit lift is simulated by adding the focus skill and recomputing the scoring components."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                <div className="font-medium text-white">Matching model</div>
                <div className="mt-3">{insights?.methodology?.hybridMatching}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                <div className="font-medium text-white">Priority model</div>
                <div className="mt-3">{insights?.methodology?.priorityModel}</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                <div className="font-medium text-white">Role-lift simulation</div>
                <div className="mt-3">{insights?.methodology?.roleImpactModel}</div>
              </div>
            </div>
          </SectionCard>
        </main>
      </div>
    </div>
  );
}
