import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { pickSearchTemplates } from '../utils/randomSelection';

export interface ResearchInput {
  niche:           string;
  differentiator?: string;
}

export interface ResearchResult {
  trends:          string[];
  workingAngles:   string[];
  saturatedAngles: string[];
  vocabulary:      string[];
}

interface SerperOrganic {
  title:    string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganic[];
}

async function searchSerper(query: string, apiKey: string): Promise<string> {
  const res = await fetch('https://google.serper.dev/search', {
    method:  'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ q: query, num: 5 }),
  });
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}`);
  const data = await res.json() as SerperResponse;
  return (data.organic ?? [])
    .slice(0, 5)
    .map(r => r.snippet ?? '')
    .filter(Boolean)
    .join('\n');
}

function parseResult(text: string): ResearchResult | null {
  const attempts = [
    () => JSON.parse(text),
    () => { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (!m) throw 0; return JSON.parse(m[1].trim()); },
    () => { const m = text.match(/\{[\s\S]*\}/);                  if (!m) throw 0; return JSON.parse(m[0]); },
  ];
  for (const attempt of attempts) {
    try {
      const r = attempt() as Partial<ResearchResult>;
      if (Array.isArray(r?.trends) && Array.isArray(r?.workingAngles)) {
        return {
          trends:          r.trends.slice(0, 3),
          workingAngles:   (r.workingAngles   ?? []).slice(0, 3),
          saturatedAngles: (r.saturatedAngles  ?? []).slice(0, 2),
          vocabulary:      (r.vocabulary       ?? []).slice(0, 6),
        };
      }
    } catch { /* next */ }
  }
  return null;
}

async function _run(input: ResearchInput, serperKey: string): Promise<ResearchResult | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!anthropicKey) return null;

  const searchTemplates = pickSearchTemplates(input.niche);
  const [st1, st2, st3] = searchTemplates;

  logger.info(
    `[ResearchAgent] Selected Research Queries: ` +
    `1. ${st1.name} | 2. ${st2.name} | 3. ${st3.name}`,
  );
  logger.info(`[ResearchAgent] Running 3 parallel searches for: "${input.niche.slice(0, 50)}"`);

  const [r1, r2, r3] = await Promise.all([
    searchSerper(st1.query, serperKey),
    searchSerper(st2.query, serperKey),
    searchSerper(st3.query, serperKey),
  ]);

  const haiku   = new Anthropic({ apiKey: anthropicKey });
  const diffCtx = input.differentiator ? ` (differentiator: ${input.differentiator})` : '';

  const response = await haiku.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role:    'user',
      content:
        `You are a marketing intelligence analyst. Analyze these search results about "${input.niche}" advertising${diffCtx}.\n\n` +
        `Extract actionable insights for a copywriter creating social media ads.\n\n` +
        `SEARCH RESULTS:\n\n` +
        `[QUERY: ${st1.name}]\n${r1 || 'No results'}\n\n` +
        `[QUERY: ${st2.name}]\n${r2 || 'No results'}\n\n` +
        `[QUERY: ${st3.name}]\n${r3 || 'No results'}\n\n` +
        `Return ONLY a JSON object (no markdown, no explanation):\n` +
        `{\n` +
        `  "trends": ["current trend 1", "current trend 2", "current trend 3"],\n` +
        `  "workingAngles": ["copy angle getting results now 1", "angle 2", "angle 3"],\n` +
        `  "saturatedAngles": ["overused approach to avoid 1", "overused approach 2"],\n` +
        `  "vocabulary": ["exact word/phrase ideal customer uses 1", "phrase 2", "phrase 3", "phrase 4", "phrase 5"]\n` +
        `}\n\n` +
        `trends: current shifts in how this niche is marketed or consumed in 2025-2026.\n` +
        `workingAngles: specific emotional or rational copy angles with high engagement right now.\n` +
        `saturatedAngles: approaches so overused they no longer convert — must avoid.\n` +
        `vocabulary: exact words and phrases the ideal customer uses when describing this problem.`,
    }],
  }, { timeout: 10_000 });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const result = parseResult(text);

  if (result) {
    logger.info(`[ResearchAgent] Research complete — ${result.trends.length} trends, ${result.workingAngles.length} angles`);
  } else {
    logger.warn('[ResearchAgent] Haiku returned unparseable JSON — skipping research');
  }

  return result;
}

export async function researchNiche(input: ResearchInput): Promise<ResearchResult | null> {
  const serperKey = process.env.SERPER_API_KEY ?? '';
  if (!serperKey) return null;

  const timeoutGuard = new Promise<null>(resolve => setTimeout(() => resolve(null), 12_000));

  try {
    return await Promise.race([_run(input, serperKey), timeoutGuard]);
  } catch (err) {
    logger.warn(`[ResearchAgent] Failed: ${(err as Error).message}`);
    return null;
  }
}
