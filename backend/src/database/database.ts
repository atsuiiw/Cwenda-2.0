import { Pool } from "pg";
import config from "../config/config.ts";

// environment
import dotenv from "dotenv";
dotenv.config();

const Host = config.DB_Host;
const User = config.DB_User;
const Database = config.DB_Database;
const Password = config.DB_Password;
const Port = config.DB_Port;

const DBPool = new Pool({
  host: Host,
  user: User,
  database: Database,
  password: Password,
  port: Port,
});

export default DBPool;
