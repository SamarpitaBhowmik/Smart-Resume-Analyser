import mongoose from "mongoose";
import dotenv from "dotenv";
import { ensureResearchDatasetsReady } from "../utils/datasetPipeline.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "resume-analyser",
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("Mongo error:", err.message);
    process.exit(1);
  }
};
connectDB();

// Insert data
const importJobs = async () => {
  try {
    await connectDB();
    const summary = await ensureResearchDatasetsReady({ forceRefresh: true });
    console.log("Research-grade job postings synced.");
    console.log(`Dataset version: ${summary.datasetVersion}`);
    console.log(`Job postings: ${summary.cleaned.jobPostingCount}`);
    console.log(`Skill facts: ${summary.cleaned.skillFactCount}`);
    process.exit(); 
  } catch (err) {
    console.error("Error seeding jobs:", err.message);
    process.exit(1);
  }
};

importJobs();
