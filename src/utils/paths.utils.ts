import * as path from "path";

export const PUBLIC_DIR = path.join(process.cwd(), "public");
export const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
export const UPLOADS_ROUTE_PREFIX = "/uploads/";

export const toPublicAbsolutePath = (publicRelativePath: string) => {
  const normalized = publicRelativePath.replace(/^\/+/, "");
  return path.join(PUBLIC_DIR, normalized);
};
