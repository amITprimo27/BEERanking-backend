import { Request, Response } from "express";
import { Beer, IBeer } from "../models/beer.model";
import { BaseController } from "./base.controler";

export class BeerController extends BaseController<IBeer> {
  constructor() {
    super(Beer);
  }

  /**
   * Search beers by AI query
   * Parses user natural language query and searches by profile scores
   */
  async aiSearch(req: Request, res: Response) {}
}
