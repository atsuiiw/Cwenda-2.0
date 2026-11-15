import express, {
  json,
  type Application,
  type Request,
  type Response,
} from "express";
import eventRouter from "../router/router.event.ts";
import config from "../config/config.ts";
import DBPool from "../database/database.ts";

// environment
import dotenv from "dotenv";
import tagRouter from "../router/router.tag.ts";
import authRouter from "../router/router.auth.ts";
import { requireAuth } from "../auth/auth.ts";
import fs from "node:fs";
import path from "node:path";
dotenv.config();

// default app class
class App {
  public app: Application;

  constructor() {
    this.app = express();
  }
}

// variables
const PORT: Number = config.PORT;
const app = new App().app;
app.use(express.json());

// connecting to database
// query() borrows and returns a pool client; connect() alone would keep one forever
await DBPool.query("SELECT 1");
console.log("Database connected");

// initializing backend
app.use("/api/auth", authRouter);
// everything else needs a logged-in session
app.use("/api/event", requireAuth, eventRouter);
app.use("/api/tag", requireAuth, tagRouter);

// Production: serve the built React app (web/dist), and send index.html for any non-/api URL so
// React Router handles routes like /event/5 on reload. Skipped when there's no build (npm run dev).
const webDist = path.join(import.meta.dirname, "../../../web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.get("/", (req: Request, res: Response) => {
  res.send("The backend is now running...");
});
app.listen(PORT, () => {
  console.log(`Connected at port : ${PORT}`);
});
