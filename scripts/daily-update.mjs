import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSTANTS_PATH = resolve(__dirname, '../src/lib/constants.js');

const WEIGHTS = {
  flights: 4, incidents: 5, hormuz: 2, oil: 1,
  advisory: 3, ceasefire: 5, airport_threat: 4, healthcare: 5, exit: 4,
};
const TOTAL_WEIGHT = 33;

function calculateComposite(scores) {
  let sum = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    sum += ((scores[key] - 1) / 4) * weight;
  }
  return Math.round((sum / TOTAL_WEIGHT) * 100);
}

async function main() {
  const constantsContent = readFileSync(CONSTANTS_PATH, 'utf-8');

  // Check what dates already exist
  const dateMatches = [...constantsContent.matchAll(/date: '(\d{4}-\d{2}-\d{2})'/g)];
  const lastDate = dateMatches[dateMatches.length - 1]?.[1];
  const today = new Date().toISOString().split('T')[0];

  if (lastDate === today) {
    console.log(`Entry for ${today} already exists. Skipping.`);
    process.exit(0);
  }

  // Calculate day number
  const conflictStart = new Date('2026-02-28');
  const dayNumber = Math.floor((new Date(today) - conflictStart) / 86400000) + 1;

  // Get last entry for context
  const lastEntryMatch = constantsContent.match(new RegExp(`\\{ date: '${lastDate}'[^}]*\\}`));
  const lastEntry = lastEntryMatch?.[0] || 'N/A';

  const client = new Anthropic();

  const prompt = `You are updating the Dubai Return Protocol dashboard for ${today} (Day ${dayNumber} of the US-Israel-Iran conflict that began Feb 28, 2026).

Research today's status and score these 9 factors (1-5 scale):

1. DXB Flight Operations (weight 4):
   1=0-100 departures (closed), 2=100-350 (~10-30%), 3=350-700 (~30-60%), 4=700-1000 (~60-85%), 5=1000+ (~85%+)

2. UAE Missile/Drone Incidents (weight 5, inverse - higher=safer):
   1=5+ strikes/casualties, 2=3-4 intercepts with debris, 3=1-2 all intercepted, 4=clean 24-48hrs, 5=clean 72+hrs

3. Strait of Hormuz Transits (weight 2):
   1=0-2 (blockade), 2=3-10 (dark transits), 3=10-25 (selective), 4=25-45 (western carriers), 5=45+ (normal)

4. Brent Crude Oil Price (weight 1):
   1=$120+, 2=$100-120, 3=$85-100, 4=$70-85, 5=<$70

5. Travel Advisory Level (weight 3, worst of US/UK/AU):
   1=DNT + embassy evac, 2=DNT or embassy closed, 3=Reconsider + limited embassy, 4=High Caution + reopening, 5=Normal

6. Ceasefire & Diplomatic Status (weight 5):
   1=Escalation/new fronts, 2=Strikes continuing no talks, 3=Strike rate declining + backchannels, 4=Named mediators both at table, 5=Formal ceasefire 48+hrs

7. DXB Airport Direct Threat (weight 4):
   1=Hit today/closed, 2=Incident 1-2 days ago, 3=Last incident 3-5 days, 4=Last incident 6-10 days, 5=No incident 10+ days

8. Healthcare Access (weight 5):
   1=Hospitals closed, 2=Emergency only, 3=Open with disruptions, 4=OB/GYN available, 5=Full normal

9. Exit Viability (weight 4):
   1=No flights 48hrs, 2=>3x price frequent cancellations, 3=Next-day 2-3x with risk, 4=Same/next-day 1.5-2x, 5=Normal

Previous entry (${lastDate}): ${lastEntry}

IMPORTANT: After researching, respond with ONLY a JSON object in this exact format, no other text:
{"scores":{"flights":N,"incidents":N,"hormuz":N,"oil":N,"advisory":N,"ceasefire":N,"airport_threat":N,"healthcare":N,"exit":N},"note":"Day ${dayNumber}. Brief 1-2 sentence summary."}`;

  console.log(`Researching data for ${today} (Day ${dayNumber})...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text from response (skip tool_use/tool_result blocks)
  let textContent = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      textContent += block.text;
    }
  }

  console.log('Raw response:', textContent);

  // Parse JSON from response
  const jsonMatch = textContent.match(/\{[\s\S]*"scores"[\s\S]*?"note"[\s\S]*?\}/);
  if (!jsonMatch) {
    console.error('Failed to extract JSON from response');
    process.exit(1);
  }

  const data = JSON.parse(jsonMatch[0]);
  const { scores, note } = data;

  // Validate all 9 scores exist and are 1-5
  const requiredKeys = ['flights', 'incidents', 'hormuz', 'oil', 'advisory', 'ceasefire', 'airport_threat', 'healthcare', 'exit'];
  for (const key of requiredKeys) {
    const val = scores[key];
    if (typeof val !== 'number' || val < 1 || val > 5) {
      console.error(`Invalid score for ${key}: ${val}`);
      process.exit(1);
    }
  }

  const composite = calculateComposite(scores);

  // Build new entry line
  const scoresStr = requiredKeys.map((k) => `${k}: ${scores[k]}`).join(', ');
  const escapedNote = note.replace(/'/g, "\\'");
  const newEntry = `  { date: '${today}', scores: { ${scoresStr} }, note: '${escapedNote}' },`;

  // Insert before closing ];
  const updatedContent = constantsContent.replace(
    /\n];\n\nexport const ALL_SOURCE_URLS/,
    `\n${newEntry}\n];\n\nexport const ALL_SOURCE_URLS`,
  );

  if (updatedContent === constantsContent) {
    console.error('Failed to insert entry — could not find insertion point in constants.js');
    process.exit(1);
  }

  writeFileSync(CONSTANTS_PATH, updatedContent);

  console.log(`Added ${today}: composite ${composite}%`);
  console.log(`Scores: ${JSON.stringify(scores)}`);
  console.log(`Note: ${note}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
