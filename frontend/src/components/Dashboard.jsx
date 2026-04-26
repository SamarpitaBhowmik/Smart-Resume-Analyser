import React, { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import {
  analyzeResumeAndJob,
  getJobSuggestions,
  getRoadmap,
  getResearchReport,
  getResearchReportPdfUrl,
  uploadResume,
} from "../utils/api.js";

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
      algorithmVersion: analysisResult?.methodology?.algorithmVersion || "hybrid-v2",
      roadmapVersion: roadmap.methodology?.version || "roadmap-v2",
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
      missingSkillTrend: roadmap.selectedSkillInsights?.demandByYoe || [],
      relatedSkills: roadmap.selectedSkillInsights?.skillAdjacency || [],
      topRoleMatches: roadmap.selectedSkillInsights?.roleFitBreakdown || [],
    },
    validationSummary: {},
    resultsSummary: {
      narrative: `${jobs[0]?.title || "Your strongest role match"} currently appears to be the best fit.`,
      interpretation: priorityRanking[0]?.skill
        ? `${priorityRanking[0].skill} is the strongest opportunity area and should be addressed first.`
        : "No priority gap was detected from the current analysis.",
    },
  };
}

function scoreTone(score = 0) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-sky-300";
  if (score >= 40) return "text-amber-300";
  return "text-rose-300";
}

function Chip({ value, tone = "slate" }) {
  const tones = {
    slate: "border-white/15 bg-white/8 text-slate-200",
    sky: "border-sky-400/25 bg-sky-500/12 text-sky-100",
    emerald: "border-emerald-400/25 bg-emerald-500/12 text-emerald-100",
    amber: "border-amber-400/25 bg-amber-500/12 text-amber-100",
    rose: "border-rose-400/25 bg-rose-500/12 text-rose-100",
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{value}</span>;
}

function SectionCard({ title, subtitle, children, action, className = "" }) {
  return (
    <section className={`app-panel rounded-[28px] p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 app-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProgressRow({ label, value, color = "bg-sky-500" }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, note, score, icon }) {
  return (
    <div className="app-panel-soft rounded-[24px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-2xl border border-white/10 bg-white/8 p-2.5">
          {React.createElement(icon, { className: "h-5 w-5 text-sky-300" })}
        </div>
        <div className={`text-2xl font-semibold ${typeof score === "number" ? scoreTone(score) : "text-white"}`}>{value}</div>
      </div>
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{note}</div>
    </div>
  );
}

function ActionTile({ icon, title, text }) {
  return (
    <div className="app-panel-soft rounded-[24px] p-5">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
        {React.createElement(icon, { className: "h-5 w-5 text-sky-300" })}
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [resumeId, setResumeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing your profile...");
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [jobSuggestions, setJobSuggestions] = useState(null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [selectedPrioritySkill, setSelectedPrioritySkill] = useState(null);
  const [reportData, setReportData] = useState(null);

  const quality = reportData?.resumeQuality || analysisResult?.resumeQuality || null;
  const jobs = jobSuggestions?.jobs || reportData?.jobs || [];
  const roadmap = roadmapData?.roadmap || analysisResult?.upskillingPlan || null;
  const priorityRanking = useMemo(
    () => roadmap?.priorityRanking || analysisResult?.skillPriorityRanking || [],
    [roadmap?.priorityRanking, analysisResult?.skillPriorityRanking]
  );
  const weakestStatements = useMemo(() => {
    const statements = quality?.statements || [];
    return statements.filter((item) => item.flags?.length).sort((a, b) => a.overallScore - b.overallScore).slice(0, 3);
  }, [quality]);
  const summary = reportData?.summary || {};
  const activeSkill = selectedPrioritySkill || roadmap?.focusSkill || priorityRanking[0]?.skill;
  const topRoadmapItems = [...(roadmap?.courses || []).slice(0, 2), ...(roadmap?.projects || []).slice(0, 2)].slice(0, 4);

  const resetAnalysis = () => {
    setResumeId(null);
    setAnalysisResult(null);
    setJobSuggestions(null);
    setRoadmapData(null);
    setReportData(null);
    setSelectedPrioritySkill(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF resume.");
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

  const loadRoadmapForSkill = async (currentResumeId, skill = null) => {
    const response = await getRoadmap(currentResumeId, skill);
    setRoadmapData(response);
    setSelectedPrioritySkill(response.roadmap?.focusSkill || response.roadmap?.priorityRanking?.[0]?.skill || null);
    return response;
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jobDesc.trim()) {
      setError("Please upload a resume and paste a job description.");
      return;
    }
    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setJobSuggestions(null);
    setRoadmapData(null);
    setReportData(null);
    try {
      setLoadingMessage("Uploading your resume...");
      const uploadResponse = await uploadResume(resumeFile);
      setResumeId(uploadResponse.id);
      setLoadingMessage("Matching against the role...");
      const analysisResponse = await analyzeResumeAndJob(uploadResponse.id, jobDesc);
      setAnalysisResult(analysisResponse);
      setLoadingMessage("Finding the strongest role matches...");
      const jobsResponse = await getJobSuggestions(uploadResponse.id, 10);
      setJobSuggestions(jobsResponse);
      setLoadingMessage("Building your action plan...");
      const roadmapResponse = await loadRoadmapForSkill(uploadResponse.id);
      try {
        setLoadingMessage("Preparing your report...");
        const reportResponse = await getResearchReport(uploadResponse.id);
        setReportData(reportResponse);
        cacheReport(uploadResponse.id, reportResponse);
      } catch (reportError) {
        console.error("Report fetch failed, using local snapshot:", reportError);
        const localReport = buildLocalReportSnapshot({
          resumeId: uploadResponse.id,
          analysisResult: analysisResponse,
          jobsResponse,
          roadmapResponse,
        });
        setReportData(localReport);
        cacheReport(uploadResponse.id, localReport);
      }
    } catch (analysisError) {
      console.error(analysisError);
      setError(analysisError.message || "We couldn't complete the analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleFocusSkill = async (skill) => {
    if (!resumeId || !skill) return;
    try {
      setRoadmapLoading(true);
      await loadRoadmapForSkill(resumeId, skill);
    } catch (roadmapError) {
      console.error(roadmapError);
      setError(roadmapError.message || "We couldn't update the plan.");
    } finally {
      setRoadmapLoading(false);
    }
  };

  const openAnalytics = () => {
    const params = new URLSearchParams();
    if (resumeId) params.set("resumeId", resumeId);
    if (activeSkill) params.set("skill", activeSkill);
    navigate(`/analytics${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const openReport = () => {
    if (!resumeId) return;
    navigate(`/report/${resumeId}`, { state: { report: reportData } });
  };

  const downloadReport = () => {
    if (!resumeId) return;
    window.open(getResearchReportPdfUrl(resumeId), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <div className="app-topbar">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate("/")} className="app-btn-secondary rounded-2xl p-2 transition hover:border-sky-400/40 hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="app-eyebrow">CareerAlign Workspace</div>
                <h1 className="mt-1 text-2xl font-semibold text-white">Resume intelligence dashboard</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => navigate("/resume-recommendations")} className="app-btn-secondary rounded-2xl px-4 py-2 text-sm font-medium transition hover:border-sky-400/40 hover:text-white">Resume recommendations</button>
              <button onClick={openAnalytics} className="app-btn-secondary rounded-2xl px-4 py-2 text-sm font-medium transition hover:border-sky-400/40 hover:text-white">Market analytics</button>
              <button onClick={openReport} disabled={!resumeId} className="app-btn-secondary rounded-2xl px-4 py-2 text-sm font-medium transition hover:border-sky-400/40 hover:text-white disabled:opacity-50">View report</button>
              <button onClick={downloadReport} disabled={!resumeId} className="app-btn-primary rounded-2xl px-4 py-2 text-sm font-medium transition hover:brightness-110 disabled:opacity-50">PDF</button>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
          <section className="app-hero rounded-[32px] p-7 md:p-8">
            <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="app-eyebrow">Start Here</div>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
                  Upload a resume and evaluate fit for a target role.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                  Add a job description to generate a fit score, skill-gap analysis, priority ranking, and a learning plan you can act on.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <ActionTile icon={Target} title="Fit breakdown" text="See how skill coverage, experience alignment, and semantic similarity affect the score." />
                  <ActionTile icon={Sparkles} title="Priority ranking" text="Missing skills are ranked using role relevance, market demand, and readiness." />
                  <ActionTile icon={BookOpen} title="Learning plan" text="Get a phased roadmap backed by curated learning resources." />
                </div>
              </div>

              <div className="app-panel rounded-[28px] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white">Run an analysis</div>
                    <div className="mt-1 text-sm text-slate-300">One resume. One role. One clean workspace.</div>
                  </div>
                  {resumeFile ? <Chip value="Resume attached" tone="emerald" /> : <Chip value="PDF required" tone="sky" />}
                </div>

                <div className="space-y-4">
                  <label className="block cursor-pointer rounded-[24px] border-2 border-dashed border-white/15 bg-white/5 p-5 transition hover:border-sky-400/35 hover:bg-white/8">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15">
                        <Upload className="h-5 w-5 text-sky-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">{resumeFile ? resumeFile.name : "Upload your PDF resume"}</div>
                        <div className="mt-1 text-sm text-slate-300">{resumeFile ? "Resume ready for analysis. Replace it anytime." : "Choose the candidate resume you want to benchmark."}</div>
                      </div>
                      {resumeFile ? (
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemoveFile(); }} className="rounded-xl p-2 text-rose-300 transition hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                  </label>

                  <div>
                    <div className="mb-2 text-sm font-semibold text-white">Target job description</div>
                    <textarea
                      rows="8"
                      value={jobDesc}
                      onChange={(event) => { setJobDesc(event.target.value); setError(null); }}
                      className="w-full rounded-[24px] border border-white/15 bg-white/5 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 focus:bg-white/8"
                      placeholder="Paste the role requirements here so the system can evaluate fit, gaps, and strongest next steps."
                    />
                  </div>

                  {error ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <button onClick={handleAnalyze} disabled={!resumeFile || !jobDesc.trim() || loading} className="app-btn-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                    {loading ? loadingMessage : "Analyze candidate"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {!analysisResult ? (
            <SectionCard
              title="What you’ll get after analysis"
              subtitle="CareerAlign combines fit scoring, market evidence, and recommendations into one consistent workflow."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <ActionTile icon={FileText} title="Match summary" text="A clear fit score with matched vs missing skills." />
                <ActionTile icon={BarChart3} title="Market context" text="See why a gap matters across roles and experience bands." />
                <ActionTile icon={Briefcase} title="Next steps" text="Top benchmark roles plus a practical upskilling roadmap." />
              </div>
            </SectionCard>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Target} label="Match score" value={`${summary.jobFitScore || analysisResult.match?.percentage || 0}%`} note="Overall fit for the selected role." score={summary.jobFitScore || analysisResult.match?.percentage || 0} />
                <StatCard icon={Sparkles} label="Resume quality" value={`${summary.resumeQualityScore || quality?.overallScore || 0}%`} note="How clearly the resume communicates impact." score={summary.resumeQualityScore || quality?.overallScore || 0} />
                <StatCard
                  icon={Briefcase}
                  label="Best-fit role"
                  value={summary.bestFitRole || jobs[0]?.title || "Not available"}
                  note="Top recommendation from the benchmark role set."
                />
                <StatCard icon={BookOpen} label="Top opportunity" value={summary.highestImpactMissingSkill || priorityRanking[0]?.skill || "No gap"} note="The skill most worth prioritizing next." />
              </div>

              <SectionCard title="Profile match and priority evidence" subtitle="Matching signals and ranked skill gaps now sit side by side in a roomy section instead of inside a cramped split layout." action={<button onClick={openAnalytics} className="app-btn-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition hover:border-sky-400/40 hover:text-white">Open analytics <ArrowRight className="h-4 w-4" /></button>}>
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="app-panel-soft rounded-[24px] p-5">
                    <div className="mb-4 text-sm font-semibold text-white">Profile match</div>
                    <div className="space-y-4">
                      <ProgressRow label="Exact skill coverage" value={analysisResult.match?.exactSkillCoverageScore || analysisResult.match?.skillCoverageScore || 0} color="bg-sky-500" />
                      <ProgressRow label="Skill level fit" value={analysisResult.match?.skillLevelFitScore || 0} color="bg-cyan-500" />
                      <ProgressRow label="Semantic similarity" value={analysisResult.match?.semanticScore || 0} color="bg-emerald-500" />
                      <ProgressRow label="Experience alignment" value={analysisResult.match?.experienceScore || 0} color="bg-amber-500" />
                      <ProgressRow label="Role benchmark fit" value={analysisResult.match?.roleCooccurrenceFitScore || 0} color="bg-fuchsia-500" />
                    </div>
                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <div>
                        <div className="mb-3 text-sm font-semibold text-white">Matched skills</div>
                        <div className="flex flex-wrap gap-2">{(analysisResult.match?.matchedSkills || []).slice(0, 12).map((skill) => <Chip key={skill} value={skill} tone="emerald" />)}</div>
                      </div>
                      <div>
                        <div className="mb-3 text-sm font-semibold text-white">Missing skills</div>
                        <div className="flex flex-wrap gap-2">{(analysisResult.match?.missingSkills || []).slice(0, 12).map((skill) => <Chip key={skill} value={skill} tone="rose" />)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {priorityRanking.slice(0, 4).map((item) => {
                      const isActive = activeSkill === item.skill;
                      return (
                        <button key={item.skill} onClick={() => handleFocusSkill(item.skill)} className={`block w-full rounded-[24px] border p-5 text-left transition ${isActive ? "border-sky-400/35 bg-sky-500/12" : "border-white/12 bg-white/5 hover:border-sky-400/25 hover:bg-white/8"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-white">{item.skill}</div>
                              <div className="mt-2 text-sm leading-6 text-slate-300">{item.selectedBecause?.[0] || "High-value skill gap."}</div>
                            </div>
                            <Chip value={`${item.priorityScore}%`} tone={isActive ? "sky" : "amber"} />
                          </div>
                          <div className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-3">
                            <div>Demand <span className="font-semibold">{item.marketDemandScore}%</span></div>
                            <div>Role need <span className="font-semibold">{item.targetRoleNeedScore}%</span></div>
                            <div>Readiness <span className="font-semibold">{item.readinessScore}%</span></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>

              <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <SectionCard title="Action plan" subtitle="The roadmap gets the full reading width it needs." action={roadmapLoading ? <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium text-slate-100"><Loader2 className="h-3.5 w-3.5 animate-spin" />Updating</div> : roadmap?.focusSkill ? <Chip value={`Focused on ${roadmap.focusSkill}`} tone="amber" /> : null}>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {(roadmap?.phases || []).map((phase) => (
                      <div key={phase.name} className="app-panel-soft rounded-[24px] p-4">
                        <div className="font-semibold text-white">{phase.name}</div>
                        <div className="mt-1 text-sm text-slate-300">{phase.items?.length || 0} items</div>
                        <div className="mt-4 space-y-3">{(phase.items || []).slice(0, 2).map((item) => <div key={item.course_id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-sm font-semibold text-white">{item.title}</div><div className="mt-1 text-xs text-slate-300">{item.targetSkill} · {item.estimated_weeks} weeks</div></div>)}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Recommended next steps" subtitle="Compact, readable suggestions you can act on immediately.">
                  <div className="space-y-4">
                    {topRoadmapItems.length ? topRoadmapItems.map((item) => (
                      <div key={item.course_id} className="app-panel-soft rounded-[24px] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{item.title}</div>
                            <div className="mt-1 text-sm text-slate-300">{item.targetSkill} · {item.estimated_weeks} weeks · {item.level}</div>
                          </div>
                          <Chip value={`${item.priorityLabel} priority`} tone={item.priorityLabel === "High" ? "amber" : item.priorityLabel === "Medium" ? "sky" : "slate"} />
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-300">{item.selectedBecause?.[0] || "Selected because it supports the current highest-value opportunity."}</div>
                      </div>
                    )) : <div className="app-panel-soft rounded-[24px] p-4 text-sm text-slate-300">No learning steps are available yet.</div>}
                  </div>
                </SectionCard>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <SectionCard title="Best-fit roles" subtitle="These are the strongest benchmark matches for the current profile.">
                  <div className="grid gap-4 md:grid-cols-3">
                    {jobs.slice(0, 3).length ? jobs.slice(0, 3).map((job) => (
                      <div key={job.jobId || job.title} className="app-panel-soft rounded-[24px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div><div className="font-semibold text-white">{job.title}</div><div className="mt-1 text-sm text-slate-300">{job.company || "Benchmark role"}</div></div>
                          <Chip value={`${job.finalScore}% fit`} tone="sky" />
                        </div>
                        <div className="mt-4 space-y-3">
                          <ProgressRow label="Exact skill coverage" value={job.skillCoverageScore || 0} color="bg-sky-500" />
                          <ProgressRow label="Experience alignment" value={job.experienceScore || 0} color="bg-amber-500" />
                        </div>
                        <div className="mt-4 text-sm leading-6 text-slate-300">{job.explanation?.[0] || "This role is one of the closest matches in the benchmark set."}</div>
                      </div>
                    )) : <div className="app-panel-soft rounded-[24px] p-4 text-sm text-slate-300">No benchmark roles available yet.</div>}
                  </div>
                </SectionCard>

                <SectionCard title="Resume polish" subtitle="A few quick improvements that can strengthen the current resume immediately.">
                  <div className="space-y-4">
                    {weakestStatements.length ? weakestStatements.map((statement, index) => (
                      <div key={`${statement.text}-${index}`} className="app-panel-soft rounded-[24px] p-4">
                        <div className="flex flex-wrap gap-2">
                          <Chip value={`${statement.overallScore}%`} tone="amber" />
                          {(statement.flags || []).map((flag) => <Chip key={flag} value={flag.replace(/_/g, " ")} tone="rose" />)}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{statement.text}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{statement.suggestion}</p>
                      </div>
                    )) : <div className="app-panel-soft rounded-[24px] p-4 text-sm text-slate-300">No urgent resume writing issues were flagged in the current extract.</div>}
                  </div>
                </SectionCard>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
