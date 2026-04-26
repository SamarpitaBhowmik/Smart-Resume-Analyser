import express from "express";

import Resume from "../models/Resume.js";
import SkillsData from "../models/SkillsData.js";
import { buildGlobalMarketInsights, buildUserMarketInsights } from "../utils/marketInsights.js";

const router = express.Router();

router.get("/global-insights", async (req, res) => {
  try {
    const { focusSkill } = req.query;
    const insights = await buildGlobalMarketInsights(
      typeof focusSkill === "string" && focusSkill.trim() ? focusSkill.trim() : null
    );

    res.json({
      success: true,
      insights,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 500 ? "Failed to generate global market insights" : error.message,
      details: statusCode === 500 ? error.message : undefined,
    });
  }
});

router.get("/user-insights", async (req, res) => {
  try {
    const { resumeId, focusSkill } = req.query;
    if (!resumeId) {
      return res.status(400).json({ error: "Resume ID is required" });
    }

    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const insights = await buildUserMarketInsights(
      resume,
      typeof focusSkill === "string" && focusSkill.trim() ? focusSkill.trim() : null
    );

    res.json({
      success: true,
      insights,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 500 ? "Failed to generate market insights" : error.message,
      details: statusCode === 500 ? error.message : undefined,
    });
  }
});

router.get("/top-skills", async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const data = await SkillsData.aggregate([
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/skills-by-yoe", async (req, res) => {
  try {
    const data = await SkillsData.aggregate([
      {
        $group: {
          _id: {
            skill: "$skill",
            yoeLabel: "$yoeLabel",
            yoeMin: "$yoeMin",
            yoeMax: "$yoeMax",
          },
          value: { $sum: 1 },
        },
      },
      { $sort: { "_id.yoeMin": 1, value: -1 } },
      {
        $project: {
          _id: 0,
          skill: "$_id.skill",
          yoeRange: "$_id.yoeLabel",
          yoeMin: "$_id.yoeMin",
          yoeMax: "$_id.yoeMax",
          value: 1,
        },
      },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/skills-by-title/:title", async (req, res) => {
  try {
    const title = req.params.title;
    const data = await SkillsData.aggregate([
      { $match: { title: new RegExp(title, "i") } },
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/job-titles", async (req, res) => {
  try {
    const data = await SkillsData.aggregate([
      { $group: { _id: "$title", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/yoe-distribution", async (req, res) => {
  try {
    const data = await SkillsData.aggregate([
      {
        $group: {
          _id: {
            yoeLabel: "$yoeLabel",
            yoeMin: "$yoeMin",
            yoeMax: "$yoeMax",
          },
          count: { $sum: 1 },
          uniqueSkills: { $addToSet: "$skill" },
        },
      },
      {
        $project: {
          _id: 0,
          yoeRange: "$_id.yoeLabel",
          yoeMin: "$_id.yoeMin",
          yoeMax: "$_id.yoeMax",
          count: 1,
          uniqueSkillsCount: { $size: "$uniqueSkills" },
        },
      },
      { $sort: { yoeMin: 1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/top-skills-by-yoe", async (req, res) => {
  try {
    const requestedYoe = Number.parseInt(req.query.yoe, 10);
    if (Number.isNaN(requestedYoe)) {
      return res.status(400).json({ error: "Invalid YOE parameter" });
    }

    const data = await SkillsData.aggregate([
      {
        $match: {
          yoeMin: { $lte: requestedYoe },
          $or: [{ yoeMax: null }, { yoeMax: { $gte: requestedYoe } }],
        },
      },
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/market-trends", async (req, res) => {
  try {
    const skill = req.query.skill;
    if (!skill) {
      return res.status(400).json({ error: "Skill parameter is required" });
    }

    const data = await SkillsData.aggregate([
      { $match: { skill: new RegExp(String(skill).toLowerCase(), "i") } },
      {
        $group: {
          _id: {
            yoeLabel: "$yoeLabel",
            yoeMin: "$yoeMin",
            yoeMax: "$yoeMax",
          },
          count: { $sum: 1 },
          titles: { $addToSet: "$normalizedTitle" },
        },
      },
      {
        $project: {
          _id: 0,
          yoeRange: "$_id.yoeLabel",
          yoeMin: "$_id.yoeMin",
          yoeMax: "$_id.yoeMax",
          demand: "$count",
          jobTitles: { $size: "$titles" },
        },
      },
      { $sort: { yoeMin: 1 } },
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/dashboard-stats", async (req, res) => {
  try {
    const [totalRecords, uniqueSkills, uniqueTitles, topSkills, yoeDistribution, topTitles] =
      await Promise.all([
        SkillsData.countDocuments(),
        SkillsData.distinct("skill").then((skills) => skills.length),
        SkillsData.distinct("title").then((titles) => titles.length),
        SkillsData.aggregate([
          { $group: { _id: "$skill", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        SkillsData.aggregate([
          {
            $group: {
              _id: {
                yoeLabel: "$yoeLabel",
                yoeMin: "$yoeMin",
              },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              yoeRange: "$_id.yoeLabel",
              yoeMin: "$_id.yoeMin",
              count: 1,
            },
          },
          { $sort: { yoeMin: 1 } },
        ]),
        SkillsData.aggregate([
          { $group: { _id: "$title", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    res.json({
      totalRecords,
      uniqueSkills,
      uniqueTitles,
      topSkills,
      yoeDistribution,
      topTitles,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/skill-correlation", async (req, res) => {
  try {
    const skill = req.query.skill;
    if (!skill) {
      return res.status(400).json({ error: "Skill parameter is required" });
    }

    const jobIdsWithSkill = await SkillsData.distinct("jobId", {
      skill: new RegExp(String(skill).toLowerCase(), "i"),
    });

    const correlatedSkills = await SkillsData.aggregate([
      { $match: { jobId: { $in: jobIdsWithSkill } } },
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.json(correlatedSkills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
