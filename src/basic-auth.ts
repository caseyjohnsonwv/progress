import type { Request, Response, NextFunction } from "express";

function decodeCredentials(headerValue: string): { username: string; password: string } | null {
  if (!headerValue.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = headerValue.slice(6);
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function createBasicAuthMiddleware(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const credentials = decodeCredentials(req.headers.authorization ?? "");
    const isAuthorized =
      credentials !== null && credentials.username === username && credentials.password === password;

    if (!isAuthorized) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Calorie Tracker"');
      res.status(401).json({
        error: "unauthorized",
        message: "authentication required",
      });
      return;
    }

    next();
  };
}
