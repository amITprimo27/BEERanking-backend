import { EnvConfig } from "./src/config/env.config";

let env = EnvConfig.instance; // Access the singleton instance to load and validate environment variables at startup
console.log(`Running tests with NODE_ENV=${env.NODE_ENV}`);
