import { CohereClient } from "cohere-ai";
import { Beer, IBeer } from "../models/beer.model";
import { AI_CONFIG } from "../config/ai.config";
import { Document } from "mongoose";
import { GoogleGenAI } from "@google/genai";

export type RecommendationType =
  | "SINGLE_BEST"
  | "MULTIPLE_GOOD"
  | "CLOSE_ALTERNATIVES"
  | "NO_MATCH";

export type SommelierAnalysis = {
  isMatchFound: boolean;
  recommendationType: RecommendationType;
  explanation: string;
  topPickId: string | null;
  recommendedIds: string[];
};
type BeerReturn = Omit<IBeer, Exclude<keyof Document, "_id">>;

class AIService {
  private readonly _cohere: CohereClient;
  private readonly _gemini: GoogleGenAI;

  constructor() {
    this._cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });
    this._gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async getSmartBeerSearch(
    userPrompt: string,
  ): Promise<{ analysis: SommelierAnalysis; beers: BeerReturn[] }> {
    // 1. Vectorize prompt using Cohere
    const queryVector = await this.generateVector(userPrompt);

    // 2. Database Retrieval (uses searchBlob implicitly via the index)
    const beers = await this.retrieveBeers(queryVector);

    if (beers.length === 0) {
      return {
        analysis: {
          isMatchFound: false,
          recommendationType: "NO_MATCH",
          explanation: "No matches in the cellar.",
          topPickId: null,
          recommendedIds: [],
        },
        beers: [],
      };
    }

    // 3. Expert Analysis using Gemini
    const analysis = await this.analyzeBeers(userPrompt, beers);

    return {
      analysis,
      beers: analysis.isMatchFound ? beers : [],
    };
  }

  private async generateVector(text: string) {
    const response = await this._cohere.v2.embed({
      texts: [text],
      model: AI_CONFIG.COHERE.MODEL,
      inputType: AI_CONFIG.COHERE.INPUT_TYPE_QUERY,
      embeddingTypes: ["float"],
    });
    if (!response.embeddings?.float) {
      throw new Error("Cohere embed response is missing float embeddings");
    }
    return response.embeddings.float[0];
  }

  private async retrieveBeers(vector: number[]): Promise<BeerReturn[]> {
    return await Beer.aggregate([
      {
        $vectorSearch: {
          index: AI_CONFIG.DB.VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector: vector,
          numCandidates: AI_CONFIG.DB.NUM_CANDIDATES,
          limit: AI_CONFIG.DB.TOP_K,
        },
      },
      { $project: { embedding: 0, searchBlob: 0, __v: 0 } },
    ]);
  }

  private async analyzeBeers(
    userQuery: string,
    searchResults: BeerReturn[],
  ): Promise<SommelierAnalysis> {
    const sommelierPersona = `
        POV: You are the 'BEERanking Master Sommelier.' 
        TONE: Sophisticated, authoritative, but approachable. 
        STRATEGY: You bridge the gap between technical data and human enjoyment.
    `;

    const domainKnowledge = `
        DATA CATEGORIES:
        - Taste: Sweet, Bitter, Sour, Salty (normalized K=15).
        - Aroma/Flavor: Fruits, Hoppy, Spices, Malty, Astringency (normalized K=35).
        - Mouthfeel: Body, Alcohol (Heat) (normalized K=30).
        - Facts: Name, Brewery, Description, Style, ABV.
    `;

    const matchTypeInstructions = `
        MATCH TYPE DEFINITIONS:
        1. 'SINGLE_BEST': One beer perfectly aligns with the user's specific adjectives (e.g., they asked for "bitter" and one beer has a Bitter score > 8.0).
        2. 'MULTIPLE_GOOD': Several beers fit the request well. Compare them so the user can choose.
        3. 'CLOSE_ALTERNATIVES': No beer is an exact match (e.g., they want a "Sour Stout" but we only have "Dry Stouts"). Acknowledge the gap but suggest the closest profile.
        4. 'NO_MATCH': The request is irrelevant to beer or the results are completely off-base.
    `;

    const context = searchResults.map((b) => ({
      id: b._id.toString(),
      identity: {
        name: b.name,
        brewery: b.brewery,
        style: b.style,
        abv: `${b.abv}%`,
        description: b.description,
      },
      profile: b.normalizedProfileScores,
    }));

    // 2. Define the JSON Schema for Controlled Generation
    const responseSchema = {
      type: "OBJECT",
      properties: {
        isMatchFound: {
          type: "BOOLEAN",
          description:
            "Set to false if results are totally irrelevant to the query.",
        },
        recommendationType: {
          type: "STRING",
          enum: [
            "SINGLE_BEST",
            "MULTIPLE_GOOD",
            "CLOSE_ALTERNATIVES",
            "NO_MATCH",
          ],
        },
        explanation: {
          type: "STRING",
          description:
            "Your sommelier analysis. Mention specific Facts and Sensory scores.",
        },
        topPickId: {
          type: "STRING",
          nullable: true,
          description:
            "The ID of the single best beer. Null if it's a tie or no match.",
        },
        recommendedIds: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "All beer IDs mentioned in the explanation.",
        },
      },
      required: [
        "isMatchFound",
        "recommendationType",
        "explanation",
        "recommendedIds",
      ],
    };

    try {
      const response = await this._gemini.models.generateContent({
        model: AI_CONFIG.GEMINI.MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
                    ${sommelierPersona}
                    ${domainKnowledge}
                    ${matchTypeInstructions}
                    
                    USER REQUEST: "${userQuery}"
                    DATABASE RESULTS: ${JSON.stringify(context)}

                    INSTRUCTIONS:
                    - Determine the Match Type first.
                    - If 'SINGLE_BEST', justify why that one beer stands above the rest.
                    - If 'CLOSE_ALTERNATIVES', start with: "I couldn't find an exact match, but here is what I recommend based on your preferences..."
                    `,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: AI_CONFIG.GEMINI.TEMPERATURE,
          thinkingConfig: { thinkingLevel: AI_CONFIG.GEMINI.THINKING_LEVEL },
        },
      });

      if (!response.text) {
        throw new Error("Gemini response is missing text content");
      }

      return JSON.parse(response.text);
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return {
        isMatchFound: false,
        recommendationType: "NO_MATCH",
        explanation: "The cellar is currently closed for maintenance.",
        recommendedIds: [],
        topPickId: null,
      };
    }
  }
}

export const aiService = new AIService();
