import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  data: Buffer, 
  extracted: {
    text: String,
    email: String,
    phone: String,
    skills: [String],
  },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Resume", resumeSchema);
