import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  data: Buffer, 
  extracted: {
    name: String,
    skills: [String],
    experience: [mongoose.Schema.Types.Mixed], // Can be strings or objects
    projects: [mongoose.Schema.Types.Mixed], // Can be strings or objects
    education: [mongoose.Schema.Types.Mixed], // Can be strings or objects
    text: String,
    email: String,
    phone: String,
  },
  uploadedAt: { type: Date, default: Date.now },
}, { strict: false }); // Allow additional fields

export default mongoose.model("Resume", resumeSchema);
