import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },         // e.g. "Frontend Developer"
  company: { type: String, required: true },       // e.g. "Google"
  location: { type: String, required: true },      // e.g. "Bangalore, India"
  description: { type: String, required: true },   // full job description
  skills: [String],                                // skills required
  postedAt: { type: Date, default: Date.now },     // when job was posted
});

export default mongoose.model("Job", jobSchema);
