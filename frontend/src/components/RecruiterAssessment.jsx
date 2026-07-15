import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  FileText,
  Loader2,
  Upload,
  BrainCircuit,
  Trash2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Briefcase
} from "lucide-react";
import {
  uploadRecruiterResume,
  analyzeResumeAndJob
} from "../utils/api.js";

export default function RecruiterAssessment() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [jobDesc, setJobDesc] = useState("");
  const [resumes, setResumes] = useState([]); // Array of { id, file, name, status, error, targetFit, impactQuality }
  const [isAssessing, setIsAssessing] = useState(false);
  const [overallError, setOverallError] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Client-side file selection validation
  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    setOverallError(null);

    // Total resumes check (existing + new)
    if (resumes.length + selectedFiles.length > 10) {
      setOverallError("System limits screening to a maximum of 10 resumes per assessment.");
      return;
    }

    const newResumes = [];
    for (const file of selectedFiles) {
      const extension = file.name.split(".").pop().toLowerCase();
      if (extension !== "pdf" && extension !== "docx") {
        setOverallError(`File "${file.name}" is not supported. Please upload PDF or DOCX files.`);
        return;
      }

      newResumes.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        candidateName: "",
        status: "idle", // 'idle' | 'uploading' | 'parsing' | 'analyzing' | 'completed' | 'failed'
        error: null,
        targetFit: null,
        impactQuality: null
      });
    }

    setResumes((prev) => [...prev, ...newResumes]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveFile = (id) => {
    if (isAssessing) return;
    setResumes((prev) => prev.filter((r) => r.id !== id));
    setOverallError(null);
  };

  const resetAssessment = () => {
    setResumes([]);
    setJobDesc("");
    setOverallError(null);
    setShowResults(false);
    setIsAssessing(false);
  };

  const handleRunAssessment = async () => {
    if (!jobDesc.trim()) {
      setOverallError("Awaiting complete input payload: Job Description is required.");
      return;
    }
    if (resumes.length === 0) {
      setOverallError("Please upload at least one resume.");
      return;
    }

    setIsAssessing(true);
    setOverallError(null);
    setShowResults(false);

    // Run parallel parsing and analysis for each resume
    const assessmentPromises = resumes.map(async (resume, idx) => {
      // If already analyzed successfully, we can skip (or re-run, here we re-run to make sure it matches current JD)
      setResumes((prev) =>
        prev.map((r) => (r.id === resume.id ? { ...r, status: "uploading", error: null } : r))
      );

      try {
        // Step 1: Upload and parse resume
        const uploadRes = await uploadRecruiterResume(resume.file);
        
        setResumes((prev) =>
          prev.map((r) => (r.id === resume.id ? { ...r, status: "analyzing", candidateName: uploadRes.extracted?.name || r.name } : r))
        );

        // Step 2: Score against the pasted Job Description
        const analysisRes = await analyzeResumeAndJob(uploadRes.id, jobDesc);

        setResumes((prev) =>
          prev.map((r) =>
            r.id === resume.id
              ? {
                  ...r,
                  status: "completed",
                  targetFit: analysisRes.match?.percentage ?? 0,
                  impactQuality: analysisRes.resumeQuality?.overallScore ?? 0,
                  candidateName: analysisRes.resumeData?.name && analysisRes.resumeData?.name !== "Not provided" 
                    ? analysisRes.resumeData.name 
                    : uploadRes.extracted?.name || r.name
                }
              : r
          )
        );
      } catch (err) {
        console.error(`Error processing resume ${resume.name}:`, err);
        setResumes((prev) =>
          prev.map((r) =>
            r.id === resume.id ? { ...r, status: "failed", error: err.message || "Assessment failed" } : r
          )
        );
      }
    });

    await Promise.all(assessmentPromises);
    setIsAssessing(false);
    setShowResults(true);
  };

  // Sort completed resumes by Target Fit descending
  const rankedResumes = [...resumes]
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.targetFit || 0) - (a.targetFit || 0));

  const failedResumes = resumes.filter((r) => r.status === "failed");

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
              <span className="font-medium tracking-wide">Recruiter Assessment Center</span>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono text-slate-500">
            {showResults && (
              <button
                onClick={resetAssessment}
                className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white mr-4"
              >
                NEW ASSESSMENT
              </button>
            )}
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-brand-light mr-2 animate-pulse"></span>
              Recruiter Mode
            </span>
            <span>V2.0</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 relative">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-brand-dark/5 rounded-full blur-[120px]"></div>
        </div>

        <div className="max-w-[1200px] w-full mx-auto z-10 flex-1 flex flex-col justify-center">
          
          {!showResults && !isAssessing ? (
            // Pre-assessment Config State
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto">
              
              {/* Left Side Info / Explanations */}
              <div className="lg:col-span-5 space-y-8 flex flex-col justify-center">
                <div>
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-brand-light/20 bg-brand-light/10 text-brand-light mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Batch Screener</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-tight">
                    Calibrate <br /><span className="text-slate-400">Recruiter Screening</span>
                  </h1>
                  <p className="text-lg text-slate-400 font-light leading-relaxed max-w-md">
                    Upload up to 10 resumes (PDF/DOCX) alongside your Target Job Description. Receive candidate match and communication quality benchmarks instantly.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">Screening Guidelines</h3>
                  
                  <div className="p-4 bg-dark-900 border border-white/5 rounded-xl text-sm text-slate-400 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-light mt-1.5 flex-shrink-0"></div>
                      <span>Supports PDF and DOCX file types.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-light mt-1.5 flex-shrink-0"></div>
                      <span>Max limit of 10 resumes processed simultaneously.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-light mt-1.5 flex-shrink-0"></div>
                      <span>Matches resume structural capabilities to target requirements using the unified V2.0 scoring pipeline.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Input Forms */}
              <div className="lg:col-span-7">
                <div className="bg-dark-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col justify-center">
                  <div className="space-y-6">
                    
                    {/* Job Description Textbox */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-brand-light" />
                        1. Paste Job Description / Role Requirements
                      </label>
                      <textarea
                        rows="5"
                        value={jobDesc}
                        onChange={(e) => { setJobDesc(e.target.value); setOverallError(null); }}
                        className="w-full bg-dark-950 border border-white/10 rounded-2xl p-5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-light/50 focus:ring-1 focus:ring-brand-light/50 transition-all resize-none font-mono"
                        placeholder="Paste target job requirements and roles detail here..."
                      />
                    </div>

                    {/* Resumes Drag & Drop */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        2. Batch Upload Resumes (PDF/DOCX - Max 10)
                      </label>
                      <label className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-brand-light/50 hover:bg-brand-light/5 transition-all">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="p-3 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-brand-light" />
                          </div>
                          <span className="text-sm text-slate-400">Drag & drop or click to upload PDF/DOCX files</span>
                        </div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.docx"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>

                    {/* Selected Resumes List */}
                    {resumes.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
                          <span>UPLOADS ({resumes.length}/10)</span>
                          <button onClick={() => setResumes([])} className="hover:text-white transition-colors">REMOVE ALL</button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                          {resumes.map((resume) => (
                            <div key={resume.id} className="flex justify-between items-center p-3 bg-dark-950 border border-white/5 rounded-xl">
                              <div className="flex items-center space-x-3 truncate">
                                <FileText className="w-4 h-4 text-brand-light flex-shrink-0" />
                                <span className="text-xs text-slate-300 truncate font-mono">{resume.name}</span>
                              </div>
                              <button
                                onClick={() => handleRemoveFile(resume.id)}
                                className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overall Error Warning */}
                    {overallError && (
                      <div className="flex items-center space-x-2 text-rose-400 bg-rose-400/10 px-4 py-3 rounded-xl border border-rose-400/20">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{overallError}</span>
                      </div>
                    )}

                    <button
                      onClick={handleRunAssessment}
                      disabled={resumes.length === 0 || !jobDesc.trim()}
                      className="w-full group relative overflow-hidden rounded-2xl bg-white text-dark-950 py-4 font-semibold tracking-wide transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <span className="relative z-10 flex items-center justify-center">
                        Execute Assessment
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>

                  </div>
                </div>
              </div>

            </div>
          ) : isAssessing ? (
            // Processing Loader and Queue Status State
            <div className="max-w-xl w-full mx-auto bg-dark-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center">
              <div className="w-20 h-20 mx-auto mb-8 relative">
                <div className="absolute inset-0 rounded-full border-t-2 border-brand-light animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-b-2 border-accent animate-spin-slow"></div>
                <BrainCircuit className="w-8 h-8 text-brand-light absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              
              <h3 className="text-xl font-medium mb-2">Analyzing Candidate Profiles</h3>
              <p className="text-sm text-slate-400 mb-8 font-mono">
                Screening batch candidates against targets...
              </p>

              <div className="space-y-3 text-left">
                {resumes.map((resume) => (
                  <div key={resume.id} className="flex justify-between items-center p-3 bg-dark-950 border border-white/5 rounded-xl">
                    <div className="flex items-center space-x-3 truncate">
                      <FileText className="w-4 h-4 text-brand-light flex-shrink-0" />
                      <span className="text-xs text-slate-300 font-mono truncate">{resume.name}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {resume.status === "uploading" && (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-brand-light animate-spin" />
                          <span className="text-xs font-mono text-brand-light">Uploading...</span>
                        </>
                      )}
                      {resume.status === "analyzing" && (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                          <span className="text-xs font-mono text-accent">Analyzing...</span>
                        </>
                      )}
                      {resume.status === "completed" && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-mono text-emerald-400">Ready</span>
                        </>
                      )}
                      {resume.status === "failed" && (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-xs font-mono text-rose-400">Failed</span>
                        </>
                      )}
                      {resume.status === "idle" && (
                        <span className="text-xs font-mono text-slate-500">In queue</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Results Table State
            <div className="space-y-8 py-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
                    Assessment <span className="text-brand-light">Completed</span>
                  </h1>
                  <p className="text-slate-400">
                    Candidates ranked by semantic target fit.
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={resetAssessment}
                    className="bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-full border border-white/10 text-sm font-medium transition-colors"
                  >
                    Start New Screen
                  </button>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-dark-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-dark-950/40 text-xs font-mono uppercase tracking-widest text-slate-500">
                        <th className="py-4 px-6">Rank</th>
                        <th className="py-4 px-6">Name</th>
                        <th className="py-4 px-6 text-right">Target Fit</th>
                        <th className="py-4 px-6 text-right">Impact Quality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-sans">
                      {rankedResumes.map((resume, idx) => (
                        <tr key={resume.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-5 px-6 font-mono text-sm font-semibold text-brand-light">
                            {idx + 1}
                          </td>
                          <td className="py-5 px-6 font-medium text-white">
                            {resume.candidateName}
                          </td>
                          <td className="py-5 px-6 text-right font-mono font-bold text-brand-light text-lg">
                            {resume.targetFit}%
                          </td>
                          <td className="py-5 px-6 text-right font-mono font-semibold text-emerald-400 text-lg">
                            {resume.impactQuality}%
                          </td>
                        </tr>
                      ))}
                      {rankedResumes.length === 0 && (
                        <tr>
                          <td colSpan="4" className="py-12 text-center text-slate-500 font-light text-sm">
                            No candidates were successfully processed in this screen.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Failed items display (if any) */}
              {failedResumes.length > 0 && (
                <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3">
                  <h4 className="text-sm font-medium text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Failed uploads ({failedResumes.length})
                  </h4>
                  <ul className="list-disc pl-5 text-xs text-rose-300/80 font-mono space-y-1">
                    {failedResumes.map((resume) => (
                      <li key={resume.id}>
                        {resume.name}: {resume.error || "Unknown parsing error."}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
