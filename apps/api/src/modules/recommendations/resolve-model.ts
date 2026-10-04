import type { AppPorts } from "../../infra/prisma-ports";
import type { RecommendationModel } from "./advise";
import type { KitchenChatModel } from "./chat";
import { createCodexKitchenChatModel, createCodexRecommendationModel } from "./codex-adapter";
import { createKitchenChatModel, createRecommendationModel } from "./openai-adapter";

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

export async function resolveKitchenChatModel(
  ports: AppPorts,
  userId: string,
  processModel: KitchenChatModel | null = createKitchenChatModel(),
): Promise<KitchenChatModel | null> {
  const login = await ports.findMemberLogin(userId);
  if (login?.sealedHome) {
    return createCodexKitchenChatModel({ sealedHome: login.sealedHome });
  }
  return processModel;
}
