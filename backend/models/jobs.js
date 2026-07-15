import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, index: true },
  normalizedTitle: { type: String, required: true, index: true },
  company: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  experienceText: { type: String, default: "" },
  yoeMin: { type: Number, default: 0, index: true },
  yoeMax: { type: Number, default: null },
  yoeMid: { type: Number, default: 0, index: true },
  yoeLabel: { type: String, default: "Unknown", index: true },
  rawSkills: { type: String, default: "" },
  skills: [{ type: String }],
  source: { type: String, default: "Curated internal job-role benchmark" },
  sourceType: { type: String, default: "role-benchmark" },
  datasetVersion: { type: String, index: true },
  postedAt: { type: Date, default: Date.now },
}, {
  collection: "job_postings",
});

export default mongoose.model("Job", jobSchema);
