import express, { Express } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import specs from "./swagger";
import { beerRouter } from "./routes/beer.route";
import { postRouter } from "./routes/post.routes";
import { userRouter } from "./routes/user.route";
import { authRouter } from "./routes/auth.routes";

const app = express();

dotenv.config({ path: "/env/.env.dev" });

const intApp = () => {
  const promise = new Promise<Express>((resolve, reject) => {
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // Routes
    app.use("/uploads", express.static("public/uploads"));

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
      }),
    );

    // Swagger JSON endpoint
    apiRouter.get("/docs.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(specs);
    });

    app.use("/api", apiRouter);

    //TODO: react app static files

    const dbUri = process.env.MONGODB_URI;

    if (!dbUri) {
      console.error("MONGODB_URI is not defined in the environment variables.");
      reject(new Error("MONGODB_URI is not defined"));
    } else {
      mongoose.connect(dbUri, {}).then(() => {
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

export default intApp;
