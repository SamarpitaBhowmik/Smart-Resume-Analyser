import Resume from "../models/Resume.js";
import Job from "../models/jobs.js";

export const matchResumeToJob = async (req, res) => {
  try {
    const { resumeId, jobId } = req.body; // frontend will send these IDs

    // 1. Get resume and job from DB
    const resume = await Resume.findById(resumeId);
    const job = await Job.findById(jobId);

    if (!resume || !job) {
      return res.status(404).json({ error: "Resume or Job not found" });
    }

    // 2. Normalize skills (to lowercase, trim spaces)
    const resumeSkills = Array.isArray(resume.extracted?.skills)
      ? resume.extracted.skills.map((s) => s.toLowerCase().trim())
      : [];
    const jobSkills = job.skills.map((s) => s.toLowerCase().trim());

    // 3. Compare
    const matched = jobSkills.filter((skill) => resumeSkills.includes(skill));

    const missing = jobSkills.filter((skill) => !resumeSkills.includes(skill));

    const matchPercent =
      jobSkills.length > 0
        ? Math.round((matched.length / jobSkills.length) * 100)
        : 0;

    // 4. Send response
    res.json({
      match: matchPercent,
      matched,
      missing,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
};
