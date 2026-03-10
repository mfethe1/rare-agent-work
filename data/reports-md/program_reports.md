# Autoresearch Loop for McKinsey-style Reports

This is the autonomous loop for researching, drafting, and improving the McKinsey-style reports and newsletters for `rareagent.work`.

## Goal
The goal is to iteratively improve each report in `infra/rareagent-news/reports/` to meet the highest McKinsey-style standards (data-rich, highly structured, professional, insightful).

## Target Files
1. `newsletter_issue.md`
2. `report_architecture.md`
3. `report_enterprise_implementation.md`
4. `report_multi_agent.md`
5. `report_setup_60_mins.md`

## Constraints per Report
- **Max Iterations:** Exactly 10 iterations per report.
- **Max Time:** 5 minutes per iteration loop.

## The Experiment Loop
For each of the target files above, run the following loop up to 10 times:
1. **Research (max 2 mins):** Use your research tools (Firecrawl, OpenRouter Sonar, web_search, etc.) to find new deep insights, enterprise use cases, or data points related to the report's topic. Focus on high-signal McKinsey-style insights (e.g. cost-savings percentages, deployment timelines, specific failure modes).
2. **Review & Critique (max 1 min):** Read the current version of the report. Identify structural weaknesses, missing data, or areas where the tone isn't professional/authoritative enough.
3. **Rewrite & Improve (max 2 mins):** Edit the report. Apply your new research and critique to upgrade the text. Ensure it includes executive summaries, bulleted insights, and clear frameworks.
4. **Log Results:** Record the iteration number, the insights added, and the status in a local `reports_autoresearch.tsv` file.

## Completion
Once a report has reached 10 iterations (approx 50 minutes of work per report), move on to the next one.
Once all reports are finished, use the `scripts/send-newsletter-review.sh` script to send the final upgraded attachments to `Michael.fethe@protelynx.ai` for review.
