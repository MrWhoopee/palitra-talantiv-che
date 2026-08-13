import { loadEnv } from './lib/env.js';
import { createApp } from './http/app.js';

const env = loadEnv();

const app = createApp({
  checkDatabase: async () => true,
  webOrigin: env.WEB_ORIGIN,
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
