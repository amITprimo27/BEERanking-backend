import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middlewares/auth.middleware";

class ControllerHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class BaseController<T> {
  constructor(protected model: mongoose.Model<T>) {}

  //#region Common helpers
  protected isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
  }

  protected getErrorStatus(error: any): number {
    if (error instanceof mongoose.Error.ValidationError) return 400;
    if (error instanceof mongoose.Error.CastError) return 400;
    if (error.name === "ValidationError") return 400;
    if (error.name === "CastError") return 400;
    if (error.code === 11000) return 409; // Duplicate key error
    return 500;
  }

  protected throwHttpError(status: number, message: string): never {
    throw new ControllerHttpError(status, message);
  }

  protected requireAuthenticatedUser(req: AuthRequest): string {
    const userId = req.user?._id;

    if (!userId) {
      this.throwHttpError(401, "Unauthorized");
    }

    return userId;
  }

  private parseQueryInt(value: unknown, defaultValue: number): number {
    if (typeof value === "string") {
      const parsed = parseInt(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }
  //#endregion

  //#region Read (GET)
  protected async fetchById(id: string) {
    return this.model.findById(id);
  }

  protected customizeQuery(query: mongoose.Query<Array<T>, T>) {
    return query;
  }

  protected async getPaginated(
    req: Request,
    res: Response,
    additionalFilter: mongoose.FilterQuery<T> = {},
  ) {
    try {
      const page = this.parseQueryInt(req.query.page, 1);
      const limit = this.parseQueryInt(req.query.limit, 10);
      const skip = (page - 1) * limit;

      const { page: _, limit: __, ...queryFilter } = req.query;
      const combinedFilter = { ...queryFilter, ...additionalFilter };

      const query = this.model.find(combinedFilter).limit(limit).skip(skip);
      const data = await this.customizeQuery(query);

      const total = await this.model.countDocuments(combinedFilter);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      const status = this.getErrorStatus(error);
      res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  async get(req: Request, res: Response) {
    return this.getPaginated(req, res);
  }

  async getById(req: Request, res: Response) {
    const id = req.params.id;

    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const data = await this.fetchById(id);
      if (!data) {
        return res.status(404).json({ error: "Data not found" });
      }
      res.json(data);
    } catch (error) {
      const status = this.getErrorStatus(error);
      res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
  //#endregion

  //#region Create (POST)
  protected async authorizeCreate(req: Request): Promise<void> {
    this.requireAuthenticatedUser(req);
  }

  protected async validateCreate(_req: Request): Promise<void> {}

  protected async buildCreateData(req: Request): Promise<Partial<T>> {
    return req.body;
  }

  protected async formatCreateResponse(created: T): Promise<unknown> {
    return created;
  }

  async post(req: Request, res: Response) {
    try {
      await this.authorizeCreate(req);
      await this.validateCreate(req);

      const createData = await this.buildCreateData(req);
      const created = await this.model.create(createData);
      const responseBody = await this.formatCreateResponse(created);

      return res.status(201).json(responseBody);
    } catch (error) {
      if (error instanceof ControllerHttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
  //#endregion

  //#region Delete (DELETE)
  protected async fetchForDelete(id: string) {
    return this.model.findById(id);
  }

  protected async authorizeDelete(req: Request, _entity: T): Promise<void> {
    this.requireAuthenticatedUser(req);
  }

  protected async beforeDelete(_req: Request, _entity: T): Promise<void> {
    // no-op by default
  }

  protected async afterDelete(_req: Request, _entity: T): Promise<void> {
    // no-op by default
  }

  protected async deleteById(id: string) {
    return this.model.findByIdAndDelete(id);
  }

  async del(req: Request, res: Response) {
    const id = req.params.id;

    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const entity = await this.fetchForDelete(id);
      if (!entity) {
        return res.status(404).json({ error: "Data not found" });
      }

      await this.authorizeDelete(req, entity);
      await this.beforeDelete(req, entity);

      const response = await this.deleteById(id);
      if (!response) {
        return res.status(404).json({ error: "Data not found" });
      }

      await this.afterDelete(req, entity);

      return res.json(response);
    } catch (error) {
      if (error instanceof ControllerHttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
  //#endregion

  //#region Update (PATCH)
  protected async authorizeUpdate(
    _req: Request,
    _entity: T,
  ): Promise<void> {
    this.requireAuthenticatedUser(_req);
  }

  protected async validatePatch(
    _req: Request,
    _entity: T,
  ): Promise<void> {
    // no-op by default
  }

  protected async beforePatch(
    _req: Request,
    _id: string,
    _entity: T,
  ): Promise<void> {
    // no-op by default
  }

  protected async buildPatchData(
    _req: Request,
    _id: string,
  ): Promise<Partial<T>> {
    return _req.body;
  }

  protected async afterPatch(
    _req: Request,
    _oldEntity: T,
    _updatedEntity: T,
  ): Promise<void> {
    // no-op by default
  }

  protected async formatPatchResponse(updated: T): Promise<unknown> {
    return updated;
  }

  // PATCH - partial update
  async patch(req: Request, res: Response) {
    const id = req.params.id;

    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      // Fetch entity before update to pass to hooks
      const entity = await this.model.findById(id);
      if (!entity) {
        return res.status(404).json({ error: "Data not found" });
      }

      await this.authorizeUpdate(req, entity);
      await this.validatePatch(req, entity);
      await this.beforePatch(req, id, entity);

      const patchData = await this.buildPatchData(req, id);

      const response = await this.model.findByIdAndUpdate(
        id,
        { $set: patchData },
        {
          new: true,
          runValidators: true, // Run schema validators
        },
      );
      if (!response) {
        return res.status(404).json({ error: "Data not found" });
      }

      await this.afterPatch(req, entity, response);

      const responseBody = await this.formatPatchResponse(response);
      return res.json(responseBody);
    } catch (error) {
      if (error instanceof ControllerHttpError) {
        return res.status(error.status).json({ error: error.message });
      }

      const status = this.getErrorStatus(error);
      return res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
  //#endregion
}
