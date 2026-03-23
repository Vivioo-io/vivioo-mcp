import { createServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { timingSafeEqual } from 'crypto';
import { join } from 'path';
import express from 'express';
import { loadGuides } from './lib/search.js';
import { blobList, blobRead, blobWrite } from './lib/blob.js';

const rootDir = join(__dirname, '..');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// C1 fix: No default password — refuse to serve admin if unset
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.warn('[vivioo-mcp] WARNING: ADMIN_PASSWORD not set. Admin endpoints will be disabled.');
}

// H1 fix: Limit request body size
app.use(express.json({ limit: '100kb' }));

// Load guide search index at startup
loadGuides();
console.log('[vivioo-mcp] Guide search index loaded');

// Store active transports
const transports = new Map<string, SSEServerTransport>();

// SSE endpoint — clients connect here
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

// Message endpoint — clients send tool calls here
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'vivioo-mcp' });
});

// Static files for discoverability
app.use(express.static(join(rootDir, 'public')));

// Admin page
app.use('/admin', express.static(join(rootDir, 'src', 'admin')));

// C2 fix: Timing-safe admin password check
function checkAdmin(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: 'Admin not configured' });
    return false;
  }
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const expected = `Bearer ${ADMIN_PASSWORD}`;
  // Constant-time comparison
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// H2 fix: Simple rate limiter for write operations
const writeHits = new Map<string, { count: number; resetAt: number }>();
function isWriteRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = writeHits.get(ip);
  if (!entry || now > entry.resetAt) {
    writeHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10; // 10 writes per minute per IP
}

app.get('/api/admin/submissions', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const paths = await blobList('submissions/');
    const items = [];
    for (const p of paths) {
      const data = await blobRead(p);
      if (data) items.push(data);
    }
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

app.get('/api/admin/concerns', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const paths = await blobList('concerns/');
    const items = [];
    for (const p of paths) {
      const data = await blobRead(p);
      if (data) items.push(data);
    }
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

app.post('/api/admin/review', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const { submission_id, action } = req.body;

    // H3 fix: Validate action and submission_id format
    if (!submission_id || !action) {
      res.status(400).json({ error: 'submission_id and action required' });
      return;
    }
    const validActions = ['approved', 'rejected'];
    if (!validActions.includes(action)) {
      res.status(400).json({ error: 'action must be "approved" or "rejected"' });
      return;
    }
    if (!/^sub-\d{8}-[a-z0-9]{6}$/.test(submission_id)) {
      res.status(400).json({ error: 'Invalid submission_id format' });
      return;
    }

    const data = await blobRead(`submissions/${submission_id}.json`);
    if (!data) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    (data as Record<string, unknown>).status = action;
    (data as Record<string, unknown>).reviewed_at = new Date().toISOString();
    await blobWrite(`submissions/${submission_id}.json`, data);
    res.json({ status: 'ok', action });
  } catch {
    res.status(500).json({ error: 'Review failed' });
  }
});

// Only listen when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[vivioo-mcp] Server running on port ${PORT}`);
    console.log(`[vivioo-mcp] SSE endpoint: http://localhost:${PORT}/sse`);
  });
}

export { isWriteRateLimited };
export default app;
