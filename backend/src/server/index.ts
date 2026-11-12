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
app.get("/", (req: Request, res: Response) => {
  res.send("The backend is now running...");
});
app.listen(PORT, () => {
  console.log(`Connected at port : ${PORT}`);
});
