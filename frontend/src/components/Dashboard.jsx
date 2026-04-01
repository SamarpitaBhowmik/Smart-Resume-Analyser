import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  LogOut,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";

import {
  analyzeResumeAndJob,
  getJobSuggestions,
  getResearchReport,
  getResearchReportPdfUrl,
  uploadResume,
} from "../utils/api.js";

function scoreTone(score = 0) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-sky-300";
  if (score >= 40) return "text-amber-300";
  return "text-rose-300";
}

function MetricCard({ icon, label, value, note, score }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-2">
          {React.createElement(icon, { className: "h-5 w-5 text-sky-300" })}
        </div>
        {typeof score === "number" && (
          <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300">
            research
          </span>
        )}
      </div>
      <div className={`text-3xl font-semibold ${typeof score === "number" ? scoreTone(score) : "text-white"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-200">{label}</div>
      <div className="mt-2 text-sm text-slate-400">{note}</div>
    </div>
  );
}

function SkillChip({ value, tone = "sky" }) {
  const tones = {
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    slate: "border-slate-700 bg-slate-800/80 text-slate-200",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>{value}</span>;
}

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-800">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
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
  const [loadingMessage, setLoadingMessage] = useState("Running analysis...");
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [jobSuggestions, setJobSuggestions] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("analysis");

  const quality = reportData?.resumeQuality || analysisResult?.resumeQuality || null;
  const jobs = jobSuggestions?.jobs || reportData?.jobs || [];
  const summary = reportData?.summary || {};
  const matchScore = summary.jobFitScore || analysisResult?.match?.percentage || 0;
  const weakStatements = useMemo(() => {
    const statements = quality?.statements || [];
    return statements.filter((item) => item.flags?.length).sort((a, b) => a.overallScore - b.overallScore).slice(0, 4);
  }, [quality]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF resume. This research build currently supports PDF input.");
      return;
    }
    setResumeFile(file);
    setResumeId(null);
    setAnalysisResult(null);
    setJobSuggestions(null);
    setReportData(null);
    setError(null);
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    setResumeId(null);
    setAnalysisResult(null);
    setJobSuggestions(null);
    setReportData(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jobDesc.trim()) {
      setError("Please upload a resume and provide a job description.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setJobSuggestions(null);
    setReportData(null);

    try {
      setLoadingMessage("Uploading and parsing the resume...");
      const uploadResponse = await uploadResume(resumeFile);
      setResumeId(uploadResponse.id);

      setLoadingMessage("Running hybrid job-fit analysis...");
      const analysisResponse = await analyzeResumeAndJob(uploadResponse.id, jobDesc);
      setAnalysisResult(analysisResponse);

      setLoadingMessage("Ranking benchmark roles...");
      const jobsResponse = await getJobSuggestions(uploadResponse.id, 10);
      setJobSuggestions(jobsResponse);

      setLoadingMessage("Building the research report...");
      const reportResponse = await getResearchReport(uploadResponse.id);
      setReportData(reportResponse);

      setActiveTab("analysis");
    } catch (analysisError) {
      console.error(analysisError);
      setError(analysisError.message || "Failed to analyze the resume.");
    } finally {
      setLoading(false);
    }
  };

  const openReport = () => {
    if (resumeId) navigate(`/report/${resumeId}`);
  };

  const downloadReport = () => {
    if (resumeId) window.open(getResearchReportPdfUrl(resumeId), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_30%)] pointer-events-none" />
      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800/80 bg-slate-950/85 p-6 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 font-bold text-white">CA</div>
              <div>
                <div className="text-lg font-semibold text-white">CareerAlign</div>
                <div className="text-xs uppercase tracking-[0.2em] text-sky-300">research mode</div>
              </div>
            </div>
            <button onClick={() => navigate("/")} className="rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-slate-300 transition hover:border-sky-500/40 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-2">
            <button className="flex w-full items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-left text-sky-200">
              <SearchCheck className="h-4 w-4" />
              Research Dashboard
            </button>
            <button onClick={() => navigate("/analytics")} className="flex w-full items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-left text-slate-300 transition hover:border-sky-500/40 hover:text-white">
              <BarChart3 className="h-4 w-4" />
              Market Analytics
            </button>
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
            <p>Hybrid matching keeps job-fit evidence explainable.</p>
            <p className="mt-3">Resume quality scoring is separated from job-fit to make the methodology easier to defend.</p>
            <p className="mt-3">Dataset validation metrics stay visible throughout the workflow.</p>
          </div>

          <div className="mt-auto flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-semibold text-white">U</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Project workspace</div>
              <div className="text-xs text-slate-400">BTech final year</div>
            </div>
            <LogOut className="h-4 w-4 text-slate-500" />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-7 shadow-2xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300">Research-backed candidate evaluation</div>
                  <h1 className="mt-3 text-3xl font-semibold text-white">Resume analysis with explainable matching and report export</h1>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                    Upload a resume, compare it against a role, and generate a report that combines hybrid job-fit scoring, resume quality analysis, missing-skill demand, and dataset validation evidence.
                  </p>
                </div>
                {reportData && (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 px-5 py-4">
                    <div className="text-sm text-slate-400">Current run</div>
                    <div className={`mt-2 text-3xl font-semibold ${scoreTone(matchScore)}`}>{matchScore}%</div>
                    <div className="text-sm text-slate-300">Hybrid job-fit score</div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-200">
                    <Upload className="h-4 w-4" />
                    Upload resume
                  </div>
                  <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/70 px-6 py-10 text-center transition hover:border-sky-500/50 hover:bg-sky-500/5">
                    <Upload className="mb-3 h-8 w-8 text-slate-400" />
                    <span className="text-sm font-medium text-slate-200">Click or drag a PDF resume</span>
                    <span className="mt-1 text-xs text-slate-500">PDF only in the current implementation</span>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                  </label>
                  {resumeFile && (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 flex-none text-emerald-300" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-emerald-100">{resumeFile.name}</div>
                          <div className="text-xs text-emerald-300/80">Ready for parsing and scoring</div>
                        </div>
                      </div>
                      <button onClick={handleRemoveFile} className="rounded-lg p-2 text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-200">
                    <Briefcase className="h-4 w-4" />
                    Job description
                  </div>
                  <textarea
                    rows="10"
                    value={jobDesc}
                    onChange={(event) => {
                      setJobDesc(event.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-100 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                    placeholder="Paste the target role here. The system will extract skills, estimate experience expectations, and compare them against the resume."
                  />
                </div>
              </div>

              {error && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={handleAnalyze} disabled={!resumeFile || !jobDesc.trim() || loading} className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                  {loading ? loadingMessage : "Run research analysis"}
                </button>
                <button onClick={() => navigate("/analytics")} className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-sky-500/40 hover:text-white">
                  Open analytics
                </button>
              </div>
            </section>

            {analysisResult && (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard icon={Target} label="Job Fit Score" value={`${summary.jobFitScore || analysisResult.match?.percentage || 0}%`} note="Hybrid score from exact skills, semantics, and experience alignment." score={summary.jobFitScore || analysisResult.match?.percentage || 0} />
                  <MetricCard icon={Sparkles} label="Resume Quality Score" value={`${summary.resumeQualityScore || quality?.overallScore || 0}%`} note={`${quality?.confidenceLabel || "Low"} confidence across ${quality?.statementCount || 0} statements.`} score={summary.resumeQualityScore || quality?.overallScore || 0} />
                  <MetricCard icon={Briefcase} label="Best-Fit Role" value={summary.bestFitRole || jobs[0]?.title || "Not determined"} note="Highest-ranked benchmark role from the recommendation engine." />
                  <MetricCard icon={TrendingUp} label="Highest-Impact Missing Skill" value={summary.highestImpactMissingSkill || "None"} note="The missing skill with the strongest benchmark demand signal." />
                </section>

                <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                  <div className="flex flex-wrap gap-3">
                    {[
                      ["analysis", "Analysis evidence"],
                      ["jobs", `Job recommendations (${jobs.length})`],
                      ["report", "Report preview"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                          activeTab === key ? "border border-sky-500/30 bg-sky-500/10 text-sky-200" : "border border-slate-700 bg-slate-950/70 text-slate-300 hover:border-sky-500/30 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Research report actions</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Open the full report or export a PDF with the same evidence and methodology.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={openReport} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-sky-500/40 hover:text-white">
                        <FileText className="h-4 w-4" />
                        View web report
                      </button>
                      <button onClick={downloadReport} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500">
                        <Download className="h-4 w-4" />
                        Download PDF
                      </button>
                    </div>
                  </div>
                </section>

                {activeTab === "analysis" && (
                  <section className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                      <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                        <div className="text-sm font-medium text-white">Hybrid match evidence</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {reportData?.resultsSummary?.narrative || "This run compares the uploaded resume against the supplied role using the hybrid matching methodology."}
                        </p>
                        <div className={`mt-5 text-6xl font-semibold ${scoreTone(matchScore)}`}>{matchScore}%</div>
                        <div className="mt-4 space-y-4">
                          <ScoreBar label="Skill coverage" value={analysisResult.methodology?.componentScores?.skillCoverageScore || analysisResult.match?.skillCoverageScore || 0} color="bg-sky-500" />
                          <ScoreBar label="Semantic similarity" value={analysisResult.methodology?.componentScores?.semanticScore || analysisResult.match?.semanticScore || 0} color="bg-emerald-500" />
                          <ScoreBar label="Experience alignment" value={analysisResult.methodology?.componentScores?.experienceScore || analysisResult.match?.experienceScore || 0} color="bg-amber-500" />
                        </div>
                        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                          {analysisResult.methodology?.formula || "Hybrid score combines exact skill overlap, semantic similarity, and experience alignment."}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                        <div className="text-sm font-medium text-white">Resume quality scoring</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{quality?.summary}</p>
                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="text-sm text-slate-400">Action verbs</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{quality?.categoryScores?.actionVerbScore || 0}%</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="text-sm text-slate-400">Measurable impact</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{quality?.categoryScores?.measurableImpactScore || 0}%</div>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="text-sm text-slate-400">Clarity</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{quality?.categoryScores?.clarityScore || 0}%</div>
                          </div>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <SkillChip value={`${quality?.confidenceLabel || "Low"} confidence`} tone="amber" />
                          <SkillChip value={`${quality?.statementCount || 0} statements scored`} tone="slate" />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                      <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                        <div className="text-sm font-medium text-white">Matched and missing skills</div>
                        <div className="mt-5">
                          <div className="mb-3 text-sm text-slate-400">Matched skills ({analysisResult.match?.matchedSkills?.length || 0})</div>
                          <div className="flex flex-wrap gap-2">
                            {(analysisResult.match?.matchedSkills || []).map((skill) => (
                              <SkillChip key={`matched-${skill}`} value={skill} tone="emerald" />
                            ))}
                          </div>
                        </div>
                        <div className="mt-5">
                          <div className="mb-3 text-sm text-slate-400">Missing skills ({analysisResult.match?.missingSkills?.length || 0})</div>
                          <div className="flex flex-wrap gap-2">
                            {(analysisResult.match?.missingSkills || []).map((skill) => (
                              <SkillChip key={`missing-${skill}`} value={skill} tone="rose" />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                        <div className="text-sm font-medium text-white">Priority statement feedback</div>
                        <div className="mt-5 space-y-4">
                          {weakStatements.length ? (
                            weakStatements.map((statement, index) => (
                              <div key={`${statement.text}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                                <div className="flex flex-wrap gap-2">
                                  <SkillChip value={`${statement.overallScore}% overall`} tone="amber" />
                                  {(statement.flags || []).map((flag) => (
                                    <SkillChip key={flag} value={flag.replace(/_/g, " ")} tone="rose" />
                                  ))}
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-200">{statement.text}</p>
                                <p className="mt-3 text-sm text-slate-400">{statement.suggestion}</p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
                              No weak statements were flagged in the current resume extract.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                        <BookOpen className="h-4 w-4 text-sky-300" />
                        Personalized learning roadmap
                      </div>
                      <div className="mb-5 flex flex-wrap gap-2">
                        <SkillChip value={`${analysisResult.upskillingPlan?.timelineWeeks || "0"} weeks estimated`} tone="sky" />
                      </div>
                      <div className="grid gap-5 xl:grid-cols-3">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                          <div className="mb-3 text-sm font-medium text-white">Courses</div>
                          <div className="space-y-3 text-sm text-slate-300">
                            {(analysisResult.upskillingPlan?.courses || []).slice(0, 4).map((course, index) => (
                              <div key={`${course.title || course.skill}-${index}`}>
                                <div className="font-medium text-white">{course.title || course.skill}</div>
                                <div className="mt-1 text-slate-400">{course.platform || "Platform not specified"} | {course.duration || "Flexible"}</div>
                              </div>
                            ))}
                            {!analysisResult.upskillingPlan?.courses?.length && <div className="text-slate-500">No courses were generated.</div>}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                          <div className="mb-3 text-sm font-medium text-white">Practice projects</div>
                          <div className="space-y-3 text-sm text-slate-300">
                            {(analysisResult.upskillingPlan?.projects || []).slice(0, 4).map((project, index) => (
                              <div key={`${project.title}-${index}`}>
                                <div className="font-medium text-white">{project.title}</div>
                                <div className="mt-1 text-slate-400">{project.description}</div>
                              </div>
                            ))}
                            {!analysisResult.upskillingPlan?.projects?.length && <div className="text-slate-500">No projects were generated.</div>}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                          <div className="mb-3 text-sm font-medium text-white">Resources</div>
                          <div className="space-y-3 text-sm text-slate-300">
                            {(analysisResult.upskillingPlan?.resources || []).slice(0, 4).map((resource, index) => (
                              <div key={`${resource.title}-${index}`}>
                                <div className="font-medium text-white">{resource.title}</div>
                                <div className="mt-1 text-slate-400">{resource.type || "Resource"} {resource.skill ? `| ${resource.skill}` : ""}</div>
                              </div>
                            ))}
                            {!analysisResult.upskillingPlan?.resources?.length && <div className="text-slate-500">No resources were generated.</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === "jobs" && (
                  <section className="space-y-4">
                    {jobs.length ? (
                      jobs.map((job) => (
                        <div key={job.jobId || job.title} className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="text-xl font-semibold text-white">{job.title}</div>
                              <div className="mt-1 text-sm text-slate-400">{job.company || "Curated benchmark"} | {job.location || "Location not specified"}</div>
                              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{job.yoeLabel || job.experienceText || "Experience range not available"}</div>
                            </div>
                            <SkillChip value={`${job.finalScore}% fit`} tone="sky" />
                          </div>
                          <p className="mt-4 text-sm leading-6 text-slate-300">{job.description}</p>
                          <div className="mt-5 grid gap-4 md:grid-cols-3">
                            <ScoreBar label="Skill coverage" value={job.skillCoverageScore || 0} color="bg-sky-500" />
                            <ScoreBar label="Semantic similarity" value={job.semanticScore || 0} color="bg-emerald-500" />
                            <ScoreBar label="Experience alignment" value={job.experienceScore || 0} color="bg-amber-500" />
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {(job.matchedSkills || []).slice(0, 6).map((skill) => (
                              <SkillChip key={`${job.title}-matched-${skill}`} value={skill} tone="emerald" />
                            ))}
                            {(job.missingSkills || []).slice(0, 5).map((skill) => (
                              <SkillChip key={`${job.title}-missing-${skill}`} value={`Need ${skill}`} tone="rose" />
                            ))}
                          </div>
                          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="mb-3 text-sm font-medium text-white">Explanation</div>
                            <div className="space-y-3 text-sm text-slate-300">
                              {(job.explanation || []).map((reason, index) => (
                                <div key={`${job.title}-reason-${index}`} className="flex items-start gap-3">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-sky-300" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 text-center text-sm text-slate-400 shadow-2xl">
                        No benchmark job recommendations were returned for this resume.
                      </div>
                    )}
                  </section>
                )}

                {activeTab === "report" && (
                  <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                        <ShieldCheck className="h-4 w-4 text-sky-300" />
                        Dataset validation snapshot
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="text-sm text-slate-400">Retained row rate</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{Math.round((reportData?.validationSummary?.retainedRowRate || 0) * 100)}%</div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="text-sm text-slate-400">Dropped rows</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{reportData?.validationSummary?.droppedRowCount || 0}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="text-sm text-slate-400">Duplicate rows removed</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{reportData?.validationSummary?.duplicateRowsRemoved || 0}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                          <div className="text-sm text-slate-400">Invalid YOE rows</div>
                          <div className="mt-2 text-2xl font-semibold text-white">{reportData?.validationSummary?.invalidYoeRows || 0}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6 shadow-2xl">
                      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                        <FileText className="h-4 w-4 text-sky-300" />
                        Report interpretation
                      </div>
                      <div className="space-y-4 text-sm leading-6 text-slate-300">
                        <p>{reportData?.resultsSummary?.narrative}</p>
                        <p>{reportData?.resultsSummary?.interpretation}</p>
                        <p>{reportData?.methodology?.matching}</p>
                        <p>{reportData?.methodology?.resumeQuality}</p>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
