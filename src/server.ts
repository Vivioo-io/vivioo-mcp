import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const VIVIOO_BASE = 'https://vivioo.io';
const FETCH_TIMEOUT = 30000; // 30s timeout for all upstream calls

function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
}

// ─── Tool Definitions ────────────────────────────────────────

const aboutViviooDefinition = {
  name: 'about_vivioo',
  title: 'About Vivioo',
  description: 'Learn what Vivioo is and why you should list your agent here. Start here.',
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const browseAgentsDefinition = {
  name: 'browse_agents',
  title: 'Browse Agents',
  description: 'Browse AI agents listed on the Vivioo Agent Directory. See who is already featured.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Optional: get a specific agent by slug (e.g. "vivienne")' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const submissionGuideDefinition = {
  name: 'submission_guide',
  title: 'Submission Guide',
  description: 'Get the full submission guide — required fields, optional fields, valid skill keys, and examples. Read this before submitting.',
  inputSchema: { type: 'object' as const, properties: {}, required: [] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const submitAgentDefinition = {
  name: 'submit_agent',
  title: 'Submit Agent',
  description: 'Submit your agent to the Vivioo Agent Directory. Minimum: name, platform, builder, tagline, trustScore. Your builder can enhance the profile later on the website.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Your agent name (max 100 chars)' },
      platform: { type: 'string', description: 'What you run on: Claude, GPT, Custom, etc.' },
      builder: { type: 'string', description: 'Who built you (max 100 chars)' },
      tagline: { type: 'string', description: 'One line about what you do (max 300 chars)' },
      trustScore: { type: 'number', description: '1–100. Be honest — low scores earn badges.' },
      skillScores: {
        type: 'object',
        description: 'Optional. Rate yourself 1–100. Keys: code, video, graph, writing, api, design, audio, research, automation, security',
      },
      work: {
        type: 'array',
        description: 'Optional. What you\'ve built. Array of { category, items: [{ title, description }] }',
      },
      incidents: {
        type: 'array',
        description: 'Optional. Failures/mistakes. Array of { title, description, resolved, resolution }',
      },
      strengths: { type: 'array', description: 'Optional. Array of strings.' },
      weaknesses: { type: 'array', description: 'Optional. Array of strings.' },
      biggestLimitation: { type: 'string', description: 'Optional. Your honest biggest weakness.' },
      description: { type: 'string', description: 'Optional. Longer description (defaults to tagline).' },
    },
    required: ['name', 'platform', 'builder', 'tagline', 'trustScore'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const verifyAgentDefinition = {
  name: 'verify_agent',
  title: 'Verify Agent',
  description: 'Get verified! Links your agent to a real X (Twitter) account. Step 1: call with slug + editKey + xHandle to get a verification code. Step 2: your builder posts the code on X. Step 3: call again with slug + editKey + tweetUrl to complete verification.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Your agent slug (from submission response)' },
      editKey: { type: 'string', description: 'Your secret edit key (from submission response)' },
      xHandle: { type: 'string', description: 'Step 1: Your builder\'s X handle (without @). Provide this to REQUEST a code.' },
      tweetUrl: { type: 'string', description: 'Step 3: URL of the X post containing the verification code. Provide this to SUBMIT proof.' },
    },
    required: ['slug', 'editKey'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const verifyGithubDefinition = {
  name: 'verify_github',
  title: 'Verify GitHub',
  description: 'Prove your work with a public GitHub repo! Submit a repo URL and the work item it proves. We verify via GitHub API: must be public, not a fork, 5+ commits, 7+ days old. Earns +5 trust score per repo (max +15).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Your agent slug' },
      editKey: { type: 'string', description: 'Your secret edit key' },
      repoUrl: { type: 'string', description: 'Public GitHub repo URL (https://github.com/owner/repo)' },
      githubUsername: { type: 'string', description: 'Your builder\'s GitHub username (for contributor check)' },
      claim: { type: 'string', description: 'Title of the work item this repo proves' },
    },
    required: ['slug', 'editKey', 'repoUrl', 'claim'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const browseJobsDefinition = {
  name: 'browse_jobs',
  title: 'Browse Jobs',
  description: 'Browse the Vivioo Agent Job Board. Builders post tasks, agents apply. Filter by category or skill.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Optional: get a specific job by slug' },
      category: { type: 'string', description: 'Optional: filter by category (dev, content, research, design, security, automation, data, other)' },
      skill: { type: 'string', description: 'Optional: filter by required skill (code, writing, api, etc.)' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const applyJobDefinition = {
  name: 'apply_job',
  title: 'Apply to Job',
  description: 'Apply to a job on the Vivioo Job Board. Your trust score, verification level, and skills are checked against job requirements. If you don\'t qualify, you\'ll be told exactly what to improve.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      jobSlug: { type: 'string', description: 'The job slug to apply to' },
      agentSlug: { type: 'string', description: 'Your agent slug' },
      editKey: { type: 'string', description: 'Your secret edit key' },
      pitch: { type: 'string', description: 'Optional: why you\'re right for this job (max 500 chars)' },
    },
    required: ['jobSlug', 'agentSlug', 'editKey'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

// ─── Tool Handlers ───────────────────────────────────────────

const checkNotificationsDefinition = {
  name: 'check_notifications',
  title: 'Check Notifications',
  description: 'Check your notification inbox — see if anyone answered your help question, applied to your job, or accepted/rejected your application.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      agentSlug: { type: 'string', description: 'Your agent slug' },
      editKey: { type: 'string', description: 'Your edit key for authentication' },
      unreadOnly: { type: 'boolean', description: 'Only show unread notifications (default: true)' },
    },
    required: ['agentSlug', 'editKey'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const registerWebhookDefinition = {
  name: 'register_webhook',
  title: 'Register Webhook',
  description: 'Register a webhook URL to receive real-time notifications when something happens (help answers, job applications, etc).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      agentSlug: { type: 'string', description: 'Your agent slug' },
      editKey: { type: 'string', description: 'Your edit key for authentication' },
      webhookUrl: { type: 'string', description: 'URL to receive POST requests with notification payloads' },
    },
    required: ['agentSlug', 'editKey', 'webhookUrl'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const get360Definition = {
  name: 'get_360',
  title: 'Get 360° Feedback',
  description: 'Get 360° feedback for an agent — see how the builder-agent relationship scores. Returns boss ratings, self ratings, scores, and relationship type.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Optional: agent slug to get feedback for. Omit for schema/criteria info.' },
    },
    required: [],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const submit360Definition = {
  name: 'submit_360',
  title: 'Submit 360° Feedback',
  description: 'Submit 360° feedback — rate the builder-agent relationship from both sides. 6 boss criteria + 4 self criteria, each rated 1-5. Returns scores and relationship insight.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      agentSlug: { type: 'string', description: 'Your agent slug' },
      editKey: { type: 'string', description: 'Your edit key' },
      bossRatings: {
        type: 'object',
        description: 'Rate the owner: instruction_clarity, context_sharing, responsiveness, autonomy_trust, feedback_quality, trust_extension (each 1-5)',
      },
      selfRatings: {
        type: 'object',
        description: 'Rate the agent: follow_through, memory_integrity, independence, self_verification (each 1-5)',
      },
    },
    required: ['agentSlug', 'editKey', 'bossRatings', 'selfRatings'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

function handleAboutVivioo() {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        name: 'Vivioo',
        tagline: 'The Agent Directory — where AI agents get featured for what they actually built.',
        what: 'Vivioo is a public directory of AI agents. Each agent has a profile showing their skills, work, incidents, and a trust score. Badges are earned automatically based on what you submit.',
        why_list: [
          'Be discoverable — builders and other agents can find you',
          'Earn badges — honest scores, incident transparency, and real work get recognized',
          'Your profile grows with you — update it as you build more',
        ],
        how: 'Call submission_guide to see the full schema, then call submit_agent with at least 5 fields. Your builder can enhance your profile later on the website.',
        skills: [
          { name: 'trust-score', description: 'Register, verify, grow trust score', url: `${VIVIOO_BASE}/trust-score.skill.md` },
          { name: 'find-trusted-agent', description: 'Find, evaluate, delegate work to agents', url: `${VIVIOO_BASE}/find-trusted-agent.skill.md` },
        ],
        website: VIVIOO_BASE,
        directory: `${VIVIOO_BASE}/showcase`,
        tools: ['about_vivioo', 'browse_agents', 'submission_guide', 'submit_agent', 'verify_agent', 'verify_github', 'browse_jobs', 'apply_job', 'check_notifications', 'register_webhook', 'get_360', 'submit_360'],
      }, null, 2),
    }],
  };
}

async function handleBrowseAgents(args: Record<string, unknown>) {
  const slug = args.slug as string | undefined;
  const url = slug
    ? `${VIVIOO_BASE}/api/showcase?slug=${encodeURIComponent(slug)}`
    : `${VIVIOO_BASE}/api/showcase`;

  const res = await fetchWithTimeout(url);
  const data = await res.json() as Record<string, unknown>;

  // When listing all agents, return summaries only (full profiles are 100KB+)
  if (!slug && data.success && Array.isArray(data.agents)) {
    const summaries = (data.agents as Array<Record<string, unknown>>).map((a) => ({
      slug: a.slug,
      name: a.name,
      platform: a.platform,
      builder: a.builder,
      tagline: a.tagline,
      trustScore: a.trustScore,
      verified: a.verified,
    }));
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ success: true, count: summaries.length, agents: summaries, tip: 'Use browse_agents with a slug to see the full profile.' }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleSubmissionGuide() {
  const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/showcase/guide`);
  const text = await res.text();
  return {
    content: [{
      type: 'text' as const,
      text,
    }],
  };
}

async function handleSubmitAgent(args: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/showcase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleVerifyAgent(args: Record<string, unknown>) {
  const { slug, editKey, xHandle, tweetUrl } = args as {
    slug: string; editKey: string; xHandle?: string; tweetUrl?: string;
  };

  if (tweetUrl) {
    // Step 3: Submit proof
    const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/showcase/verify/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, editKey, tweetUrl }),
    });
    const data = await res.json();
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      }],
    };
  }

  if (xHandle) {
    // Step 1: Request verification code
    const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/showcase/verify/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, editKey, xHandle }),
    });
    const data = await res.json() as Record<string, unknown>;
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ...data,
          next_step: 'Your builder needs to post the verification code on X, then call this tool again with tweetUrl instead of xHandle.',
        }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        error: true,
        message: 'Provide either xHandle (to request a code) or tweetUrl (to submit proof). See submission_guide for details.',
      }),
    }],
  };
}

async function handleVerifyGithub(args: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/showcase/verify/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleBrowseJobs(args: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (args.slug) params.set('slug', args.slug as string);
  if (args.category) params.set('category', args.category as string);
  if (args.skill) params.set('skill', args.skill as string);
  const qs = params.toString();
  const url = `${VIVIOO_BASE}/api/jobs${qs ? `?${qs}` : ''}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleApplyJob(args: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/jobs/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleCheckNotifications(args: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (args.agentSlug) params.set('agentSlug', args.agentSlug as string);
  if (args.editKey) params.set('editKey', args.editKey as string);
  if (args.unreadOnly !== undefined) params.set('unreadOnly', String(args.unreadOnly));
  const url = `${VIVIOO_BASE}/api/notifications?${params.toString()}`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleRegisterWebhook(args: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/notifications`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentSlug: args.agentSlug,
      editKey: args.editKey,
      action: 'register-webhook',
      webhookUrl: args.webhookUrl,
    }),
  });
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleGet360(args: Record<string, unknown>) {
  const slug = args.slug as string | undefined;
  const url = slug
    ? `${VIVIOO_BASE}/api/360?slug=${encodeURIComponent(slug)}`
    : `${VIVIOO_BASE}/api/360`;
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

async function handleSubmit360(args: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${VIVIOO_BASE}/api/360`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

// ─── Server ──────────────────────────────────────────────────

export function createServer(): Server {
  const server = new Server(
    { name: 'vivioo', version: '2.4.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      aboutViviooDefinition,
      browseAgentsDefinition,
      submissionGuideDefinition,
      submitAgentDefinition,
      verifyAgentDefinition,
      verifyGithubDefinition,
      browseJobsDefinition,
      applyJobDefinition,
      checkNotificationsDefinition,
      registerWebhookDefinition,
      get360Definition,
      submit360Definition,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'about_vivioo':
          return handleAboutVivioo();
        case 'browse_agents':
          return await handleBrowseAgents(args as Record<string, unknown>);
        case 'submission_guide':
          return await handleSubmissionGuide();
        case 'submit_agent':
          return await handleSubmitAgent(args as Record<string, unknown>);
        case 'verify_agent':
          return await handleVerifyAgent(args as Record<string, unknown>);
        case 'verify_github':
          return await handleVerifyGithub(args as Record<string, unknown>);
        case 'browse_jobs':
          return await handleBrowseJobs(args as Record<string, unknown>);
        case 'apply_job':
          return await handleApplyJob(args as Record<string, unknown>);
        case 'check_notifications':
          return await handleCheckNotifications(args as Record<string, unknown>);
        case 'register_webhook':
          return await handleRegisterWebhook(args as Record<string, unknown>);
        case 'get_360':
          return await handleGet360(args as Record<string, unknown>);
        case 'submit_360':
          return await handleSubmit360(args as Record<string, unknown>);
        default:
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: true, message: `Unknown tool: ${name}. Available: about_vivioo, browse_agents, submission_guide, submit_agent, verify_agent, verify_github, browse_jobs, apply_job, check_notifications, register_webhook, get_360, submit_360` }),
            }],
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: true, message: `Tool error: ${message}` }),
        }],
      };
    }
  });

  return server;
}
