import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["./jest.setup.ts"],
  roots: ["<rootDir>/src/tests/"],
};

export = config;
