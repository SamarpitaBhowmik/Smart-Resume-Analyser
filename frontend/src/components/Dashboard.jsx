import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Upload, 
  Trash2, 
  ChevronLeft, 
  LogOut, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Briefcase,
  BookOpen,
  Target,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Zap,
  Award,
  BarChart3
} from "lucide-react";
import { uploadResume, analyzeResumeAndJob, getJobSuggestions } from "../utils/api.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [resumeFile, setResumeFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [resumeId, setResumeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [jobSuggestions, setJobSuggestions] = useState(null);
  const [activeTab, setActiveTab] = useState("analysis");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file");
        return;
      }
      setResumeFile(file);
      setError(null);
      setResumeId(null);
      setAnalysisResult(null);
      setJobSuggestions(null);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jobDesc.trim()) {
      setError("Please upload a resume and provide a job description");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setJobSuggestions(null);

    try {
      const uploadResponse = await uploadResume(resumeFile);
      const newResumeId = uploadResponse.id;
      setResumeId(newResumeId);

      const analysisResponse = await analyzeResumeAndJob(newResumeId, jobDesc);
      setAnalysisResult(analysisResponse);

      const jobsResponse = await getJobSuggestions(newResumeId, 10);
      setJobSuggestions(jobsResponse);

      setActiveTab("analysis");
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to analyze resume. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    setResumeId(null);
    setAnalysisResult(null);
    setJobSuggestions(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const matchPercentage = analysisResult?.match?.percentage || 0;
  const getMatchColor = () => {
    if (matchPercentage >= 80) return "from-emerald-500 to-green-500";
    if (matchPercentage >= 60) return "from-blue-500 to-indigo-500";
    if (matchPercentage >= 40) return "from-yellow-500 to-orange-500";
    return "from-red-500 to-pink-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-slate-900/20 pointer-events-none"></div>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)] pointer-events-none"></div>
      
      <div className="flex min-h-screen relative z-10">
        {/* SIDEBAR */}
        <aside className="w-72 bg-slate-800/80 backdrop-blur-xl border-r border-slate-700/50 p-6 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                  CA
                </div>
              </div>
              <div>
                <div className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  CAREERALIGN
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI resume tools
                </div>
              </div>
            </div>
            <button 
              onClick={() => navigate("/")} 
              className="text-slate-400 hover:text-white hover:bg-slate-700/50 p-2 rounded-lg transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            <button className="w-full text-left px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-600/30 to-purple-600/30 text-indigo-300 border border-indigo-500/30 shadow-lg hover:shadow-indigo-500/20 transition-all duration-200 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Resume Analyzer
            </button>
            <button
              onClick={() => navigate("/analytics")}
              className="w-full text-left px-4 py-3 rounded-lg bg-slate-700/30 text-slate-300 border border-slate-600/30 hover:bg-slate-700/50 hover:border-indigo-500/30 transition-all duration-200 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Market Analytics
            </button>
          </nav>

          <div className="mt-auto flex items-center gap-3 bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl border border-slate-600/50 hover:border-indigo-500/50 transition-all duration-200">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-lg">
                U
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-800"></div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">User</div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Free plan
              </div>
            </div>
            <LogOut className="w-4 h-4 text-slate-400 hover:text-white transition-colors cursor-pointer" />
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* INPUT */}
          <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 mb-6 shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Resume Analyzer
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Upload */}
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-indigo-500/50 transition-all duration-300 shadow-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-indigo-300">
                  <Upload className="w-4 h-4" />
                  Upload Resume (PDF)
                </h3>
                <label className="border-2 border-dashed border-slate-600 rounded-lg p-6 min-h-[120px] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors" />
                  <span className="text-sm text-slate-300 group-hover:text-indigo-300 font-medium">
                    Click or drag resume
                  </span>
                  <span className="text-xs text-slate-500 mt-1">PDF format only</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>

                {resumeFile && (
                  <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm text-emerald-400 font-medium truncate">{resumeFile.name}</span>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* JD */}
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-purple-500/50 transition-all duration-300 shadow-lg">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-purple-300">
                  <Briefcase className="w-4 h-4" />
                  Job Description
                </h3>
                <textarea
                  rows="8"
                  value={jobDesc}
                  onChange={(e) => {
                    setJobDesc(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-slate-100 placeholder-slate-500"
                  placeholder="Paste job description here..."
                />
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!resumeFile || !jobDesc.trim() || loading}
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-white shadow-lg hover:shadow-indigo-500/50 transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  Analyze Resume
                </>
              )}
            </button>
          </div>

          {/* RESULTS */}
          {analysisResult && (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-slate-700/50 bg-slate-800/40 backdrop-blur-sm rounded-t-lg p-1">
                <button
                  onClick={() => setActiveTab("analysis")}
                  className={`px-6 py-2.5 font-medium rounded-lg transition-all ${
                    activeTab === "analysis"
                      ? "text-white bg-indigo-600/30 border border-indigo-500/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
                  }`}
                >
                  Analysis Results
                </button>
                <button
                  onClick={() => setActiveTab("jobs")}
                  className={`px-6 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === "jobs"
                      ? "text-white bg-indigo-600/30 border border-indigo-500/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  Job Suggestions
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-medium">
                    {jobSuggestions?.jobs?.length || 0}
                  </span>
                </button>
              </div>

              {/* Analysis Tab */}
              {activeTab === "analysis" && (
                <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                  {/* Match Score */}
                  <div className="mb-8">
                    <div className="flex items-center gap-6 mb-4">
                      <div className={`text-5xl font-bold bg-gradient-to-br ${getMatchColor()} bg-clip-text text-transparent`}>
                        {matchPercentage}%
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold text-white mb-1">Match Score</h2>
                        <p className="text-sm text-slate-400">Resume compatibility with job description</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${getMatchColor()} transition-all duration-700`}
                        style={{ width: `${matchPercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Skills Section */}
                  <div className="space-y-6">
                    {/* Matched Skills */}
                    {analysisResult.match?.matchedSkills?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                          Matched Skills ({analysisResult.match.matchedSkills.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.match.matchedSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Skills */}
                    {analysisResult.match?.missingSkills?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
                          <XCircle className="w-5 h-5 text-red-400" />
                          Missing Skills ({analysisResult.match.missingSkills.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.match.missingSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 text-sm font-medium border border-red-500/30 hover:bg-red-500/30 transition-colors"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upskilling Plan */}
                    {analysisResult.upskillingPlan && Object.keys(analysisResult.upskillingPlan).length > 0 && (
                      <div className="mt-8 p-6 bg-slate-900/50 rounded-xl border border-slate-700/50">
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                          <BookOpen className="w-6 h-6 text-indigo-400" />
                          Personalized Learning Roadmap
                        </h3>

                        {analysisResult.upskillingPlan.timelineWeeks && (
                          <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                            <span className="text-sm text-slate-400">Estimated Timeline: </span>
                            <span className="text-lg font-semibold text-indigo-400">
                              {analysisResult.upskillingPlan.timelineWeeks} weeks
                            </span>
                          </div>
                        )}

                        {/* Courses */}
                        {analysisResult.upskillingPlan.courses?.length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-base font-semibold mb-3 text-slate-300">Recommended Courses</h4>
                            <div className="space-y-2">
                              {analysisResult.upskillingPlan.courses.map((course, idx) => (
                                <div
                                  key={idx}
                                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/70 transition-all"
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-white mb-1">
                                        {course.title || course.skill}
                                      </div>
                                      <div className="text-sm text-slate-400">
                                        {course.platform} {course.duration && `• ${course.duration}`}
                                      </div>
                                    </div>
                                    {course.priority && (
                                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                        course.priority === "High" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                        course.priority === "Medium" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                                        "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                      }`}>
                                        {course.priority}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Projects */}
                        {analysisResult.upskillingPlan.projects?.length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-base font-semibold mb-3 text-slate-300">Practice Projects</h4>
                            <div className="space-y-2">
                              {analysisResult.upskillingPlan.projects.map((project, idx) => (
                                <div
                                  key={idx}
                                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-purple-500/50 hover:bg-slate-800/70 transition-all"
                                >
                                  <div className="font-medium text-white mb-1">{project.title}</div>
                                  <div className="text-sm text-slate-400 mb-2">{project.description}</div>
                                  {project.skills && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {project.skills.map((skill, sIdx) => (
                                        <span
                                          key={sIdx}
                                          className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resources */}
                        {analysisResult.upskillingPlan.resources?.length > 0 && (
                          <div>
                            <h4 className="text-base font-semibold mb-3 text-slate-300">Additional Resources</h4>
                            <div className="space-y-2">
                              {analysisResult.upskillingPlan.resources.map((resource, idx) => (
                                <div
                                  key={idx}
                                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-green-500/50 hover:bg-slate-800/70 transition-all"
                                >
                                  <div className="font-medium text-white">{resource.title}</div>
                                  <div className="text-sm text-slate-400">
                                    {resource.type} {resource.skill && `• ${resource.skill}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Jobs Tab */}
              {activeTab === "jobs" && jobSuggestions && (
                <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                  <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2 text-white">
                    <Briefcase className="w-6 h-6 text-indigo-400" />
                    Recommended Job Opportunities
                  </h2>

                  {jobSuggestions.jobs?.length > 0 ? (
                    <div className="space-y-4">
                      {jobSuggestions.jobs.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-6 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-900/70 transition-all shadow-lg hover:shadow-indigo-500/10"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-1">
                                {item.job.title}
                              </h3>
                              <div className="text-sm text-slate-400 flex items-center gap-1">
                                <Briefcase className="w-4 h-4" />
                                {item.job.company} • {item.job.location}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                              <span className="text-lg font-semibold text-emerald-400">
                                {item.matchScore}%
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                            {item.job.description}
                          </p>

                          {item.job.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {item.job.skills.slice(0, 8).map((skill, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                              {item.job.skills.length > 8 && (
                                <span className="text-xs px-2.5 py-1 text-slate-500">
                                  +{item.job.skills.length - 8} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>No job suggestions found. Try uploading a resume with more skills.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
