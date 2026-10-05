import { createApp } from './app';
import { getDbKind } from './db';
import { aiProviderActive } from './triage';

const PORT = Number(process.env.PORT) || 4000;

const app = createApp({ adminKey: process.env.ADMIN_KEY });

app.listen(PORT, () => {
  console.log(
    `[civiclens] API listening on :${PORT} (db=${getDbKind()}, ai=${aiProviderActive()})`
  );
});
