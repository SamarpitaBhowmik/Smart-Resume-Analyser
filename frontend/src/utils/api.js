// Use proxy in development, or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? "/api" : "http://localhost:5000/api");

// Helper function for API calls
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
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
}

// Upload resume
export async function uploadResume(file) {
  const formData = new FormData();
  formData.append("resume", file);

  return apiCall("/resume/upload", {
    method: "POST",
    body: formData,
  });
}

// Analyze resume against job description
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

// Get job suggestions based on resume
export async function getJobSuggestions(resumeId, limit = 10) {
  return apiCall(`/analysis/job-suggestions?resumeId=${resumeId}&limit=${limit}`, {
    method: "GET",
  });
}

