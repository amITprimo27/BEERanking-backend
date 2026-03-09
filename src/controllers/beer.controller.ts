import { Request, Response } from "express";
import { Beer, IBeer } from "../models/beer.model";
import { BaseController } from "./base.controller";

export class BeerController extends BaseController<IBeer> {
  constructor() {
    super(Beer);
  }

  /**
   * Search beers by AI query
   * Parses user natural language query and searches by profile scores
   */
  async aiSearch(req: Request, res: Response) {
    // TODO: Implement AI search
    // - Parse natural language query
    // - Map keywords to profile scores
    // - Search and sort by matching attributes
    res.json({ message: "AI search", data: [] });
  }
}
