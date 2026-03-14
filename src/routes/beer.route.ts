import { Router } from "express";
import { BeerController } from "../controllers/beer.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const beerController = new BeerController();

/**
 * @swagger
 * /api/beers/search:
 *   get:
 *     summary: Search beers by name or brewery
 *     description: Returns paginated lexical/fuzzy matches ranked by relevance.
 *     tags:
 *       - Beers
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search text for beer name or brewery.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (default 1).
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Items per page (default 10).
 *     responses:
 *       200:
 *         description: Search results returned successfully.
 *       400:
 *         description: Invalid query parameters.
 *       500:
 *         description: Internal server error.
 */
router.get("/search", (req, res) => beerController.search(req, res));

/**
 * @swagger
 * /api/beers/ask:
 *   post:
 *     summary: Ask the beer sommelier
 *     description: Runs AI-powered beer recommendation based on a free-text prompt.
 *     tags:
 *       - Beers
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Natural language request for beer recommendations.
 *     responses:
 *       200:
 *         description: Recommendation generated successfully.
 *       400:
 *         description: Prompt is missing or invalid.
 *       401:
 *         description: Unauthorized.
 *       429:
 *         description: AI provider quota/rate limit reached.
 *       500:
 *         description: Internal server error during analysis.
 */
router.post("/ask", authMiddleware, (req, res) => beerController.ask(req, res));

export { router as beerRouter };
