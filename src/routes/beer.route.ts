import { Router } from "express";
import { BeerController } from "../controllers/beer.controller";

const router = Router();
const beerController = new BeerController();

/**
 * GET /api/beers/search/ai
 * AI search - parse natural language query
 */
router.get("/search/ai", (req, res) => beerController.aiSearch(req, res));

export { router as beerRouter };
