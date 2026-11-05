import { getPubSubClient } from './pubSubClient';
import { env } from '../../../config/env';

export type AuctionReelEventStatus = 'DONE' | 'SKIPPED' | 'FAILED';

export interface AuctionReelEventCounts {
  total: number;
  completed?: number;
  done?: number;
  needs_review?: number;
  failed: number;
  skipped?: number;
}

export interface AuctionReelEventPayload {
  event?: string;
  status: AuctionReelEventStatus;
  stream_id: number;
  counts?: AuctionReelEventCounts;
  reason?: string;
  error?: string;
  retry_count?: number;
  timestamp?: string;
}

export const publishAuctionReelEventService = async (
  payload: AuctionReelEventPayload,
  customTopic?: string,
): Promise<string | null> => {
  let client: any;
  let topicName: string;
  let fullPayload: Record<string, any>;
  let dataBuffer: Buffer;
  let messageId: string | null = null;

  try {
    topicName = customTopic || env.AUCTION_REEL_PUBSUB_TOPIC || 'auction-reel-events';
    fullPayload = {
      event: payload.event || 'auction_reel_status_updated',
      timestamp: payload.timestamp || new Date().toISOString(),
      ...payload,
    };

    client = getPubSubClient();
    dataBuffer = Buffer.from(JSON.stringify(fullPayload));

    messageId = await client.topic(topicName).publishMessage({ data: dataBuffer });

    console.log(
      `[publishAuctionReelEventService] Published event to topic=${topicName} ` +
        `status=${payload.status} stream_id=${payload.stream_id} messageId=${messageId}`,
    );

    return messageId;
  } catch (error: any) {
    console.error(
      '[publishAuctionReelEventService] Failed to publish event:',
      error?.message || error,
      {
        topic: customTopic || env.AUCTION_REEL_PUBSUB_TOPIC,
        status: payload.status,
        stream_id: payload.stream_id,
      },
    );
    return null;
  }
};
