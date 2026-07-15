// models/SkillData.js

import mongoose from "mongoose";

const SkillDataSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      index: true,
    },
    title: {
      type: String,
      index: true
    },
    normalizedTitle: {
      type: String,
      index: true
    },
    skill: {
      type: String,
      required: true,
      index: true
    },
    yoeMin: {
      type: Number,
      required: true,
      index: true
    },
    yoeMax: {
      type: Number,
      default: null
    },
    yoeMid: {
      type: Number,
      required: true,
      index: true
    },
    yoeLabel: {
      type: String,
      required: true,
      index: true
    },
    source: {
      type: String,
      default: "Curated internal job-role benchmark"
    },
    datasetVersion: {
      type: String,
      index: true
    }
  },
  {
    collection: "skill_facts",
    timestamps: true
  }
);

export default mongoose.model("SkillData", SkillDataSchema);
