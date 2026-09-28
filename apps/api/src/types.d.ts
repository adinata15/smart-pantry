import type { PublicUser } from "@smart-pantry/contracts";

declare module "fastify" {
  interface FastifyRequest {
    user: PublicUser | null;
  }
}
