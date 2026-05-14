const createApp = require('./app');
const env = require('./config/env');
const { connectDb } = require('./db/mongo');

async function bootstrap() {
  await connectDb();
  const app = createApp();

  app.listen(env.port, () => {
    console.info(`CareMyCarAPI Node listening on port ${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
