import {
  Sparkles,
  Search,
  Target,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  Network,
  Database,
  Fingerprint
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage({ onNavigateToDashboard }) {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [activeNode, setActiveNode] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Smooth scroll tracking
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Network animation cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveNode((prev) => (prev + 1) % 5);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const parallaxOffset = scrollY * 0.4;

  const navigateAction = (path) => {
    if (path === '/dashboard' && onNavigateToDashboard) {
      onNavigateToDashboard();
    }
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white overflow-x-hidden font-sans selection:bg-brand-DEFAULT selection:text-dark-950">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-dark-800 via-dark-950 to-dark-950 opacity-80"></div>
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-brand-dark/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-accent/10 blur-[100px] rounded-full pointer-events-none"></div>
      </div>

      <div className="relative z-10">
        {/* Navbar */}
        <header
          className={`fixed top-0 w-full z-50 transition-all duration-700 ${
            scrollY > 20
              ? "bg-dark-950/70 backdrop-blur-xl border-b border-white/5 py-4"
              : "bg-transparent py-6"
          }`}
        >
          <div className="flex justify-between items-center px-8 md:px-16 max-w-[1400px] mx-auto">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-light to-brand-dark flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-dark-950" />
              </div>
              <h1 className="text-xl font-semibold tracking-wide text-white">
                CareerAlign
              </h1>
            </div>

            <nav className="hidden md:flex space-x-12 text-sm font-medium tracking-wide text-slate-300">
              <a href="#intelligence" className="hover:text-brand-light transition-colors">Intelligence</a>
              <a href="#benchmark" className="hover:text-brand-light transition-colors">Benchmarks</a>
              <a href="#pathways" className="hover:text-brand-light transition-colors">Pathways</a>
              <button onClick={() => navigateAction("/recruiter-assessment")} className="hover:text-brand-light transition-colors">Recruiters</button>
            </nav>

            <div className="hidden md:flex items-center space-x-6">
              <button className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Sign In
              </button>
              <button 
                onClick={() => navigateAction("/dashboard")}
                className="group relative px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all duration-300 flex items-center"
              >
                <span className="text-sm font-medium text-white tracking-wide">Initialize</span>
                <ArrowRight className="w-4 h-4 ml-2 text-brand-light group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden z-50 relative w-8 h-8 focus:outline-none"
              onClick={() => setMobileMenuOpen((s) => !s)}
            >
              <div className={`absolute w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? "rotate-45 translate-y-0" : "-translate-y-2"}`}></div>
              <div className={`absolute w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : "opacity-100"}`}></div>
              <div className={`absolute w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? "-rotate-45 translate-y-0" : "translate-y-2"}`}></div>
            </button>
          </div>
        </header>

        {/* HERO */}
        <section className="relative pt-40 pb-32 px-8 md:px-16 max-w-[1400px] mx-auto min-h-[90vh] flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 w-full items-center">
            
            {/* Left Content */}
            <div 
              className="lg:col-span-7 z-20 space-y-10"
              style={{ transform: `translateY(${parallaxOffset * 0.1}px)` }}
            >
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-brand-dark/30 bg-brand-dark/10 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-brand-light animate-pulse"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-light">V2.0 Intelligence Engine Active</span>
              </div>

              <h2 className="text-6xl md:text-7xl font-semibold leading-[1.1] tracking-tight">
                Semantic <br />
                <span className="text-slate-400">Career Intelligence.</span>
              </h2>

              <p className="text-xl md:text-2xl text-slate-400 font-light max-w-2xl leading-relaxed">
                Beyond keyword matching. We analyze your structural capabilities against live market benchmarks to chart high-confidence career pathways.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 pt-4">
                <button
                  onClick={() => navigateAction("/dashboard")}
                  className="group relative overflow-hidden rounded-full bg-white text-dark-950 px-8 py-4 font-semibold tracking-wide transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    Deploy AI Analysis
                    <Search className="w-4 h-4 ml-2" />
                  </span>
                </button>

                <button
                  onClick={() => navigateAction("/resume-recommendations")}
                  className="group relative rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-8 py-4 font-medium tracking-wide text-white transition-all backdrop-blur-md"
                >
                  <span className="flex items-center justify-center">
                    Explore Role Networks
                    <Network className="w-4 h-4 ml-2 text-slate-400 group-hover:text-white transition-colors" />
                  </span>
                </button>
              </div>
            </div>

            {/* Right Visual: Active Intelligence Engine */}
            <div className="lg:col-span-5 relative h-[500px] w-full hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/5 to-transparent rounded-full blur-[100px]"></div>
              
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Central Core */}
                <div className="absolute w-32 h-32 rounded-full border border-brand-light/30 bg-dark-900/50 backdrop-blur-xl flex items-center justify-center z-20 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
                  <Fingerprint className="w-12 h-12 text-brand-light opacity-80" />
                  <div className="absolute inset-0 rounded-full border-t border-brand-light animate-spin" style={{ animationDuration: '3s' }}></div>
                </div>

                {/* Orbital Nodes */}
                {[...Array(5)].map((_, i) => {
                  const angle = (i * 360) / 5;
                  const radius = 160;
                  const x = Math.cos((angle * Math.PI) / 180) * radius;
                  const y = Math.sin((angle * Math.PI) / 180) * radius;
                  const isActive = activeNode === i;

                  return (
                    <div key={i} className="absolute z-10 transition-all duration-1000" style={{ transform: `translate(${x}px, ${y}px)` }}>
                      {/* Connection Line to Center */}
                      <svg className="absolute w-64 h-64 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', top: '50%' }}>
                        <line x1="128" y1="128" x2={128 - x} y2={128 - y} stroke={isActive ? "rgba(56, 189, 248, 0.4)" : "rgba(255, 255, 255, 0.05)"} strokeWidth={isActive ? "2" : "1"} />
                      </svg>
                      
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-md transition-all duration-700 ${isActive ? 'bg-brand-dark/20 border-brand-light shadow-[0_0_20px_rgba(56,189,248,0.4)] scale-110' : 'bg-dark-800/50 border-white/10 scale-100'}`}>
                        {i === 0 && <Database className={`w-5 h-5 ${isActive ? 'text-brand-light' : 'text-slate-500'}`} />}
                        {i === 1 && <Target className={`w-5 h-5 ${isActive ? 'text-brand-light' : 'text-slate-500'}`} />}
                        {i === 2 && <TrendingUp className={`w-5 h-5 ${isActive ? 'text-brand-light' : 'text-slate-500'}`} />}
                        {i === 3 && <Network className={`w-5 h-5 ${isActive ? 'text-brand-light' : 'text-slate-500'}`} />}
                        {i === 4 && <Sparkles className={`w-5 h-5 ${isActive ? 'text-brand-light' : 'text-slate-500'}`} />}
                      </div>
                      
                      {isActive && (
                        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-dark-800/90 border border-white/10 text-[10px] px-2 py-1 rounded tracking-wider text-brand-light whitespace-nowrap backdrop-blur-md">
                          {['SEMANTIC_PARSE', 'BENCHMARK_SYNC', 'PATHWAY_CALC', 'MARKET_OVERLAY', 'CONFIDENCE_SCORE'][i]}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Background Radar Rings */}
                <div className="absolute w-[400px] h-[400px] rounded-full border border-white/5 border-dashed opacity-50 animate-spin-slow"></div>
                <div className="absolute w-[280px] h-[280px] rounded-full border border-white/5 opacity-30"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section: Editorial Layout */}
        <section id="intelligence" className="py-32 px-8 md:px-16 max-w-[1400px] mx-auto border-t border-white/5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center mb-32">
            <div className="space-y-8 order-2 lg:order-1">
              <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">Market Benchmark Awareness</h3>
              <p className="text-lg text-slate-400 font-light leading-relaxed">
                Our intelligence engine doesn't just parse text. It cross-references your structural capabilities against live market demand clusters, understanding the implicit value of your experience depth.
              </p>
              <ul className="space-y-4">
                {[
                  "Semantic skill constellation mapping",
                  "Experience depth verification",
                  "Market-weighted capability scoring"
                ].map((item, i) => (
                  <li key={i} className="flex items-center space-x-3 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-light"></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="order-1 lg:order-2 bg-dark-900 border border-white/5 rounded-2xl p-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20"><Network className="w-32 h-32 text-brand-light" /></div>
               <div className="space-y-4 relative z-10">
                 <div className="flex justify-between items-center text-xs text-slate-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">
                   <span>Processing Output</span>
                   <span>Confidence: 94.2%</span>
                 </div>
                 
                 <div className="space-y-3">
                   <div className="flex justify-between items-end">
                     <span className="text-sm text-white">Frontend Architecture</span>
                     <span className="text-xs text-brand-light">Tier 1 Fit</span>
                   </div>
                   <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-brand-light h-full w-[94%]"></div>
                   </div>
                 </div>

                 <div className="space-y-3">
                   <div className="flex justify-between items-end">
                     <span className="text-sm text-white">Platform Engineering</span>
                     <span className="text-xs text-slate-400">Emerging Match</span>
                   </div>
                   <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-brand-dark h-full w-[72%]"></div>
                   </div>
                 </div>
                 
                 <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-lg">
                   <p className="text-xs text-slate-300 leading-relaxed font-mono">
                     <span className="text-brand-light">AI Observation:</span> Profile aligns strongly with JS-centric pathways. Backend infrastructure evidence is limiting higher-confidence platform recommendations.
                   </p>
                 </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="bg-dark-900 border border-white/5 rounded-2xl p-8 h-full flex flex-col justify-center relative overflow-hidden">
               <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-accent/20 blur-[50px] rounded-full"></div>
               <div className="relative z-10 grid grid-cols-2 gap-4">
                 {['Frontend', 'Backend', 'DevOps', 'Data Science', 'Platform', 'QA'].map((cluster, i) => (
                   <div key={i} className={`p-4 border rounded-xl text-xs font-mono flex items-center justify-between ${i === 0 || i === 2 ? 'bg-brand-light/10 border-brand-light/30 text-white' : 'bg-dark-950 border-white/5 text-slate-500'}`}>
                     {cluster}
                     {(i === 0 || i === 2) && <Target className="w-3 h-3 text-brand-light" />}
                   </div>
                 ))}
               </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">Diversity-Aware Routing</h3>
              <p className="text-lg text-slate-400 font-light leading-relaxed">
                We eliminate redundancy. Instead of showing you five identical developer roles, our clustering logic surfaces strategic transitions and diverse opportunities based on transferable capabilities.
              </p>
              <button 
                onClick={() => navigateAction("/resume-recommendations")}
                className="text-sm font-medium text-white flex items-center hover:text-brand-light transition-colors"
              >
                Explore Pathways
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </section>

        {/* Recruiter Assessment CTA Section */}
        <section className="py-24 px-8 md:px-16 max-w-[1400px] mx-auto border-t border-white/5 bg-gradient-to-b from-transparent to-brand-dark/5">
          <div className="bg-dark-900/40 border border-brand-light/20 rounded-[2.5rem] p-12 md:p-20 relative overflow-hidden shadow-[0_0_50px_rgba(56,189,248,0.05)]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-light/5 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-72 h-72 bg-accent/5 blur-[80px] rounded-full pointer-events-none"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
              <div className="lg:col-span-8 space-y-6">
                <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-brand-light/20 bg-brand-light/10 text-brand-light">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">For Hiring Teams</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
                  Accelerate Candidate Screening with AI-Powered Benchmarking
                </h3>
                <p className="text-lg md:text-xl text-slate-400 font-light leading-relaxed max-w-3xl">
                  Upload job descriptions and batch process up to 10 resumes simultaneously. Rank candidates instantly based on target semantic fit and profile impact quality.
                </p>
              </div>
              <div className="lg:col-span-4 flex justify-start lg:justify-end">
                <button
                  onClick={() => navigateAction("/recruiter-assessment")}
                  className="group relative overflow-hidden rounded-full bg-gradient-to-r from-brand-light to-brand-DEFAULT text-dark-950 px-8 py-5 font-semibold tracking-wide transition-all hover:scale-[1.03] shadow-[0_0_40px_rgba(56,189,248,0.2)] hover:shadow-[0_0_60px_rgba(56,189,248,0.4)] flex items-center gap-2"
                >
                  Try Recruiter Assessment
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
