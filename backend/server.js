import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import ResumeRoutes from "./routes/ResumeRoutes.js"
import jobRoutes from "./routes/jobRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { ensureResearchDatasetsReady } from "./utils/datasetPipeline.js";


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "resume-analyser", 
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Routes
app.get("/", (req, res) => {
  res.send("Backend running...");
});

app.use("/api/resume", ResumeRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/report", reportRoutes);


// Server
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  const validationSummary = await ensureResearchDatasetsReady();
  console.log(
    `Research dataset ready: ${validationSummary.cleaned.jobPostingCount} job postings, ${validationSummary.cleaned.skillFactCount} skill facts`
  );

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
