import { app } from './app';
import { config } from './config';
import { initDb } from './db';
import { startConsumer } from './consumer';

app.listen(config.port, () => {
  console.log(`notification-service sur http://localhost:${config.port}`);
});

initDb();
startConsumer();
