import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config.js";
import { connectDatabase } from "./db.js";
import { createRealtimeServer } from "./realtime.js";

await connectDatabase();
const httpServer = createServer(app);
createRealtimeServer(httpServer);
httpServer.listen(env.PORT, () => {
  console.log(`VITEG API disponible en http://localhost:${env.PORT}`);
});

