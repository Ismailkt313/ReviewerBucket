import { CommunityRepository } from "./community.repository";
import { validateMessageContent } from "./community.validation";
import { env } from "../../config/env";
import type { InternalCommunityMessage } from "./community.types";

export class CommunityService {
  private repository = new CommunityRepository();

  async submitMessage(content: unknown, anonymousClientId?: string): Promise<
    | { success: true; message: InternalCommunityMessage }
    | { success: false; error: string }
  > {
    const validation = validateMessageContent(content);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const message = await this.repository.create(validation.content, anonymousClientId);
      return { success: true, message };
    } catch {
      return { success: false, error: "Failed to save message" };
    }
  }

  async getRecentHistory(): Promise<InternalCommunityMessage[]> {
    return this.repository.getRecentMessages(env.COMMUNITY_HISTORY_LIMIT);
  }
}
