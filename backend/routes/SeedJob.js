import mongoose from "mongoose";
import dotenv from "dotenv";
import Job from "../models/jobs.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "resume-analyser",
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ Mongo error:", err.message);
    process.exit(1);
  }
};
connectDB();
// Sample jobs
const jobs = [
  {
    title: "Frontend Developer",
    company: "Google",
    location: "Bangalore, India",
    description: "Work on scalable UI with React, optimize performance, and ensure great UX.",
    skills: ["React", "JavaScript", "HTML", "CSS"],
  },
  {
    title: "Backend Engineer",
    company: "Amazon",
    location: "Hyderabad, India",
    description: "Develop APIs with Node.js, design scalable systems, and work with AWS services.",
    skills: ["Node.js", "Express", "MongoDB", "AWS"],
  },
  {
    title: "Full Stack Developer",
    company: "Microsoft",
    location: "Remote",
    description: "Build and maintain full stack apps using MERN stack, collaborate with cross-functional teams.",
    skills: ["React", "Node.js", "MongoDB", "Express"],
  },
];

// Insert data
const importJobs = async () => {
  try {
    await connectDB();
    await Job.deleteMany(); // clear existing jobs (optional)
    await Job.insertMany(jobs);
    console.log("✅ Jobs added to database!");
    process.exit(); // exit script
  } catch (err) {
    console.error("❌ Error seeding jobs:", err.message);
    process.exit(1);
  }
};

importJobs();
