import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
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
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  ChevronLeft,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Target,
  Briefcase,
  Award,
  Database,
  Search,
  Loader2,
} from "lucide-react";
import {
  getTopSkills,
  getSkillsByYOE,
  getYOEDistribution,
  getDashboardStats,
  getMarketTrends,
  getJobTitles,
  getSkillCorrelation,
} from "../utils/analyticsApi.js";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#ec4899",
];

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [topSkills, setTopSkills] = useState([]);
  const [skillsByYOE, setSkillsByYOE] = useState([]);
  const [yoeDistribution, setYOEDistribution] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [marketTrends, setMarketTrends] = useState([]);
  const [skillCorrelation, setSkillCorrelation] = useState([]);
  const [activeView, setActiveView] = useState("overview");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSkill) {
      loadMarketTrends(selectedSkill);
      loadSkillCorrelation(selectedSkill);
    }
  }, [selectedSkill]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        statsData,
        topSkillsData,
        skillsByYOEData,
        yoeDistData,
        jobTitlesData,
      ] = await Promise.all([
        getDashboardStats(),
        getTopSkills(15),
        getSkillsByYOE(),
        getYOEDistribution(),
        getJobTitles(),
      ]);

      setStats(statsData);
      setTopSkills(topSkillsData);
      setSkillsByYOE(skillsByYOEData);
      setYOEDistribution(yoeDistData);
      setJobTitles(jobTitlesData.slice(0, 10));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketTrends = async (skill) => {
    try {
      const data = await getMarketTrends(skill);
      setMarketTrends(data);
    } catch (error) {
      console.error("Error loading market trends:", error);
    }
  };

  const loadSkillCorrelation = async (skill) => {
    try {
      const data = await getSkillCorrelation(skill);
      setSkillCorrelation(data.filter((item) => item._id.toLowerCase() !== skill.toLowerCase()).slice(0, 10));
    } catch (error) {
      console.error("Error loading skill correlation:", error);
    }
  };

  // Prepare heatmap data
  const prepareHeatmapData = () => {
    const skillMap = {};
    const yoeSet = new Set();

    skillsByYOE.forEach((item) => {
      const skill = item._id.skill;
      const yoe = item._id.yoe;
      yoeSet.add(yoe);
      if (!skillMap[skill]) {
        skillMap[skill] = {};
      }
      skillMap[skill][yoe] = item.value;
    });

    const topSkillsList = topSkills.slice(0, 15).map((s) => s._id);
    const yoeList = Array.from(yoeSet).sort((a, b) => a - b);

    return {
      skills: topSkillsList,
      yoeList: yoeList,
      data: skillMap,
    };
  };

  const heatmapData = prepareHeatmapData();

  const getHeatmapColor = (value, maxValue) => {
    if (!value) return "bg-slate-800";
    const intensity = value / maxValue;
    if (intensity > 0.7) return "bg-emerald-500";
    if (intensity > 0.4) return "bg-blue-500";
    if (intensity > 0.2) return "bg-yellow-400";
    return "bg-orange-400";
  };

  const maxHeatmapValue = Math.max(
    ...skillsByYOE.map((item) => item.value),
    1
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800/60 backdrop-blur-xl border-b border-slate-700/50 p-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-700/50 p-1.5 rounded-lg transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white">Market Trend Analytics</h1>
              <p className="text-slate-400 text-sm mt-0.5">BigData insights and visualizations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView("overview")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeView === "overview"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView("trends")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeView === "trends"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              Trends
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-lg hover:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <Database className="w-8 h-8 text-indigo-400" />
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-semibold text-white mb-1">
                {stats.totalRecords?.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Total Records</div>
            </div>

            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-lg hover:border-purple-500/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <Target className="w-8 h-8 text-purple-400" />
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-semibold text-white mb-1">
                {stats.uniqueSkills?.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Unique Skills</div>
            </div>

            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-lg hover:border-pink-500/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <Briefcase className="w-8 h-8 text-pink-400" />
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-semibold text-white mb-1">
                {stats.uniqueTitles?.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Job Titles</div>
            </div>

            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-lg hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <Award className="w-8 h-8 text-blue-400" />
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-3xl font-semibold text-white mb-1">
                {topSkills.length}
              </div>
              <div className="text-sm text-slate-400">Top Skills Tracked</div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Skills Bar Chart */}
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Top Skills in Market
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSkills}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="_id"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "6px",
                    color: "#f1f5f9",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {topSkills.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* YOE Distribution */}
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-purple-400" />
              Experience Level Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={yoeDistribution}>
                <defs>
                  <linearGradient id="colorYoe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="_id"
                  tick={{ fill: "#94a3b8" }}
                  label={{ value: "Years of Experience", position: "insideBottom", offset: -5, fill: "#94a3b8", style: { fontSize: "12px" } }}
                />
                <YAxis tick={{ fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "6px",
                    color: "#f1f5f9",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorYoe)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Job Titles Pie Chart */}
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <PieChartIcon className="w-5 h-5 text-pink-400" />
              Top Job Titles
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={jobTitles}
                  dataKey="count"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ _id, percent }) =>
                    `${_id.substring(0, 12)}${_id.length > 12 ? "..." : ""} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {jobTitles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "6px",
                    color: "#f1f5f9",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Skills Heatmap */}
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              <Target className="w-5 h-5 text-emerald-400" />
              Skills Demand by Experience Level
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div className="flex gap-2 mb-3 pb-2 border-b border-slate-700">
                  <div className="w-32 text-xs text-slate-400 font-medium">Skill</div>
                  {heatmapData.yoeList.map((yoe) => (
                    <div
                      key={yoe}
                      className="flex-1 text-center text-xs text-slate-400 font-medium"
                    >
                      {yoe}Y
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {heatmapData.skills.slice(0, 20).map((skill) => (
                    <div key={skill} className="flex gap-2 items-center">
                      <div className="w-32 text-sm text-slate-300 truncate font-medium">
                        {skill}
                      </div>
                      {heatmapData.yoeList.map((yoe) => {
                        const value = heatmapData.data[skill]?.[yoe] || 0;
                        return (
                          <div
                            key={`${skill}-${yoe}`}
                            className={`flex-1 h-7 rounded ${getHeatmapColor(
                              value,
                              maxHeatmapValue
                            )} flex items-center justify-center text-xs font-medium text-white transition-all hover:opacity-80`}
                            title={`${skill} at ${yoe} years: ${value} occurrences`}
                          >
                            {value > 0 && value}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-400 pt-3 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                <span>High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                <span>Low</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Trends Section */}
        {activeView === "trends" && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                <Search className="w-5 h-5 text-indigo-400" />
                Skill Market Trends Analysis
              </h3>
              <div className="mb-6">
                <input
                  type="text"
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  placeholder="Enter a skill to analyze (e.g., Python, React, Docker)"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              {selectedSkill && marketTrends.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-base font-semibold mb-4 text-slate-300">
                      Demand by Experience Level
                    </h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={marketTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis
                          dataKey="yoe"
                          tick={{ fill: "#94a3b8" }}
                          label={{ value: "Years of Experience", position: "insideBottom", offset: -5, fill: "#94a3b8", style: { fontSize: "11px" } }}
                        />
                        <YAxis tick={{ fill: "#94a3b8" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #475569",
                            borderRadius: "6px",
                            color: "#f1f5f9",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="demand"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ fill: "#6366f1", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold mb-4 text-slate-300">
                      Related Skills (Correlation)
                    </h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={skillCorrelation} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis type="number" tick={{ fill: "#94a3b8" }} />
                        <YAxis
                          dataKey="_id"
                          type="category"
                          width={100}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #475569",
                            borderRadius: "6px",
                            color: "#f1f5f9",
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {skillCorrelation.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {selectedSkill && marketTrends.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No data found for "{selectedSkill}". Try a different skill.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
