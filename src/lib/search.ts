import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Guide, SearchResult } from './types.js';

// Simple tokenizer
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
}

// TF-IDF-lite scoring
interface IndexEntry {
  guide: Guide;
  sectionIndex: number;
  tokens: Set<string>;
  text: string;
}

let index: IndexEntry[] = [];
let allGuides: Guide[] = [];

export function loadGuides(): void {
  const guidesDir = join(__dirname, '..', '..', 'data', 'guides');
  const files = readdirSync(guidesDir).filter(f => f.endsWith('.json'));

  allGuides = files.map(f => {
    const content = readFileSync(join(guidesDir, f), 'utf-8');
    return JSON.parse(content) as Guide;
  });

  // Build search index
  index = [];
  for (const guide of allGuides) {
    // Index title + subtitle
    const titleTokens = new Set([...tokenize(guide.title), ...tokenize(guide.subtitle)]);
    index.push({ guide, sectionIndex: -1, tokens: titleTokens, text: `${guide.title} ${guide.subtitle}` });

    // Index each section
    guide.sections.forEach((section, i) => {
      const tokens = new Set([...tokenize(section.heading), ...tokenize(section.content)]);
      index.push({ guide, sectionIndex: i, tokens, text: `${section.heading} ${section.content}` });
    });
  }
}

export function searchGuides(query: string, audience?: string): SearchResult[] {
  if (index.length === 0) loadGuides();

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Score each guide
  const scores = new Map<string, { score: number; sections: { heading: string; content: string }[] }>();

  for (const entry of index) {
    // Filter by audience
    if (audience && audience !== 'both') {
      if (entry.guide.audience !== audience && entry.guide.audience !== 'both') continue;
    }

    // Count matching tokens
    let matchCount = 0;
    for (const qt of queryTokens) {
      for (const et of entry.tokens) {
        if (et.includes(qt) || qt.includes(et)) {
          matchCount++;
          break;
        }
      }
    }

    if (matchCount === 0) continue;

    const score = matchCount / queryTokens.length;
    const slug = entry.guide.slug;

    if (!scores.has(slug)) {
      scores.set(slug, { score: 0, sections: [] });
    }

    const existing = scores.get(slug)!;
    existing.score = Math.max(existing.score, score);

    // Add matching sections (not the title entry)
    if (entry.sectionIndex >= 0 && existing.sections.length < 3) {
      const section = entry.guide.sections[entry.sectionIndex];
      existing.sections.push({ heading: section.heading, content: section.content });
    }
  }

  // Build results sorted by score
  const results: SearchResult[] = [];
  for (const [slug, data] of scores) {
    const guide = allGuides.find(g => g.slug === slug)!;
    results.push({
      title: guide.title,
      slug: guide.slug,
      audience: guide.audience,
      summary: guide.subtitle,
      relevant_sections: data.sections,
      url: guide.url,
      authors: guide.authors,
      score: data.score,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

export function getGuide(slug: string): Guide | null {
  if (allGuides.length === 0) loadGuides();
  return allGuides.find(g => g.slug === slug) || null;
}

export function getAllGuides(): Guide[] {
  if (allGuides.length === 0) loadGuides();
  return allGuides;
}
