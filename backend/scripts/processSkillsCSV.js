import fs from "fs";
import csv from "csv-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import SkillData from "../models/SkillsData.js";
import { normalizeSkills } from "../utils/normaliseSkills.js";

dotenv.config();

// 1️⃣ Connect to MongoDB
await mongoose.connect(process.env.MONGO_URI, {
  dbName: "resume-analyser",
});

console.log("MongoDB connected for CSV ingestion");

// 2️⃣ Read CSV
const bulkOps = [];

fs.createReadStream("data/jobs.csv")
  .pipe(csv())
.on("data", (row) => {
  const title = row.Title?.trim();
  const yoe = parseFloat(row.YOE);     // safer than Number()
  const skills = normalizeSkills(row.Skills);

  // ❗ Skip bad rows
  if (!title || !skills.length || isNaN(yoe)) return;

  skills.forEach((skill) => {
    bulkOps.push({
      insertOne: {
        document: {
          title,
          skill,
          yoe,
        },
      },
    });
  });
})

  .on("end", async () => {
    if (bulkOps.length > 0) {
      await SkillData.bulkWrite(bulkOps);
    }
    console.log("✅ jobs.csv ingested into skills_data collection");
    mongoose.disconnect();
  });
