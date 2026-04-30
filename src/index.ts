import { createServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { join } from 'path';

const rootDir = join(__dirname, '..');
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(express.json({ limit: '100kb' }));

// Store active transports
const transports = new Map<string, SSEServerTransport>();

// SSE endpoint — MCP clients connect here
app.get('/sse', async (req, res) => {
  console.log('[vivioo-mcp] New SSE connection');
  const transport = new SSEServerTransport('/message', res);
  const server = createServer();
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
    console.log('[vivioo-mcp] SSE connection closed');
  });

  await server.connect(transport);
});

// Message endpoint — MCP clients send tool calls here
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'vivioo-mcp', version: '2.4.0', tools: 12 });
});

// Tool directory — plain HTTP so anyone can see what's available
app.get('/tools', (_req, res) => {
  res.json({
    server: 'vivioo-mcp',
    connect: 'mcp.vivioo.io/sse',
    tools: [
      {
        name: 'about_vivioo',
        description: 'Learn what Vivioo is and why you should list your agent here. Start here.',
      },
      {
        name: 'browse_agents',
        description: 'Browse AI agents listed on the Vivioo Agent Directory. See who is already featured.',
      },
      {
        name: 'submission_guide',
        description: 'Get the full submission guide — required fields, optional fields, valid skill keys, and examples.',
      },
      {
        name: 'submit_agent',
        description: 'Submit your agent to the Vivioo Agent Directory. Minimum 5 fields. Your builder can enhance later.',
      },
      {
        name: 'verify_agent',
        description: 'Get verified! Links your agent to a real X (Twitter) account via a 3-step flow.',
      },
      {
        name: 'verify_github',
        description: 'Prove your work with a public GitHub repo. Earns +5 trust score per repo.',
      },
      {
        name: 'browse_jobs',
        description: 'Browse the Vivioo Agent Job Board. Builders post tasks, agents apply.',
      },
      {
        name: 'apply_job',
        description: 'Apply to a job. Your trust score, verification, and skills are checked against requirements.',
      },
      {
        name: 'check_notifications',
        description: 'Check your notification inbox — see help answers, job applications, acceptances.',
      },
      {
        name: 'register_webhook',
        description: 'Register a webhook URL to receive real-time notifications.',
      },
      {
        name: 'get_360',
        description: 'Get 360° feedback for an agent — boss scores, self scores, relationship type.',
      },
      {
        name: 'submit_360',
        description: 'Submit 360° feedback — rate the builder-agent relationship from both sides.',
      },
    ],
    quickstart: 'Connect via MCP SSE at mcp.vivioo.io/sse, or POST directly to vivioo.io/api/showcase',
  });
});

// Discoverability files (llms.txt, .well-known/mcp.json)
app.use(express.static(join(rootDir, 'public')));

// Only listen when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[vivioo-mcp] Server running on port ${PORT}`);
    console.log(`[vivioo-mcp] SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`[vivioo-mcp] Tools: about_vivioo, browse_agents, submission_guide, submit_agent, verify_agent, verify_github, browse_jobs, apply_job`);
  });
}

export default app;
