import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Briefcase,
  Target,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

import {
  getResearchReport,
  getResearchReportPdfUrl,
} from "../utils/api.js";

const COLORS = ["#38bdf8", "#60a5fa", "#34d399", "#f59e0b", "#f97316", "#f43f5e"];

function scoreTone(score = 0) {
  if (score >= 80) {
    return {
      value: "text-emerald-300",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    };
  }
  if (score >= 60) {
    return {
      value: "text-sky-300",
      badge: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    };
  }
  if (score >= 40) {
    return {
      value: "text-amber-300",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    };
  }
  return {
    value: "text-rose-300",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  };
}

function SummaryCard({ label, value, note, icon, score }) {
  const tone = typeof score === "number" ? scoreTone(score) : null;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-2">
          {React.createElement(icon, { className: "h-5 w-5 text-sky-300" })}
        </div>
        {typeof score === "number" && (
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
            Evidence-backed
          </span>
        )}
      </div>
      <div className={`text-3xl font-semibold ${tone?.value || "text-white"}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-200">{label}</div>
      <div className="mt-2 text-sm text-slate-400">{note}</div>
    </div>
  );
}

function Section({ title, subtitle, icon, children }) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-2">
          {React.createElement(icon, { className: "h-5 w-5 text-sky-300" })}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ScoreBar({ label, value, accent = "bg-sky-500" }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-800">
        <div
          className={`h-2.5 rounded-full ${accent}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function SkillChip({ value, tone = "sky" }) {
  const tones = {
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {value}
    </span>
  );
}

export default function ResearchReport() {
  const navigate = useNavigate();
  const { resumeId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadReport() {
      try {
        setLoading(true);
        setError(null);
        const data = await getResearchReport(resumeId);
        if (mounted) {
          setReport(data);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || "Failed to load research report.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadReport();
    return () => {
      mounted = false;
    };
  }, [resumeId]);

  const weakStatements = useMemo(() => {
    const statements = report?.resumeQuality?.statements || [];
    return statements
      .filter((statement) => statement.flags?.length)
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, 5);
  }, [report]);

  const downloadPdf = () => {
    window.open(getResearchReportPdfUrl(resumeId), "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-sky-300" />
          <p className="text-sm text-slate-400">Building the research report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="max-w-xl rounded-2xl border border-rose-500/30 bg-slate-900/80 p-8 text-center shadow-2xl">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-rose-300" />
          <h1 className="text-xl font-semibold text-white">Report unavailable</h1>
          <p className="mt-3 text-sm text-slate-400">{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const summary = report?.summary || {};
  const resume = report?.resume || {};
  const analysis = report?.analysis || {};
  const quality = report?.resumeQuality || {};
  const recommendations = report?.recommendations || {};
  const validationSummary = report?.validationSummary || {};
  const marketEvidence = report?.marketEvidence || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-300 transition hover:border-sky-500/40 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
                CareerAlign Research Report
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-white">Explainable candidate analysis</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/analytics")}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/40 hover:text-white"
            >
              Open analytics
            </button>
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-7 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
                Research-backed decision support
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                {resume.name || "Candidate profile"} benchmarked with hybrid explainable matching
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                {report?.resultsSummary?.narrative}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                {report?.resultsSummary?.interpretation}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
              <div className="text-sm font-medium text-slate-200">Reproducibility metadata</div>
              <div className="mt-4 space-y-3 text-sm text-slate-400">
                <div className="flex items-center justify-between gap-4">
                  <span>Algorithm version</span>
                  <span className="font-medium text-white">{report?.metadata?.algorithmVersion}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Resume quality version</span>
                  <span className="font-medium text-white">{report?.metadata?.resumeQualityVersion}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Dataset version</span>
                  <span className="font-medium text-white">{report?.metadata?.datasetVersion}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Generated at</span>
                  <span className="font-medium text-white">
                    {new Date(report?.metadata?.generatedAt || Date.now()).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Target}
            label="Job Fit Score"
            value={`${summary.jobFitScore || 0}%`}
            note="Hybrid evidence from skill coverage, semantic similarity, and experience alignment."
            score={summary.jobFitScore || 0}
          />
          <SummaryCard
            icon={Sparkles}
            label="Resume Quality Score"
            value={`${summary.resumeQualityScore || 0}%`}
            note={`${quality.confidenceLabel || "Low"} confidence across ${quality.statementCount || 0} resume statements.`}
            score={summary.resumeQualityScore || 0}
          />
          <SummaryCard
            icon={Briefcase}
            label="Best-Fit Role"
            value={summary.bestFitRole || "Not determined"}
            note="Highest-ranked benchmark role from the curated recommendation dataset."
          />
          <SummaryCard
            icon={TrendingUp}
            label="Highest-Impact Missing Skill"
            value={summary.highestImpactMissingSkill || "None"}
            note="The missing skill with the strongest demand signal in the benchmark market."
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Section
            title="Candidate snapshot"
            subtitle="Structured resume facts used in the research report."
            icon={FileText}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm text-slate-400">Candidate</div>
                <div className="mt-2 text-xl font-semibold text-white">{resume.name || "Not provided"}</div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400">Skills extracted</div>
                    <div className="mt-1 font-medium text-white">{resume.skills?.length || 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Experience entries</div>
                    <div className="mt-1 font-medium text-white">{resume.experienceCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Education entries</div>
                    <div className="mt-1 font-medium text-white">{resume.educationCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Statements scored</div>
                    <div className="mt-1 font-medium text-white">{quality.statementCount || 0}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm text-slate-400">Role-match evidence</div>
                <div className="mt-4 space-y-4">
                  <ScoreBar
                    label="Skill coverage"
                    value={analysis.match?.skillCoverageScore || 0}
                    accent="bg-sky-500"
                  />
                  <ScoreBar
                    label="Semantic similarity"
                    value={analysis.match?.semanticScore || 0}
                    accent="bg-emerald-500"
                  />
                  <ScoreBar
                    label="Experience alignment"
                    value={analysis.match?.experienceScore || 0}
                    accent="bg-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(analysis.match?.matchedSkills || []).slice(0, 10).map((skill) => (
                <SkillChip key={`matched-${skill}`} value={skill} tone="emerald" />
              ))}
            </div>
          </Section>

          <Section
            title="Resume quality evidence"
            subtitle={quality.summary}
            icon={Sparkles}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm text-slate-400">Action verb strength</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {quality.categoryScores?.actionVerbScore || 0}%
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm text-slate-400">Measurable impact</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {quality.categoryScores?.measurableImpactScore || 0}%
                </div>
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm text-slate-400">Clarity and specificity</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {quality.categoryScores?.clarityScore || 0}%
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="mb-3 text-sm font-medium text-slate-200">Strengths</div>
                <div className="space-y-3">
                  {(quality.strengths || []).map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                  {!quality.strengths?.length && (
                    <div className="text-sm text-slate-500">No standout strengths were detected yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="mb-3 text-sm font-medium text-slate-200">Improvement areas</div>
                <div className="space-y-3">
                  {(quality.improvementAreas || []).map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                  {!quality.improvementAreas?.length && (
                    <div className="text-sm text-slate-500">No urgent resume-quality issues were detected.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="text-sm font-medium text-slate-200">Priority statement feedback</div>
              {weakStatements.length ? (
                weakStatements.map((statement, index) => (
                  <div
                    key={`${statement.text}-${index}`}
                    className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
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
                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5 text-sm text-slate-400">
                  No weak statements were flagged in the current resume extract.
                </div>
              )}
            </div>
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Section
            title="Market evidence"
            subtitle="Each graph is tied to the candidate's missing-skill and role-fit story."
            icon={BarChart3}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 text-sm font-medium text-slate-200">Missing-skill demand</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={marketEvidence.missingSkillDemand || []}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="skill" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar dataKey="demand" radius={[6, 6, 0, 0]}>
                      {(marketEvidence.missingSkillDemand || []).map((item, index) => (
                        <Cell key={item.skill} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-slate-200">Demand by experience band</div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={marketEvidence.missingSkillTrend || []}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="yoeRange" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="demand"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      dot={{ fill: "#38bdf8", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 text-sm font-medium text-slate-200">Related skill cluster</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={marketEvidence.relatedSkills || []}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="skill" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-slate-200">Top role matches</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={marketEvidence.topRoleMatches || []}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="title" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: "#94a3b8" }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar dataKey="finalScore" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>

          <Section
            title="Dataset validation and methodology"
            subtitle="Research-facing evidence for data quality and scoring logic."
            icon={ShieldCheck}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm font-medium text-slate-200">Dataset validation</div>
                <div className="mt-4 space-y-3 text-sm text-slate-400">
                  <div className="flex items-center justify-between gap-4">
                    <span>Retained row rate</span>
                    <span className="font-medium text-white">
                      {Math.round((validationSummary.retainedRowRate || 0) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Dropped rows</span>
                    <span className="font-medium text-white">{validationSummary.droppedRowCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Duplicate rows removed</span>
                    <span className="font-medium text-white">
                      {validationSummary.duplicateRowsRemoved || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Invalid YOE rows</span>
                    <span className="font-medium text-white">{validationSummary.invalidYoeRows || 0}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm font-medium text-slate-200">Methodology</div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <p>{report?.methodology?.matching}</p>
                  <p>{report?.methodology?.resumeQuality}</p>
                  <p>{report?.methodology?.datasetValidation}</p>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Section
            title="Top job recommendations"
            subtitle="Explainable benchmark roles ranked for this resume."
            icon={Briefcase}
          >
            <div className="space-y-4">
              {(report?.jobs || []).map((job) => (
                <div
                  key={job.jobId || job.title}
                  className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white">{job.title}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {job.company || "Curated source"} | {job.location || "Location not provided"}
                      </div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-sm font-medium ${scoreTone(job.finalScore).badge}`}>
                      {job.finalScore}% fit
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <ScoreBar label="Skill coverage" value={job.skillCoverageScore || 0} accent="bg-sky-500" />
                    <ScoreBar label="Semantic similarity" value={job.semanticScore || 0} accent="bg-emerald-500" />
                    <ScoreBar label="Experience alignment" value={job.experienceScore || 0} accent="bg-amber-500" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(job.matchedSkills || []).slice(0, 6).map((skill) => (
                      <SkillChip key={`${job.title}-${skill}`} value={skill} tone="emerald" />
                    ))}
                    {(job.missingSkills || []).slice(0, 4).map((skill) => (
                      <SkillChip key={`${job.title}-missing-${skill}`} value={`Need ${skill}`} tone="rose" />
                    ))}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    {(job.explanation || []).map((reason, index) => (
                      <div key={`${job.title}-reason-${index}`} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-sky-300" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!report?.jobs?.length && (
                <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5 text-sm text-slate-400">
                  No benchmark job recommendations were available for this report.
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Learning roadmap"
            subtitle="The recommendations are tied directly to the missing-skill analysis."
            icon={Target}
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="text-sm text-slate-400">Estimated timeline</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {recommendations.timelineWeeks || "0"} weeks
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="mb-3 text-sm font-medium text-slate-200">Courses</div>
                <div className="space-y-3">
                  {(recommendations.courses || []).slice(0, 4).map((course, index) => (
                    <div key={`${course.title || course.skill}-${index}`} className="text-sm text-slate-300">
                      <div className="font-medium text-white">{course.title || course.skill}</div>
                      <div className="mt-1 text-slate-400">
                        {course.platform || "Platform not specified"} | {course.duration || "Flexible duration"}
                      </div>
                    </div>
                  ))}
                  {!recommendations.courses?.length && (
                    <div className="text-sm text-slate-500">No course recommendations were generated.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-5">
                <div className="mb-3 text-sm font-medium text-slate-200">Practice projects</div>
                <div className="space-y-3">
                  {(recommendations.projects || []).slice(0, 4).map((project, index) => (
                    <div key={`${project.title}-${index}`} className="text-sm text-slate-300">
                      <div className="font-medium text-white">{project.title}</div>
                      <div className="mt-1 text-slate-400">{project.description}</div>
                    </div>
                  ))}
                  {!recommendations.projects?.length && (
                    <div className="text-sm text-slate-500">No practice projects were generated.</div>
                  )}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
