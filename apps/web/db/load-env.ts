/**
 * Loads .env, .env.local, .env.development(.local) the same way `next dev` does, so CLI scripts
 * (db:migrate, db:seed, models:bootstrap) see the DATABASE_URL / STORAGE_DIR / CV_SERVICE_URL configured
 * for the app. Import this FIRST: lib/db and lib/storage resolve their paths at module load.
 * Variables already set in the shell win over file values.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
