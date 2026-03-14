import { ThinkingLevel } from "@google/genai";

export const AI_CONFIG = {
  COHERE: {
    MODEL: "embed-english-light-v3.0",
    DIMENSIONS: 384,
    BATCH_SIZE: 96,
    INPUT_TYPE_DOC: "search_document",
    INPUT_TYPE_QUERY: "search_query",
  },
  GEMINI: {
    MODEL: "gemini-3.1-flash-lite-preview",
    THINKING_LEVEL: ThinkingLevel.LOW,
    TEMPERATURE: 0.7,
  },
  DB: {
    VECTOR_INDEX_NAME: "vector_index",
    TOP_K: 5,
    NUM_CANDIDATES: 150,
  },
} as const;
