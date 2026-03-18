import express, { Express } from "express";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import specs from "./swagger";
import { beerRouter } from "./routes/beer.route";
import { postRouter } from "./routes/post.routes";
import { userRouter } from "./routes/user.route";
import { authRouter } from "./routes/auth.routes";
import { UPLOADS_DIR } from "./utils/paths.utils";
import { ensureVectorIndex } from "./scripts/vector-index";
import { EnvConfig } from "./config/env.config";
import path from "path";

const app = express();

const initApp = () => {
  const promise = new Promise<Express>((resolve, reject) => {
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // Routes
    app.use("/uploads", express.static(UPLOADS_DIR));

    const apiRouter = express.Router();
    apiRouter.use("/beers", beerRouter);
    apiRouter.use("/posts", postRouter);
    apiRouter.use("/users", userRouter);
    apiRouter.use("/auth", authRouter);

    // Swagger UI
    // Swagger Documentation
    apiRouter.use(
      "/docs",
      swaggerUi.serve,
      swaggerUi.setup(specs, {
        explorer: true,
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "BEERanking API Docs",
        swaggerOptions: {
          persistAuthorization: true,
        },
      }),
    );

    // Swagger JSON endpoint
    apiRouter.get("/docs.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(specs);
    });

    app.use("/api", apiRouter);

    app.use("/", express.static("public/BEERanking-frontend/dist"));

    app.get(/.*/, (req, res) => {
      res.sendFile(
        path.resolve(
          __dirname,
          "../public/BEERanking-frontend/dist/index.html",
        ),
      );
    });
    console.log("Express app configured with routes and Swagger UI.");

    const dbUri = EnvConfig.instance.MONGODB_URI;

    if (!dbUri) {
      console.error("MONGODB_URI is not defined in the environment variables.");
      reject(new Error("MONGODB_URI is not defined"));
    } else {
      mongoose.connect(dbUri, {}).then(async () => {
        // This ensures the index exists as soon as the DB connects
        await ensureVectorIndex();
        resolve(app);
      });
    }

    const db = mongoose.connection;
    db.on("error", (error) => {
      console.error(error);
    });

    db.once("open", () => {
      console.log("Connected to MongoDB");
    });
  });
  return promise;
};

export default initApp;
