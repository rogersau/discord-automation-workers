export interface RouteHandler {
  (request: Request): Promise<Response | null>;
}

export function createPublicRoutes(): RouteHandler {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return null;
  };
}
