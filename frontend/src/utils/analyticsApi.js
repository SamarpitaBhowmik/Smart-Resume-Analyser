const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "http://localhost:5000/api");

async function apiCall(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      throw new Error(
        typeof data === "object" && data !== null
          ? data.error || `HTTP error! status: ${response.status}`
          : data || `HTTP error! status: ${response.status}`
      );
    }
    return data;
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
}

export async function getUserMarketInsights(resumeId, focusSkill = null) {
  const params = new URLSearchParams();
  params.set("resumeId", resumeId);
  if (focusSkill) params.set("focusSkill", focusSkill);
  return apiCall(`/analytics/user-insights?${params.toString()}`);
}

export async function getGlobalMarketInsights(focusSkill = null) {
  const params = new URLSearchParams();
  if (focusSkill) params.set("focusSkill", focusSkill);
  return apiCall(`/analytics/global-insights${params.toString() ? `?${params.toString()}` : ""}`);
}

// Get top skills
export async function getTopSkills(limit = 20) {
  return apiCall(`/analytics/top-skills?limit=${limit}`);
}

// Get skills by YOE (for heatmap)
export async function getSkillsByYOE() {
  return apiCall("/analytics/skills-by-yoe");
}

// Get skills by job title
export async function getSkillsByTitle(title) {
  return apiCall(`/analytics/skills-by-title/${encodeURIComponent(title)}`);
}

// Get all job titles
export async function getJobTitles() {
  return apiCall("/analytics/job-titles");
}

// Get YOE distribution
export async function getYOEDistribution() {
  return apiCall("/analytics/yoe-distribution");
}

// Get top skills by YOE
export async function getTopSkillsByYOE(yoe) {
  return apiCall(`/analytics/top-skills-by-yoe?yoe=${yoe}`);
}

// Get market trends for a skill
export async function getMarketTrends(skill) {
  return apiCall(`/analytics/market-trends?skill=${encodeURIComponent(skill)}`);
}

// Get dashboard stats
export async function getDashboardStats() {
  return apiCall("/analytics/dashboard-stats");
}

// Get skill correlation
export async function getSkillCorrelation(skill) {
  return apiCall(`/analytics/skill-correlation?skill=${encodeURIComponent(skill)}`);
}

// Get validation summary
export async function getValidationSummary() {
  return apiCall("/data/validation-summary");
}

