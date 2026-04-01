import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Activity,
  BarChart3,
  Briefcase,
  ChevronLeft,
  Database,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  getDashboardStats,
  getJobTitles,
  getMarketTrends,
  getSkillCorrelation,
  getSkillsByYOE,
  getTopSkills,
  getValidationSummary,
  getYOEDistribution,
} from "../utils/analyticsApi.js";

const COLORS = ["#38bdf8", "#60a5fa", "#34d399", "#f59e0b", "#f97316", "#f43f5e", "#a78bfa"];

function StatCard({ icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
          {React.createElement(icon, { className: "h-5 w-5 text-sky-300" })}
        </div>
        <TrendingUp className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-200">{label}</div>
      <div className="mt-2 text-sm text-slate-400">{note}</div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [topSkills, setTopSkills] = useState([]);
  const [skillsByYOE, setSkillsByYOE] = useState([]);
  const [yoeDistribution, setYOEDistribution] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [validationSummary, setValidationSummary] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [marketTrends, setMarketTrends] = useState([]);
  const [skillCorrelation, setSkillCorrelation] = useState([]);
  const [activeView, setActiveView] = useState("overview");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [
          statsData,
          topSkillsData,
          skillsByYOEData,
          yoeData,
          titleData,
          validationData,
        ] = await Promise.all([
          getDashboardStats(),
          getTopSkills(15),
          getSkillsByYOE(),
          getYOEDistribution(),
          getJobTitles(),
          getValidationSummary(),
        ]);

        setStats(statsData);
        setTopSkills(topSkillsData);
        setSkillsByYOE(skillsByYOEData);
        setYOEDistribution(yoeData);
        setJobTitles(titleData.slice(0, 8));
        setValidationSummary(validationData);

        const defaultSkill = topSkillsData[0]?._id || "";
        setSelectedSkill(defaultSkill);
      } catch (error) {
        console.error("Error loading analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    async function loadSkillViews() {
      if (!selectedSkill) return;
      try {
        const [trends, correlation] = await Promise.all([
          getMarketTrends(selectedSkill),
          getSkillCorrelation(selectedSkill),
        ]);
        setMarketTrends(trends);
        setSkillCorrelation(
          correlation.filter((item) => item._id.toLowerCase() !== selectedSkill.toLowerCase()).slice(0, 10)
        );
      } catch (error) {
        console.error("Error loading skill views:", error);
      }
    }

    loadSkillViews();
  }, [selectedSkill]);

  const heatmapData = useMemo(() => {
    const topSkillNames = topSkills.slice(0, 12).map((item) => item._id);
    const orderedYoe = [...new Map(skillsByYOE.map((item) => [item.yoeRange, item.yoeMin])).entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([label]) => label);
    const lookup = {};

    skillsByYOE.forEach((item) => {
      if (!lookup[item.skill]) lookup[item.skill] = {};
      lookup[item.skill][item.yoeRange] = item.value;
    });

    return {
      skills: topSkillNames,
      yoeRanges: orderedYoe,
      lookup,
    };
  }, [skillsByYOE, topSkills]);

  const maxHeatmapValue = Math.max(...skillsByYOE.map((item) => item.value), 1);
  const retainedRate = Math.round((validationSummary?.quality?.retainedRowRate || 0) * 100);

  const heatColor = (value) => {
    if (!value) return "bg-slate-900";
    const intensity = value / maxHeatmapValue;
    if (intensity > 0.7) return "bg-emerald-500";
    if (intensity > 0.45) return "bg-sky-500";
    if (intensity > 0.25) return "bg-amber-500";
    return "bg-orange-400";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-sky-300" />
          <p className="text-sm text-slate-400">Loading research analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-300 transition hover:border-sky-500/40 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300">Research analytics</div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Meaningful benchmark market insights</h1>
            </div>
          </div>

          <div className="flex gap-2">
            {["overview", "skill-view"].map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeView === view
                    ? "border border-sky-500/30 bg-sky-500/10 text-sky-200"
                    : "border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-sky-500/30 hover:text-white"
                }`}
              >
                {view === "overview" ? "Overview" : "Skill impact"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Database} label="Skill Facts" value={stats?.totalRecords?.toLocaleString() || 0} note="Normalized one-row-per-skill facts used for graphs and evidence." />
          <StatCard icon={Sparkles} label="Unique Skills" value={stats?.uniqueSkills?.toLocaleString() || 0} note="Canonical skills after alias cleanup and normalization." />
          <StatCard icon={Briefcase} label="Role Benchmarks" value={stats?.uniqueTitles?.toLocaleString() || 0} note="Distinct benchmark role titles after data cleaning." />
          <StatCard icon={ShieldCheck} label="Retained Row Rate" value={`${retainedRate}%`} note="Rows preserved after validation, YOE normalization, and deduplication." />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                <BarChart3 className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Why these graphs matter</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Every chart below answers a dashboard question: which skills dominate the benchmark market, how demand shifts by experience, and which missing skills create the biggest career gap.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                Which skills appear most often across validated benchmark roles?
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                Which experience bands demand the widest skill spread?
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                Which related skills should be learned alongside a missing target skill?
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                <ShieldCheck className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Validation summary</h2>
                <p className="mt-1 text-sm text-slate-400">This keeps the analytics defendable in the report.</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span>Dropped rows</span>
                <span className="font-medium text-white">{validationSummary?.quality?.droppedRowCount || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span>Duplicate rows removed</span>
                <span className="font-medium text-white">{validationSummary?.quality?.duplicateRowsRemoved || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span>Invalid YOE rows</span>
                <span className="font-medium text-white">{validationSummary?.quality?.invalidYoeRows || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span>Unique cleaned skills</span>
                <span className="font-medium text-white">{validationSummary?.cleaned?.uniqueSkills || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {activeView === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <Target className="h-4 w-4 text-sky-300" />
                Which skills dominate the benchmark market?
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topSkills}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="_id" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-28} textAnchor="end" height={90} />
                  <YAxis tick={{ fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {topSkills.map((item, index) => <Cell key={item._id} fill={COLORS[index % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <Activity className="h-4 w-4 text-sky-300" />
                How does demand spread across experience bands?
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={yoeDistribution}>
                  <defs>
                    <linearGradient id="yoeArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="yoeRange" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                  <Area type="monotone" dataKey="count" stroke="#38bdf8" fill="url(#yoeArea)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <Briefcase className="h-4 w-4 text-sky-300" />
                Which role families appear most often?
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={jobTitles}
                    dataKey="count"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ _id, percent }) => `${_id.slice(0, 14)}${_id.length > 14 ? "..." : ""} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {jobTitles.map((item, index) => <Cell key={item._id} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <Sparkles className="h-4 w-4 text-sky-300" />
                Which skills stay important as experience grows?
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <div className="mb-3 flex gap-2 border-b border-slate-800 pb-2">
                    <div className="w-32 text-xs font-medium text-slate-400">Skill</div>
                    {heatmapData.yoeRanges.map((range) => (
                      <div key={range} className="flex-1 text-center text-xs font-medium text-slate-400">
                        {range}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {heatmapData.skills.map((skill) => (
                      <div key={skill} className="flex items-center gap-2">
                        <div className="w-32 truncate text-sm text-slate-300">{skill}</div>
                        {heatmapData.yoeRanges.map((range) => {
                          const value = heatmapData.lookup[skill]?.[range] || 0;
                          return (
                            <div
                              key={`${skill}-${range}`}
                              className={`flex h-7 flex-1 items-center justify-center rounded text-xs font-medium text-white ${heatColor(value)}`}
                              title={`${skill} at ${range}: ${value}`}
                            >
                              {value > 0 ? value : ""}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === "skill-view" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <Search className="h-4 w-4 text-sky-300" />
                Skill impact explorer
              </div>
              <input
                type="text"
                value={selectedSkill}
                onChange={(event) => setSelectedSkill(event.target.value)}
                placeholder="Enter a skill such as Python, React, Docker, SQL"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
              />
              <p className="mt-3 text-sm text-slate-400">
                Use this view to justify why a missing skill matters and which adjacent skills tend to appear with it.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                  <TrendingUp className="h-4 w-4 text-sky-300" />
                  How does {selectedSkill || "this skill"} change by experience level?
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={marketTrends}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="yoeRange" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                    <Line type="monotone" dataKey="demand" stroke="#38bdf8" strokeWidth={3} dot={{ fill: "#38bdf8", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                  <Target className="h-4 w-4 text-sky-300" />
                  Which skills co-occur with {selectedSkill || "this skill"}?
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={skillCorrelation} layout="vertical">
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="_id" tick={{ fill: "#94a3b8", fontSize: 11 }} width={110} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }} />
                    <Bar dataKey="count" fill="#34d399" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
