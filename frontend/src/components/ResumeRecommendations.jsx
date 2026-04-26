import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  FileText,
  Loader2,
  SearchCheck,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { getJobSuggestions, uploadResume } from "../utils/api";

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

function SectionCard({ title, subtitle, children, action }) {
  return (
    <section className="app-panel rounded-[28px] p-6">
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
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
      </div>
    </div>
  );
}

export default function ResumeRecommendations() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeExtract, setResumeExtract] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF resume.");
      return;
    }
    setResumeFile(file);
    setResumeExtract(null);
    setRecommendations([]);
    setError(null);
  };

  const handleRemove = () => {
    setResumeFile(null);
    setResumeExtract(null);
    setRecommendations([]);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRecommend = async () => {
    if (!resumeFile) {
      setError("Please upload a resume first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const uploadResponse = await uploadResume(resumeFile);
      setResumeExtract(uploadResponse.extracted || null);

      const suggestions = await getJobSuggestions(uploadResponse.id, 12);
      setRecommendations(suggestions.jobs || []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Failed to generate recommendations.");
    } finally {
      setLoading(false);
    }
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
                <div className="app-eyebrow">Resume-Based Recommendations</div>
                <h1 className="mt-1 text-2xl font-semibold text-white">Recommend jobs from resume only</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip value="No JD required" tone="blue" />
              <Chip value="Evidence-backed ranking" tone="emerald" />
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
          <section className="app-hero rounded-[32px] p-7 md:p-8">
            <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="app-eyebrow">Standalone Feature</div>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
                  Upload a resume and get benchmark-backed job recommendations without entering a job description.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                  This feature ranks benchmark roles using resume skills, experience fit, title-family relevance, and market-demand alignment. It is separate from the JD matching workflow on purpose.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="app-panel-soft rounded-[24px] p-5">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                      <FileText className="h-5 w-5 text-sky-300" />
                    </div>
                    <div className="text-sm font-semibold text-white">Resume evidence</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Recommendations start from extracted skills and experience in the uploaded resume.</p>
                  </div>
                  <div className="app-panel-soft rounded-[24px] p-5">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                      <Target className="h-5 w-5 text-sky-300" />
                    </div>
                    <div className="text-sm font-semibold text-white">Role-family fit</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Each suggested role is scored with both hybrid fit and recommendation-specific alignment signals.</p>
                  </div>
                  <div className="app-panel-soft rounded-[24px] p-5">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                      <Briefcase className="h-5 w-5 text-sky-300" />
                    </div>
                    <div className="text-sm font-semibold text-white">Clear confidence</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Each result includes confidence and explanation so the ranking is easier to trust and interpret.</p>
                  </div>
                </div>
              </div>

              <div className="app-panel rounded-[28px] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-white">Upload resume</div>
                    <div className="mt-1 text-sm text-slate-300">PDF only for the current build.</div>
                  </div>
                  {resumeFile ? <Chip value="Ready" tone="emerald" /> : <Chip value="Upload needed" tone="sky" />}
                </div>

                <div className="space-y-4">
                  <label className="block cursor-pointer rounded-[24px] border-2 border-dashed border-white/15 bg-white/5 p-5 transition hover:border-sky-400/35 hover:bg-white/8">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15">
                        <Upload className="h-5 w-5 text-sky-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">{resumeFile ? resumeFile.name : "Upload your PDF resume"}</div>
                        <div className="mt-1 text-sm text-slate-300">
                          {resumeFile ? "The recommendation engine will use this resume only." : "No job description is required on this page."}
                        </div>
                      </div>
                      {resumeFile ? (
                        <button type="button" onClick={(event) => { event.preventDefault(); handleRemove(); }} className="rounded-xl p-2 text-rose-300 transition hover:bg-rose-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                  </label>

                  {error ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <button onClick={handleRecommend} disabled={!resumeFile || loading} className="app-btn-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                    {loading ? "Generating recommendations..." : "Recommend jobs"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {resumeExtract ? (
            <SectionCard title="Resume snapshot" subtitle="This is the parsed evidence used to generate recommendations.">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="app-panel-soft rounded-[24px] p-4">
                  <div className="text-sm text-slate-300">Candidate</div>
                  <div className="mt-2 font-semibold text-white">{resumeExtract.name || "Not provided"}</div>
                </div>
                <div className="app-panel-soft rounded-[24px] p-4">
                  <div className="text-sm text-slate-300">Skills extracted</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{resumeExtract.skills?.length || 0}</div>
                </div>
                <div className="app-panel-soft rounded-[24px] p-4">
                  <div className="text-sm text-slate-300">Experience entries</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{resumeExtract.experience?.length || 0}</div>
                </div>
                <div className="app-panel-soft rounded-[24px] p-4">
                  <div className="text-sm text-slate-300">Recommended roles</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{recommendations.length}</div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Recommended roles" subtitle="These roles are ranked from the uploaded resume using hybrid fit, title-family alignment, demand alignment, and recommendation confidence.">
            <div className="space-y-4">
              {recommendations.length ? (
                recommendations.map((job) => (
                  <div key={job.jobId || job.title} className="app-panel-soft rounded-[24px] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-white">{job.title}</div>
                        <div className="mt-1 text-sm text-slate-300">{job.company || "Benchmark role"} | {job.location || "Location not provided"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Chip value={`${job.finalScore}% recommendation`} tone="sky" />
                        <Chip value={job.recommendationConfidence?.label || "Confidence unavailable"} tone={job.recommendationConfidence?.label === "High confidence" ? "emerald" : job.recommendationConfidence?.label === "Medium confidence" ? "amber" : "rose"} />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <ProgressRow label="Recommendation score" value={job.finalScore || 0} color="bg-sky-500" />
                        <ProgressRow label="Base hybrid score" value={job.baseHybridScore || 0} color="bg-cyan-500" />
                        <ProgressRow label="Title alignment" value={job.titleAlignmentScore || 0} color="bg-emerald-500" />
                        <ProgressRow label="Demand alignment" value={job.demandAlignmentScore || 0} color="bg-amber-500" />
                      </div>
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-white">Matched skills</div>
                        <div className="flex flex-wrap gap-2">
                          {(job.matchedSkills || []).slice(0, 8).map((skill) => <Chip key={`${job.title}-${skill}`} value={skill} tone="emerald" />)}
                        </div>
                        <div className="pt-2 text-sm font-semibold text-white">Missing skills</div>
                        <div className="flex flex-wrap gap-2">
                          {(job.missingSkills || []).slice(0, 6).map((skill) => <Chip key={`${job.title}-missing-${skill}`} value={skill} tone="rose" />)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                        <div className="font-semibold text-white">Coverage and maturity</div>
                        <div className="mt-3">Exact coverage: {job.exactSkillCoverageScore || 0}%</div>
                        <div className="mt-2">Skill maturity fit: {job.skillLevelFitScore || 0}%</div>
                        <div className="mt-2">Experience fit: {job.experienceScore || 0}%</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                        <div className="font-semibold text-white">Recommendation logic</div>
                        <div className="mt-3">{job.recommendationSignals?.titleAlignment?.explanation}</div>
                        <div className="mt-2">{job.recommendationSignals?.demandAlignment?.explanation}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                        <div className="font-semibold text-white">Why this role appears</div>
                        <div className="mt-3 space-y-2">
                          {(job.explanation || []).slice(0, 3).map((reason, index) => (
                            <div key={`${job.title}-reason-${index}`}>{reason}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="app-panel-soft rounded-[24px] p-5 text-sm text-slate-300">
                  Upload a resume and run the feature to see dedicated resume-based job recommendations here.
                </div>
              )}
            </div>
          </SectionCard>
        </main>
      </div>
    </div>
  );
}
