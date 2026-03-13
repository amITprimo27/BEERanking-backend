import { Router } from "express";
import { BeerController } from "../controllers/beer.controller";

const router = Router();
const beerController = new BeerController();

/**
 * GET /api/beers/search
 * lexical/fuzzy search by name and brewery.
 */
router.get("/search", (req, res) => beerController.search(req, res));

/**
 * POST /api/beers/ask
 * Phase 1 AI route stub.
 */
router.post("/ask", (req, res) => beerController.ask(req, res));

export { router as beerRouter };
