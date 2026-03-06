import { Request, Response } from "express";
import mongoose from "mongoose";

export class BaseController<T> {
  constructor(protected model: mongoose.Model<T>) {}

  // Helper to validate MongoDB ObjectId
  protected isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
  }

  // Helper to determine error status code
  protected getErrorStatus(error: any): number {
    if (error instanceof mongoose.Error.ValidationError) return 400;
    if (error instanceof mongoose.Error.CastError) return 400;
    if (error.name === "ValidationError") return 400;
    if (error.name === "CastError") return 400;
    return 500;
  }

  async get(req: Request, res: Response) {
    try {
      // Optional pagination support
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Remove pagination params from filter
      const { page: _, limit: __, ...queryFilter } = req.query;

      const data = await this.model.find(queryFilter).limit(limit).skip(skip);

      // Include total count for pagination
      const total = await this.model.countDocuments(queryFilter);

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

  async getById(req: Request, res: Response) {
    const id = req.params.id;

    // Validate ObjectId format first
    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const data = await this.model.findById(id);
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

  async post(req: Request, res: Response) {
    const obj = req.body;
    try {
      const response = await this.model.create(obj);
      res.status(201).json(response);
    } catch (error) {
      const status = this.getErrorStatus(error);
      res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  async del(req: Request, res: Response) {
    const id = req.params.id;

    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const response = await this.model.findByIdAndDelete(id);
      if (!response) {
        return res.status(404).json({ error: "Data not found" });
      }
      res.json(response);
    } catch (error) {
      const status = this.getErrorStatus(error);
      res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  // PUT - full document replacement
  async put(req: Request, res: Response) {
    const id = req.params.id;
    const obj = req.body;

    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const response = await this.model.findByIdAndUpdate(id, obj, {
        new: true,
        overwrite: true, // Replace entire document
        runValidators: true, // Run schema validators
      });
      if (!response) {
        return res.status(404).json({ error: "Data not found" });
      }
      res.json(response);
    } catch (error) {
      const status = this.getErrorStatus(error);
      res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }

  // PATCH - partial update
  async patch(req: Request, res: Response) {
    const id = req.params.id;
    const obj = req.body;

    if (!this.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const response = await this.model.findByIdAndUpdate(
        id,
        { $set: obj },
        {
          new: true,
          runValidators: true, // Run schema validators
        },
      );
      if (!response) {
        return res.status(404).json({ error: "Data not found" });
      }
      res.json(response);
    } catch (error) {
      const status = this.getErrorStatus(error);
      res.status(status).json({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    }
  }
}
