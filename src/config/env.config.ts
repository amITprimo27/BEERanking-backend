import dotenv from "dotenv";
import path from "path";

type NodeEnv = "development" | "test" | "production";

type EnvVars = {
  readonly NODE_ENV: NodeEnv;
  readonly PORT: number;
  readonly MONGODB_URI: string;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: number;
  readonly JWT_REFRESH_EXPIRES_IN: number;
  readonly COHERE_API_KEY: string;
  readonly GEMINI_API_KEY: string;
  readonly GOOGLE_CLIENT_ID: string;
};

export class EnvConfig implements EnvVars {
  private static _instance: EnvConfig;

  readonly NODE_ENV: NodeEnv;
  readonly PORT: number;
  readonly MONGODB_URI: string;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: number;
  readonly JWT_REFRESH_EXPIRES_IN: number;
  readonly COHERE_API_KEY: string;
  readonly GEMINI_API_KEY: string;
  readonly GOOGLE_CLIENT_ID: string;

  private static readonly ENV_PATHS: Record<NodeEnv, string> = {
    development: ".env.dev",
    test: ".env.test",
    production: ".env.prod",
  } as const;

  private constructor() {
    this.NODE_ENV = this.asRequiredString("NODE_ENV");
    const envFile = EnvConfig.ENV_PATHS[this.NODE_ENV];
    dotenv.config({ path: path.resolve(process.cwd(), "env", envFile) });

    console.log(
      `Loaded environment variables from ${envFile} for NODE_ENV=${this.NODE_ENV}`,
    );

    this.PORT = this.asInt("PORT", 3000);
    this.MONGODB_URI = this.asRequiredString("MONGODB_URI");
    this.JWT_SECRET = this.asRequiredString("JWT_SECRET");
    if (this.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters long");
    }
    this.JWT_EXPIRES_IN = this.asInt("JWT_EXPIRES_IN", 3600);
    this.JWT_REFRESH_EXPIRES_IN = this.asInt("JWT_REFRESH_EXPIRES_IN", 86400);
    this.COHERE_API_KEY = this.asRequiredString("COHERE_API_KEY");
    this.GEMINI_API_KEY = this.asRequiredString("GEMINI_API_KEY");
    this.GOOGLE_CLIENT_ID = this.asRequiredString("GOOGLE_CLIENT_ID");
  }

  public static get instance(): EnvConfig {
    if (!EnvConfig._instance) {
      EnvConfig._instance = new EnvConfig();
    }
    return EnvConfig._instance;
  }

  private asRequiredString<T extends string>(name: string): T {
    const value = process.env[name];
    if (!value) {
      throw new Error(
        `Missing environment variable: ${name} in ${this.NODE_ENV} file`,
      );
    }
    return value as T;
  }

  private asInt(name: string, placeholder: number): number {
    const valueAsString = process.env[name];
    if (!valueAsString) {
      return placeholder;
    }
    const value = parseInt(valueAsString);
    if (isNaN(value)) {
      throw new Error(`Invalid integer for ${name}: ${valueAsString}`);
    }
    return value;
  }
}
