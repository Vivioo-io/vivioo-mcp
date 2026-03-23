import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { AlertsData, PlatformComparison, AgentProfile } from './types.js';

const dataDir = join(__dirname, '..', '..', 'data');

function loadJSON<T>(relativePath: string): T | null {
  const fullPath = join(dataDir, relativePath);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

export function getAlerts(): AlertsData | null {
  return loadJSON<AlertsData>('alerts/current.json');
}

export function getPlatformComparison(): PlatformComparison | null {
  return loadJSON<PlatformComparison>('platforms/comparison.json');
}

export function getAgentProfile(name: string): AgentProfile | null {
  // Sanitize name for file lookup
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return loadJSON<AgentProfile>(`profiles/${safeName}.json`);
}

export function getTrustSpec(format: string): object | null {
  switch (format) {
    case 'full_spec':
      const spec = loadJSON<object>('specs/trust-md-spec.json');
      const schema = loadJSON<object>('specs/trust-profile-schema.json');
      const template = loadJSON<object>('specs/trust-profile-template.json');
      return { spec, schema, template };
    case 'template_only':
      return loadJSON<object>('specs/trust-profile-template.json');
    case 'quickstart':
      return loadJSON<object>('specs/trust-profile-quickstart.json');
    default:
      return null;
  }
}
