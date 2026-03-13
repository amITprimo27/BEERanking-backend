import { Request, Response } from "express";
import { PipelineStage } from "mongoose";
import { Beer, IBeer } from "../models/beer.model";
import { BaseController } from "./base.controller";

export class BeerController extends BaseController<IBeer> {
  constructor() {
    super(Beer);
  }

  private escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  async search(req: Request, res: Response) {
    const startedAt = Date.now();

    try {
      const { page, limit, skip } = this.getPaginationParams(req);
      const normalizedQuery = String(req.query.q ?? "").trim();

      if (!normalizedQuery || normalizedQuery.length < 2) {
        this.throwHttpError(
          400,
          "Query parameter 'q' must be at least 2 characters",
        );
      }
      const escapedQuery = this.escapeRegex(normalizedQuery);

      const scoringPipeline: PipelineStage[] = [
        {
          $addFields: {
            nameLower: { $toLower: "$name" },
            breweryLower: { $toLower: "$brewery" },
          },
        },
        {
          $addFields: {
            exactName: { $eq: ["$nameLower", normalizedQuery] },
            exactBrewery: { $eq: ["$breweryLower", normalizedQuery] },
            prefixName: {
              $regexMatch: { input: "$nameLower", regex: `^${escapedQuery}` },
            },
            prefixBrewery: {
              $regexMatch: {
                input: "$breweryLower",
                regex: `^${escapedQuery}`,
              },
            },
            fuzzyName: {
              $regexMatch: { input: "$nameLower", regex: escapedQuery },
            },
            fuzzyBrewery: {
              $regexMatch: { input: "$breweryLower", regex: escapedQuery },
            },
          },
        },
        {
          $addFields: {
            score: {
              $add: [
                { $cond: ["$exactName", 120, 0] },
                { $cond: ["$exactBrewery", 100, 0] },
                { $cond: ["$prefixName", 60, 0] },
                { $cond: ["$prefixBrewery", 50, 0] },
                { $cond: ["$fuzzyName", 25, 0] },
                { $cond: ["$fuzzyBrewery", 20, 0] },
              ],
            },
            matchReason: {
              $switch: {
                branches: [
                  { case: "$exactName", then: "exact_name" },
                  { case: "$exactBrewery", then: "exact_brewery" },
                  { case: "$prefixName", then: "prefix_name" },
                  { case: "$prefixBrewery", then: "prefix_brewery" },
                  { case: "$fuzzyName", then: "fuzzy_name" },
                  { case: "$fuzzyBrewery", then: "fuzzy_brewery" },
                ],
                default: "none",
              },
            },
          },
        },
        {
          $match: {
            score: { $gt: 0 },
          },
        },
      ];

      const pipeline: PipelineStage[] = [
        ...scoringPipeline,
        {
          $project: {
            _id: 1,
            name: 1,
            brewery: 1,
            style: 1,
            abv: 1,
            description: 1,
            score: 1,
            matchReason: 1,
          },
        },
        { $sort: { score: -1, name: 1 } },
        { $skip: skip },
        { $limit: limit },
      ];

      type SearchRow = {
        _id: string;
        name: string;
        brewery: string;
        style: string;
        abv: number;
        description: string;
        score: number;
        matchReason: string;
      };

      const [rows, totalRows] = await Promise.all([
        Beer.aggregate<SearchRow>(pipeline),
        Beer.aggregate<{ total: number }>([
          ...scoringPipeline,
          { $count: "total" },
        ]),
      ]);

      const total = totalRows[0]?.total ?? 0;

      const data = rows.map((row) => ({
        beerId: row._id,
        name: row.name,
        brewery: row.brewery,
        style: row.style,
        abv: row.abv,
        description: row.description,
        score: row.score,
        matchReason: row.matchReason,
      }));

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
      ) {
        return res
          .status((error as { status: number }).status)
          .json({ error: error.message });
      }

      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  /**
   * Phase 1 AI endpoint stub. Retrieval + generation will be implemented in Phase 2.
   */
  async ask(_req: Request, res: Response) {
    return res.status(501).json({
      error: "AI ask is not implemented yet.",
      nextStep: "Implement retrieval + LLM response in Phase 2",
    });
  }
}
