import mongoose from "mongoose";
import dotenv from "dotenv";

import { ensureResearchDatasetsReady, getProcessedPaths } from "../utils/datasetPipeline.js";

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: "resume-analyser",
  });

  const summary = await ensureResearchDatasetsReady({ forceRefresh: true });
  const paths = getProcessedPaths();

  console.log("Research datasets prepared successfully.");
  console.log(`Dataset version: ${summary.datasetVersion}`);
  console.log(`Job postings: ${summary.cleaned.jobPostingCount}`);
  console.log(`Skill facts: ${summary.cleaned.skillFactCount}`);
  console.log(`Course catalog entries: ${summary.cleaned.courseCatalogCount}`);
  console.log(`Validation summary: ${paths.validationSummaryPath}`);
  console.log(`Processed course catalog: ${paths.courseCatalogPath}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed to prepare research dataset:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
