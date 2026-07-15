import React, { useRef, useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  SearchCheck,
  Target,
  Trash2,
  Upload,
  Network,
  Activity,
  ArrowRight,
  TrendingUp,
  BrainCircuit
} from "lucide-react";
import { getJobSuggestions, uploadResume } from "../utils/api";

const RECOMMENDATIONS_CACHE_PREFIX = "careeralign-recommendations:";

function calculateTransitionDifficulty(missingSkillsCount, currentFitScore) {
  if (currentFitScore >= 80 && missingSkillsCount <= 2) return { label: "Seamless", color: "text-emerald-400", bg: "bg-emerald-400/10" };
  if (currentFitScore >= 60 && missingSkillsCount <= 5) return { label: "Moderate", color: "text-amber-400", bg: "bg-amber-400/10" };
  return { label: "Challenging", color: "text-rose-400", bg: "bg-rose-400/10" };
}

export default function ResumeRecommendations({ resumeId, embedded = false, onToggleSection }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeExtract, setResumeExtract] = useState(null);

  const initialRecommendations = useMemo(() => {
    if (embedded && resumeId) {
      try {
        const cached = sessionStorage.getItem(`${RECOMMENDATIONS_CACHE_PREFIX}${resumeId}`);
        return cached ? JSON.parse(cached) : [];
      } catch { return []; }
    }
    return [];
  }, [resumeId, embedded]);

  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [loading, setLoading] = useState(embedded && resumeId && initialRecommendations.length === 0);
  const [error, setError] = useState(null);
  
  const [activeCluster, setActiveCluster] = useState(() => {
    if (initialRecommendations.length > 0) {
      return initialRecommendations[0].cluster || 'Emerging Pathways';
    }
    return null;
  });

  useEffect(() => {
    if (embedded && resumeId) {
      let cachedData = [];
      try {
        const cached = sessionStorage.getItem(`${RECOMMENDATIONS_CACHE_PREFIX}${resumeId}`);
        if (cached) cachedData = JSON.parse(cached);
      } catch (e) {}

      if (cachedData && cachedData.length > 0) {
        setRecommendations(cachedData);
        const firstCluster = cachedData[0].cluster || 'Emerging Pathways';
        setActiveCluster(firstCluster);
        setLoading(false);
        setError(null);
        return;
      }

      setRecommendations([]);
      setActiveCluster(null);
      setLoading(true);
      setError(null);

      let mounted = true;
      const fetchSuggestions = async () => {
        try {
          const suggestions = await getJobSuggestions(resumeId, 15);
          const jobs = suggestions.jobs || [];
          if (mounted) {
            setRecommendations(jobs);
            if (jobs.length > 0) {
              const firstCluster = jobs[0].cluster || 'Emerging Pathways';
              setActiveCluster(firstCluster);
              try {
                sessionStorage.setItem(`${RECOMMENDATIONS_CACHE_PREFIX}${resumeId}`, JSON.stringify(jobs));
              } catch (e) {}
            }
          }
        } catch (loadError) {
          if (mounted) {
            setError(loadError.message || "Failed to project career pathways.");
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };
      fetchSuggestions();
      return () => { mounted = false; };
    }
  }, [resumeId, embedded]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Intelligence Engine requires a PDF profile.");
      return;
    }
    setResumeFile(file);
    setResumeExtract(null);
    setRecommendations([]);
    setError(null);
    setActiveCluster(null);
  };

  const handleRemove = () => {
    setResumeFile(null);
    setResumeExtract(null);
    setRecommendations([]);
    setError(null);
    setActiveCluster(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRecommend = async () => {
    if (!resumeFile) {
      setError("Profile required to project pathways.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const uploadResponse = await uploadResume(resumeFile);
      setResumeExtract(uploadResponse.extracted || null);

      const suggestions = await getJobSuggestions(uploadResponse.id, 15);
      const jobs = suggestions.jobs || [];
      setRecommendations(jobs);
      
      // Set the first available cluster as active
      if (jobs.length > 0) {
        const firstCluster = jobs[0].cluster || 'Emerging Pathways';
        setActiveCluster(firstCluster);
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to project career pathways.");
    } finally {
      setLoading(false);
    }
  };

  // Group recommendations by cluster
  const clusters = useMemo(() => {
    const grouped = {};
    const recs = Array.isArray(recommendations) ? recommendations : [];
    recs.forEach(job => {
      if (!job) return;
      const clusterName = job.cluster || 'Emerging Pathways';
      if (!grouped[clusterName]) {
        grouped[clusterName] = { name: clusterName, jobs: [], avgFit: 0 };
      }
      grouped[clusterName].jobs.push(job);
    });

    Object.values(grouped).forEach(cluster => {
      if (!cluster || !Array.isArray(cluster.jobs) || cluster.jobs.length === 0) return;
      const totalScore = cluster.jobs.reduce((acc, job) => acc + (job?.finalScore || 0), 0);
      cluster.avgFit = Math.round(totalScore / cluster.jobs.length);
    });

    return Object.values(grouped).sort((a, b) => (b.avgFit || 0) - (a.avgFit || 0));
  }, [recommendations]);

  return (
    <div className={embedded ? "text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950" : "min-h-screen bg-dark-950 text-white font-sans selection:bg-brand-DEFAULT selection:text-dark-950"}>
      
      {/* Topbar */}
      {!embedded && (
        <header className="sticky top-0 z-50 border-b border-white/5 bg-dark-950/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate("/")} className="text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="h-4 w-[1px] bg-white/10"></div>
              <span className="font-medium tracking-wide text-sm">Semantic Career Pathways</span>
            </div>
            <div className="flex items-center space-x-3">
               <span className="px-3 py-1 bg-brand-light/10 text-brand-light border border-brand-light/20 rounded-full text-xs font-mono uppercase flex items-center">
                 <Network className="w-3 h-3 mr-2" /> Unsupervised Matching
               </span>
            </div>
          </div>
        </header>
      )}

      <main className={embedded ? "w-full py-4" : "max-w-[1400px] mx-auto px-6 py-12"}>
        
        {/* Embedded Loader and Error */}
        {embedded && loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand-light animate-spin mb-4" />
            <p className="text-sm font-mono text-brand-light tracking-widest uppercase animate-pulse">Computing Pathways...</p>
          </div>
        )}

        {embedded && error && (
          <div className="flex items-center justify-center p-6">
            <div className="bg-dark-900 border border-rose-500/30 p-8 rounded-2xl max-w-lg w-full text-center">
              <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Pathways Unavailable</h2>
              <p className="text-slate-400 mb-6">{error}</p>
            </div>
          </div>
        )}

        {/* Header Section */}
        {!embedded && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
          <div className="lg:col-span-7">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
              Projected <span className="text-slate-400">Career Trajectories</span>
            </h1>
            <p className="text-lg text-slate-400 font-light leading-relaxed max-w-2xl mb-8">
              Upload a profile to generate a diverse network of career pathways. The intelligence engine clusters roles semantically to reveal both obvious next steps and strategic pivots.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-dark-900 border border-white/5 rounded-xl">
                <Network className="w-5 h-5 text-brand-light mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Semantic Clusters</h3>
                <p className="text-xs text-slate-400">Groups related roles to prevent recommendation redundancy.</p>
              </div>
              <div className="p-4 bg-dark-900 border border-white/5 rounded-xl">
                <Activity className="w-5 h-5 text-emerald-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Transition Scoring</h3>
                <p className="text-xs text-slate-400">Calculates friction based on missing structural requirements.</p>
              </div>
              <div className="p-4 bg-dark-900 border border-white/5 rounded-xl">
                <BrainCircuit className="w-5 h-5 text-amber-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Unbiased Discovery</h3>
                <p className="text-xs text-slate-400">Analyzes pure capability without forcing a specific target role.</p>
              </div>
            </div>
          </div>

          {/* Upload Form */}
          <div className="lg:col-span-5 relative">
            <div className="bg-dark-900 border border-white/10 rounded-3xl p-8 relative z-10 h-full flex flex-col justify-center">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                 <h2 className="text-sm font-mono text-white uppercase tracking-wider">Input Artifact</h2>
                 {resumeFile ? (
                   <span className="text-xs font-mono px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">READY</span>
                 ) : (
                   <span className="text-xs font-mono px-2 py-1 bg-amber-500/10 text-amber-400 rounded">REQUIRED</span>
                 )}
              </div>

              <label className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-brand-light/50 hover:bg-brand-light/5 transition-all mb-6">
                {resumeFile ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText className="w-8 h-8 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-100">{resumeFile.name}</span>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleRemove(); }}
                      className="absolute top-4 right-4 p-1.5 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-brand-light" />
                    </div>
                    <span className="text-sm text-slate-400">Drag & drop or click to upload PDF</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              </label>

              {error && (
                <div className="flex items-center space-x-2 text-rose-400 bg-rose-400/10 px-4 py-3 rounded-xl border border-rose-400/20 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              <button 
                onClick={handleRecommend} 
                disabled={!resumeFile || loading}
                className="w-full group relative overflow-hidden rounded-2xl bg-white text-dark-950 py-4 font-semibold tracking-wide transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Computing Pathways...</>
                  ) : (
                    <>Project Pathways <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </span>
              </button>
            </div>
            
            {/* Background decoration */}
            <div className="absolute -inset-4 bg-brand-dark/10 blur-[50px] rounded-full z-0 pointer-events-none"></div>
          </div>
        </div>
        )}

        {/* Results Section */}
        {Array.isArray(clusters) && clusters.length > 0 && (
          <div className="border-t border-white/5 pt-12 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h2 className="text-2xl font-semibold flex items-center">
                <Network className="w-6 h-6 mr-3 text-brand-light" /> 
                Semantic Capability Clusters
              </h2>
              <button 
                onClick={() => embedded ? (onToggleSection && onToggleSection('analytics')) : navigate('/analytics')}
                className="flex items-center space-x-2 text-sm text-brand-light hover:text-brand-light/80 transition-colors bg-brand-light/10 px-4 py-2 rounded-lg border border-brand-light/20"
              >
                <Activity className="w-4 h-4" />
                <span>Explore Global Market Analytics</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Cluster Navigation */}
              <div className="lg:col-span-3 space-y-2">
                {clusters.map((cluster) => {
                  if (!cluster) return null;
                  return (
                    <button
                      key={cluster.name}
                      onClick={() => setActiveCluster(cluster.name)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 flex justify-between items-center ${activeCluster === cluster.name ? 'bg-dark-900 border-brand-light/30 shadow-[0_0_20px_rgba(56,189,248,0.1)]' : 'bg-transparent border-transparent hover:bg-dark-900 hover:border-white/5'}`}
                    >
                      <div>
                        <h4 className={`text-sm font-semibold ${activeCluster === cluster.name ? 'text-white' : 'text-slate-400'}`}>{cluster.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{Array.isArray(cluster.jobs) ? cluster.jobs.length : 0} Identified Roles</p>
                      </div>
                      {activeCluster === cluster.name && <ChevronRight className="w-4 h-4 text-brand-light" />}
                    </button>
                  );
                })}
              </div>

              {/* Active Cluster Details */}
              <div className="lg:col-span-9 space-y-6">
                 {clusters.filter(c => c && c.name === activeCluster).map(cluster => {
                   if (!cluster) return null;
                   return (
                     <div key={cluster.name} className="animate-fade-in">
                       <div className="flex items-center justify-between mb-6 p-6 bg-dark-900 border border-white/5 rounded-2xl">
                         <div>
                           <h3 className="text-xl font-semibold text-white">{cluster.name} Pathway</h3>
                           <p className="text-sm text-slate-400 mt-1">Average alignment: {cluster.avgFit || 0}%</p>
                         </div>
                         <div className="p-3 bg-brand-dark/10 rounded-full border border-brand-light/20">
                           <Target className="w-6 h-6 text-brand-light" />
                         </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {Array.isArray(cluster.jobs) && cluster.jobs.map((job, idx) => {
                           if (!job) return null;
                           const difficulty = calculateTransitionDifficulty(
                             Array.isArray(job.missingSkills) ? job.missingSkills.length : 0,
                             job.finalScore || 0
                           );
                           
                           return (
                             <div key={idx} className="bg-dark-950 border border-white/5 rounded-2xl p-6 hover:border-brand-light/30 transition-colors group">
                               <div className="flex justify-between items-start mb-4">
                                 <div>
                                   <h4 className="text-lg font-semibold text-white group-hover:text-brand-light transition-colors">{job.title}</h4>
                                   <p className="text-sm text-slate-500">{job.company || "Market Benchmark"}</p>
                                 </div>
                                 <div className="text-right">
                                   <div className="text-xl font-bold text-white">{job.finalScore || 0}%</div>
                                   <div className="text-[10px] text-slate-500 uppercase tracking-widest">Alignment</div>
                                 </div>
                               </div>

                               <div className="flex items-center space-x-2 mb-4 p-2 bg-dark-900 rounded border border-white/5">
                                 <TrendingUp className="w-4 h-4 text-slate-400" />
                                 <span className="text-xs text-slate-400 uppercase tracking-wider">Transition:</span>
                                 <span className={`text-xs font-mono px-2 py-0.5 rounded ${difficulty.bg} ${difficulty.color}`}>{difficulty.label}</span>
                               </div>

                               <p className="text-sm text-slate-300 leading-relaxed mb-4 line-clamp-2">
                                 {job.explanation?.[0] || 'Strong semantic alignment detected for this trajectory.'}
                               </p>

                               <div className="space-y-3">
                                 <div>
                                   <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Leveraging</div>
                                   <div className="flex flex-wrap gap-1">
                                     {Array.isArray(job.matchedSkills) && job.matchedSkills.slice(0, 4).map(skill => (
                                       <span key={skill} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">{skill}</span>
                                     ))}
                                   </div>
                                 </div>
                                 
                                 {(Array.isArray(job.missingSkills) && job.missingSkills.length > 0) && (
                                   <div>
                                     <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Gaps to Close</div>
                                     <div className="flex flex-wrap gap-1">
                                       {job.missingSkills.slice(0, 3).map(skill => (
                                         <span key={skill} className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded">{skill}</span>
                                       ))}
                                     </div>
                                   </div>
                                 )}
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   );
                 })}
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
