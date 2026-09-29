import type { AppPorts } from "../../infra/prisma-ports";
import type { RecommendationModel } from "./advise";
import { createCodexRecommendationModel } from "./codex-adapter";
import { createRecommendationModel } from "./openai-adapter";

export async function resolveRecommendationModel(
  ports: AppPorts,
  userId: string,
  processModel: RecommendationModel | null = createRecommendationModel(),
): Promise<RecommendationModel | null> {
  const login = await ports.findMemberLogin(userId);
  if (login?.sealedHome) {
    return createCodexRecommendationModel({ sealedHome: login.sealedHome });
  }
  return processModel;
}
