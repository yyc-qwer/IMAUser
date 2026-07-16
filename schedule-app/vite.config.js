import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function apiProxy() {
  return {
    name: 'api-proxy',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '');
      const DEEPSEEK_KEY = env.DEEPSEEK_KEY || '';

      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        if (!DEEPSEEK_KEY) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'DEEPSEEK_KEY not configured. Please add it to .env.local' }));
          return;
        }

        try {
          const body = await readBody(req);
          const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${DEEPSEEK_KEY}`,
            },
            body,
          });
          const data = await dsRes.json();
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = dsRes.status;
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      server.middlewares.use('/api/remind', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        try {
          const body = await readBody(req);
          const bodyObj = JSON.parse(body);
          const { token, title, content } = bodyObj;
          const pushRes = await fetch('http://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, title, content, template: 'txt' }),
          });
          const data = await pushRes.json();
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = pushRes.status;
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiProxy()],
  server: { port: 5173, open: false },
});
