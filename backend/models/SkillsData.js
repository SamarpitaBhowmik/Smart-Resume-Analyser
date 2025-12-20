// models/SkillData.js

import mongoose from "mongoose";

const SkillDataSchema = new mongoose.Schema(
  {
     title: {
      type: String,      // job role
      index: true
    },
    skill: {
      type: String,
      required: true,
      index: true
    },
    yoe: {
      type: Number,
      required: true,
      index: true
    }
  },
  {
    collection: "skill_data",
    timestamps: true
  }
);

export default mongoose.model("SkillData", SkillDataSchema);
