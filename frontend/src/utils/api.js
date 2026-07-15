const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "http://localhost:5000/api");

export function getApiBaseUrl() {
  return API_BASE_URL;
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const msg =
        typeof data === "object" && data !== null
          ? data?.details
            ? `${data.error || "Request failed"}: ${data.details}`
            : data?.error || `HTTP error! status: ${response.status}`
          : data || `HTTP error! status: ${response.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
}

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append("resume", file);

  return apiCall("/resume/upload", {
    method: "POST",
    body: formData,
  });
}

export async function analyzeResumeAndJob(resumeId, jobDescription) {
  return apiCall("/analysis/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resumeId,
      jobDescription,
    }),
  });
}

export async function getResumeQuality(resumeId) {
  return apiCall("/analysis/resume-quality", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resumeId,
    }),
  });
}

export async function getJobSuggestions(resumeId, limit = 10) {
  return apiCall(`/analysis/job-suggestions?resumeId=${resumeId}&limit=${limit}`, {
    method: "GET",
  });
}

export async function getRoadmap(resumeId, focusSkill = null) {
  return apiCall("/analysis/roadmap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resumeId,
      focusSkill,
    }),
  });
}

export async function getResearchReport(resumeId) {
  const response = await apiCall(`/report/${resumeId}`, {
    method: "GET",
  });
  return response.report;
}

export function getResearchReportPdfUrl(resumeId) {
  return `${API_BASE_URL}/report/${resumeId}/pdf`;
}

export async function uploadRecruiterResume(file) {
  const formData = new FormData();
  formData.append("resume", file);

  return apiCall("/recruiter/upload", {
    method: "POST",
    body: formData,
  });
}

