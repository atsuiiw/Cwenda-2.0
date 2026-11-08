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
await DBPool.connect().then(() => {
  console.log("Database conncted");
});

// initializing backend
app.use("/api/event", eventRouter);
app.use("/api/tag", tagRouter);
app.get("/", (req: Request, res: Response) => {
  res.send("The backend is now running...");
});
app.listen(PORT, () => {
  console.log(`Connected at port : ${PORT}`);
});
