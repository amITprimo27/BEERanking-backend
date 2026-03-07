import multer, { FileFilterCallback } from "multer";
import * as path from "path";
import * as fs from "fs";
import { Request, Response, NextFunction } from "express";
import { UPLOADS_DIR } from "../utils/paths.utils";

export type FileRequest = Request & { file?: Express.Multer.File };

const uploadDir = UPLOADS_DIR;

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${timestamp}-${name}${ext}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  // Allowed MIME types
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, png, gif, webp) are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * Middleware wrapper that auto-cleans up uploaded files on error responses
 */
export const uploadProfilePic = {
  single: (fieldName: string) => {
    return [
      upload.single(fieldName),
      (req: Request, res: Response, next: NextFunction) => {
        const originalJson = res.json.bind(res);
        const originalStatus = res.status.bind(res);

        let statusCode = 200;

        // Intercept status setter
        res.status = function (code: number) {
          statusCode = code;
          return originalStatus(code);
        };

        // Intercept json response
        res.json = function (body: any) {
          // If error response (4xx or 5xx) and file was uploaded, clean it up
          if (statusCode >= 400 && (req as FileRequest).file) {
            const file = (req as FileRequest).file!;
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
          return originalJson(body);
        };

        next();
      },
    ];
  },
};
