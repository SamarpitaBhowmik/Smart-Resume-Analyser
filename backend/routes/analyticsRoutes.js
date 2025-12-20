import express from "express";
import SkillsData from "../models/SkillsData.js";

const router = express.Router();

// Top skills overall
router.get("/top-skills", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
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

// Skills by YOE (heatmap-ready)
router.get("/skills-by-yoe", async (req, res) => {
  try {
    const data = await SkillsData.aggregate([
      {
        $group: {
          _id: { skill: "$skill", yoe: "$yoe" },
          value: { $sum: 1 },
        },
      },
      { $sort: { "_id.skill": 1, "_id.yoe": 1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Skills by Job Title
router.get("/skills-by-title/:title", async (req, res) => {
  try {
    const title = req.params.title;
    const data = await SkillsData.aggregate([
      { $match: { title } },
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all job titles
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

// Skills distribution by YOE
router.get("/yoe-distribution", async (req, res) => {
  try {
    const data = await SkillsData.aggregate([
      {
        $group: {
          _id: "$yoe",
          count: { $sum: 1 },
          uniqueSkills: { $addToSet: "$skill" },
        },
      },
      {
        $project: {
          yoe: "$_id",
          count: 1,
          uniqueSkillsCount: { $size: "$uniqueSkills" },
        },
      },
      { $sort: { yoe: 1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Top skills by YOE range
router.get("/top-skills-by-yoe", async (req, res) => {
  try {
    const yoe = parseFloat(req.query.yoe);
    if (isNaN(yoe)) {
      return res.status(400).json({ error: "Invalid YOE parameter" });
    }
    const data = await SkillsData.aggregate([
      { $match: { yoe } },
      { $group: { _id: "$skill", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Market trends - skills growth by YOE
router.get("/market-trends", async (req, res) => {
  try {
    const skill = req.query.skill;
    if (!skill) {
      return res.status(400).json({ error: "Skill parameter is required" });
    }
    const data = await SkillsData.aggregate([
      { $match: { skill: new RegExp(skill, "i") } },
      {
        $group: {
          _id: "$yoe",
          count: { $sum: 1 },
          titles: { $addToSet: "$title" },
        },
      },
      {
        $project: {
          yoe: "$_id",
          demand: "$count",
          jobTitles: { $size: "$titles" },
        },
      },
      { $sort: { yoe: 1 } },
    ]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive dashboard stats
router.get("/dashboard-stats", async (req, res) => {
  try {
    const [
      totalRecords,
      uniqueSkills,
      uniqueTitles,
      topSkills,
      yoeDistribution,
      topTitles,
    ] = await Promise.all([
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
            _id: "$yoe",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
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

// Skill correlation - which skills appear together
router.get("/skill-correlation", async (req, res) => {
  try {
    const skill = req.query.skill;
    if (!skill) {
      return res.status(400).json({ error: "Skill parameter is required" });
    }

    // Find all job titles that require this skill
    const titlesWithSkill = await SkillsData.distinct("title", {
      skill: new RegExp(skill, "i"),
    });

    // Find all skills in those job titles
    const correlatedSkills = await SkillsData.aggregate([
      { $match: { title: { $in: titlesWithSkill } } },
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
