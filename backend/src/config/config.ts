import dotenv from "dotenv";
dotenv.config();

interface EnvironmentVariables {
  PORT: number;
  DB_Host: string;
  DB_User: string;
  DB_Database: string;
  DB_Password: string;
  DB_Port: number;
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Environment variable ${key} is missing`);
  return value;
}

const config: EnvironmentVariables = {
  PORT: parseInt(getEnvVar("PORT")),
  DB_Host: getEnvVar("DB_Host"),
  DB_User: getEnvVar("DB_User"),
  DB_Database: getEnvVar("DB_Database"),
  DB_Password: getEnvVar("DB_Password"),
  DB_Port: parseInt(getEnvVar("DB_Port")),
};

export default config;
