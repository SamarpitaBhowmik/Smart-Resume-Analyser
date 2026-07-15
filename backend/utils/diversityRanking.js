export const ROLE_CLUSTERS = {
  FRONTEND: ["frontend", "ui", "ux", "react", "vue", "angular", "web developer", "javascript developer"],
  BACKEND: ["backend", "java developer", "python developer", "node", "ruby", "go developer", "php"],
  DATA: ["data engineer", "data scientist", "data analyst", "database", "sql"],
  CLOUD: ["cloud", "aws", "azure", "gcp"],
  AI_ML: ["machine learning", "ai", "artificial intelligence", "ml", "nlp", "computer vision", "deep learning"],
  DEVOPS: ["devops", "site reliability", "sre", "infrastructure", "release"],
  SYSTEMS: ["systems engineer", "embedded", "c++", "rust", "firmware"],
  PLATFORM: ["platform engineer", "core engineer"],
  QA: ["qa", "quality assurance", "test", "sdet", "automation engineer"],
  ANALYTICS: ["analytics", "bi", "business intelligence"],
  PRODUCT_ENGINEERING: ["product engineer", "full stack", "fullstack", "software engineer", "software developer"],
  INFRASTRUCTURE: ["infrastructure", "network", "security engineer", "cybersecurity"]
};

export function classifyRoleIntoCluster(title) {
  const normalizedTitle = title.toLowerCase();
  
  for (const [clusterName, keywords] of Object.entries(ROLE_CLUSTERS)) {
    if (keywords.some(kw => normalizedTitle.includes(kw))) {
      return clusterName;
    }
  }
  
  return "OTHER";
}

export function determineRecommendationTier(score) {
  if (score >= 85) return "Strong Match";
  if (score >= 70) return "Emerging Match";
  if (score >= 50) return "Strategic Transition";
  return "Exploratory Opportunity";
}

function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function calculateSkillOverlap(skillsA, skillsB) {
  if (!skillsA.length || !skillsB.length) return 0;
  const setA = new Set(skillsA.map(s => s.toLowerCase()));
  const setB = new Set(skillsB.map(s => s.toLowerCase()));
  let intersection = 0;
  setA.forEach(skill => {
    if (setB.has(skill)) intersection++;
  });
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function applyDiversitySuppression(scoredJobs, embeddingsMap) {
  const selectedJobs = [];
  const selectedClusters = new Map(); // Keep track of how many from each cluster

  // Sort jobs primarily by finalScore descending
  const sortedJobs = [...scoredJobs].sort((a, b) => b.finalScore - a.finalScore);

  for (const job of sortedJobs) {
    const cluster = classifyRoleIntoCluster(job.title);
    
    // Add cluster and tier information
    job.cluster = cluster;
    job.recommendationTier = determineRecommendationTier(job.finalScore);

    let isTooSimilar = false;

    // Compare with already selected jobs
    for (const selectedJob of selectedJobs) {
      // 1. Cluster Penalty: If we already have 2 jobs from this cluster, heavily penalize or skip
      const clusterCount = selectedClusters.get(cluster) || 0;
      if (clusterCount >= 2 && cluster !== "OTHER") {
        isTooSimilar = true;
        break;
      }

      // 2. Skill Overlap Penalty
      const skillOverlap = calculateSkillOverlap(job.skills || [], selectedJob.skills || []);
      if (skillOverlap > 0.8) {
        isTooSimilar = true;
        break;
      }

      // 3. Title Overlap Penalty
      const titleOverlap = calculateSkillOverlap(
        job.title.split(/\s+/), 
        selectedJob.title.split(/\s+/)
      );
      if (titleOverlap > 0.7) {
        isTooSimilar = true;
        break;
      }

      // 4. Embedding Similarity Suppression (if embeddings are available)
      if (embeddingsMap && embeddingsMap.has(job.jobId) && embeddingsMap.has(selectedJob.jobId)) {
        const similarity = calculateCosineSimilarity(
            embeddingsMap.get(job.jobId), 
            embeddingsMap.get(selectedJob.jobId)
        );
        if (similarity > 0.9) {
          isTooSimilar = true;
          break;
        }
      }
    }

    if (!isTooSimilar) {
      selectedJobs.push(job);
      selectedClusters.set(cluster, (selectedClusters.get(cluster) || 0) + 1);
    }

    // Stop if we have enough diverse recommendations (e.g., 10)
    if (selectedJobs.length >= 10) {
      break;
    }
  }

  // If we couldn't find enough diverse jobs, append some of the skipped ones
  if (selectedJobs.length < 10 && sortedJobs.length > selectedJobs.length) {
    for (const job of sortedJobs) {
      if (!selectedJobs.find(sj => sj.jobId === job.jobId)) {
        job.cluster = classifyRoleIntoCluster(job.title);
        job.recommendationTier = determineRecommendationTier(job.finalScore);
        selectedJobs.push(job);
        if (selectedJobs.length >= 10) break;
      }
    }
  }

  return selectedJobs;
}
