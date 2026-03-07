import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(root, "data", "reports", "runs", ts);
fs.mkdirSync(runDir, { recursive: true });

const artifacts = {
  raw_sources: [],
  normalized_claims: [],
  citation_verification: { passed: false, failed_claims: [] },
  use_case_matrix: [],
  forecast_2w_2m: { two_week: [], two_month: [] },
  value_scorecard: { score: 0, decision: "reject" },
};

for (const [name, content] of Object.entries(artifacts)) {
  fs.writeFileSync(path.join(runDir, `${name}.json`), JSON.stringify(content, null, 2));
}

const ownerPacket = `# Owner Review Packet\n\nRun: ${ts}\n\nStatus: Draft scaffold generated.\n\nNext: plug in real collectors + synthesis agents before publish.`;
fs.writeFileSync(path.join(runDir, "owner_review_packet.md"), ownerPacket);

console.log(`created_report_run=${runDir}`);
