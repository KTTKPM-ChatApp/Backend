import { BadRequestException } from '@nestjs/common';
import { ConversationType } from '../enums/conversation-type.enum';

export class ConversationPolicyService {
  static normalizeParticipantIds(
    currentUserId: string,
    participantIds: string[],
  ): string[] {
    const cleanedParticipantIds = participantIds
      .map((participantId) => participantId.trim())
      .filter((participantId) => participantId.length > 0)
      .filter((participantId) => participantId !== currentUserId);

    return [...new Set(cleanedParticipantIds)];
  }

  static validateConversationInput(params: {
    currentUserId: string;
    type: ConversationType;
    title?: string;
    participantIds: string[];
  }): {
    normalizedTitle: string | null;
    directKey: string | null;
    memberIds: string[];
  } {
    const normalizedParticipants = this.normalizeParticipantIds(
      params.currentUserId,
      params.participantIds,
    );

    if (params.type === ConversationType.DIRECT) {
      if (normalizedParticipants.length !== 1) {
        throw new BadRequestException(
          'Direct conversations require exactly one other participant.',
        );
      }

      return {
        normalizedTitle: null,
        directKey: this.buildDirectKey([
          params.currentUserId,
          normalizedParticipants[0],
        ]),
        memberIds: [params.currentUserId, normalizedParticipants[0]],
      };
    }

    const normalizedTitle = params.title?.trim() ?? '';
    if (!normalizedTitle) {
      throw new BadRequestException('Group conversations require a title.');
    }

    if (normalizedParticipants.length < 2) {
      throw new BadRequestException(
        'Group conversations require at least two other participants.',
      );
    }

    return {
      normalizedTitle,
      directKey: null,
      memberIds: [params.currentUserId, ...normalizedParticipants],
    };
  }

  static buildDirectKey(userIds: [string, string]): string {
    const normalizedUserIds = userIds.map((userId) => userId.trim());

    if (
      normalizedUserIds[0].length === 0 ||
      normalizedUserIds[1].length === 0 ||
      normalizedUserIds[0] === normalizedUserIds[1]
    ) {
      throw new BadRequestException('Direct conversation members are invalid.');
    }

    return [...normalizedUserIds]
      .sort((left, right) => left.localeCompare(right))
      .join(':');
  }
}

