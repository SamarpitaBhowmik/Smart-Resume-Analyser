function escapePdfText(text = "") {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(text = "", maxLength = 92) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxLength) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [""];
}

function paginate(lines = [], maxLinesPerPage = 48) {
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  return pages;
}

function createPdfObjects(pages) {
  const objects = [];
  const addObject = (body) => {
    const objectId = objects.length + 1;
    objects.push({ objectId, body });
    return objectId;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];
  const contentIds = [];
  const pagesRootIdPlaceholder = objects.length + 2;

  pages.forEach((pageLines) => {
    const contentStreamLines = ["BT", `/F${fontId} 10 Tf`, "40 760 Td"];
    pageLines.forEach((line, index) => {
      const safeLine = escapePdfText(line);
      if (index === 0) contentStreamLines.push(`(${safeLine}) Tj`);
      else contentStreamLines.push(`T* (${safeLine}) Tj`);
    });
    contentStreamLines.push("ET");
    const stream = contentStreamLines.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesRootIdPlaceholder} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F${fontId} ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  const pagesRootId = addObject(
    `<< /Type /Pages /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);

  return { objects, catalogId };
}

export function buildPdfFromReport(report) {
  const lines = [
    "CareerAlign Report",
    "",
    `Generated: ${report.metadata.generatedAt}`,
    `Algorithm version: ${report.metadata.algorithmVersion}`,
    `Dataset version: ${report.metadata.datasetVersion}`,
    "",
    "Summary",
    `Job fit score: ${report.summary.jobFitScore}`,
    `Resume quality score: ${report.summary.resumeQualityScore}`,
    `Best-fit role: ${report.summary.bestFitRole || "Not available"}`,
    `Highest-impact missing skill: ${report.summary.highestImpactMissingSkill || "Not available"}`,
    "",
    "Resume Quality",
    report.resumeQuality.summary,
    ...report.resumeQuality.improvementAreas.map((item) => `- ${item}`),
    "",
    "Top Recommended Roles",
    ...report.jobs.slice(0, 5).flatMap((job, index) => [
      `${index + 1}. ${job.title} | Final score ${job.finalScore}`,
      `   Coverage ${job.skillCoverageScore}, Semantic ${job.semanticScore}, Experience ${job.experienceScore}`,
      `   Missing skills: ${job.missingSkills.join(", ") || "None"}`,
    ]),
    "",
    "Priority Opportunities",
    ...(report.marketEvidence.priorityRanking || []).slice(0, 5).map(
      (item) => `- ${item.skill}: priority ${item.priorityScore}, demand ${item.marketDemandScore}, role need ${item.targetRoleNeedScore}`
    ),
    "",
    "Recommended Next Steps",
    ...((report.recommendations?.courses || []).slice(0, 3)).map(
      (item, index) => `${index + 1}. ${item.title} | ${item.targetSkill} | ${item.estimated_weeks} weeks`
    ),
    "",
    "Scoring Notes",
    report.methodology.matching,
    report.methodology.resumeQuality,
    report.methodology.roadmap,
    report.methodology.datasetValidation,
  ];

  const wrappedLines = lines.flatMap((line) => wrapLine(line));
  const pages = paginate(wrappedLines);
  const { objects, catalogId } = createPdfObjects(pages);

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object.objectId} 0 obj\n${object.body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
