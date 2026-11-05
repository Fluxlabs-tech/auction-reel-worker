import {
  publishAuctionReelEventService,
  AuctionReelEventPayload,
} from '../../src/services/external/pubsub/publishAuctionReelEvent.service';
import * as pubSubClientModule from '../../src/services/external/pubsub/pubSubClient';

jest.mock('../../src/services/external/pubsub/pubSubClient');

describe('publishAuctionReelEventService', () => {
  let mockPublishMessage: jest.Mock;
  let mockTopic: jest.Mock;
  let mockPubSub: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishMessage = jest.fn().mockResolvedValue('msg-id-12345');
    mockTopic = jest.fn().mockReturnValue({
      publishMessage: mockPublishMessage,
    });
    mockPubSub = {
      topic: mockTopic,
    };
    (pubSubClientModule.getPubSubClient as jest.Mock).mockReturnValue(mockPubSub);
  });

  it('publishes a DONE stream-level event with counts', async () => {
    const payload: AuctionReelEventPayload = {
      status: 'DONE',
      stream_id: 70277,
      counts: {
        total: 3,
        completed: 3,
        failed: 0,
      },
    };

    const messageId = await publishAuctionReelEventService(payload);

    expect(messageId).toBe('msg-id-12345');
    expect(mockTopic).toHaveBeenCalledWith('auction-reel-events');
    expect(mockPublishMessage).toHaveBeenCalledTimes(1);

    const callArg = mockPublishMessage.mock.calls[0][0];
    const decoded = JSON.parse(callArg.data.toString());

    expect(decoded.status).toBe('DONE');
    expect(decoded.stream_id).toBe(70277);
    expect(decoded.counts).toEqual({ total: 3, completed: 3, failed: 0 });
    expect(decoded.lots).toBeUndefined();
    expect(decoded.event).toBe('auction_reel_status_updated');
    expect(decoded.timestamp).toBeDefined();
  });

  it('publishes a SKIPPED event with reason', async () => {
    const payload: AuctionReelEventPayload = {
      status: 'SKIPPED',
      stream_id: 70277,
      reason: 'no_auctions',
    };

    const messageId = await publishAuctionReelEventService(payload);

    expect(messageId).toBe('msg-id-12345');
    expect(mockPublishMessage).toHaveBeenCalledTimes(1);

    const callArg = mockPublishMessage.mock.calls[0][0];
    const decoded = JSON.parse(callArg.data.toString());

    expect(decoded.status).toBe('SKIPPED');
    expect(decoded.reason).toBe('no_auctions');
    expect(decoded.stream_id).toBe(70277);
  });

  it('publishes a FAILED event with error and retry count', async () => {
    const payload: AuctionReelEventPayload = {
      status: 'FAILED',
      stream_id: 70277,
      error: 'ffmpeg exited with code 1',
      retry_count: 3,
    };

    const messageId = await publishAuctionReelEventService(payload);

    expect(messageId).toBe('msg-id-12345');
    expect(mockPublishMessage).toHaveBeenCalledTimes(1);

    const callArg = mockPublishMessage.mock.calls[0][0];
    const decoded = JSON.parse(callArg.data.toString());

    expect(decoded.status).toBe('FAILED');
    expect(decoded.error).toBe('ffmpeg exited with code 1');
    expect(decoded.retry_count).toBe(3);
  });

  it('allows custom topic override', async () => {
    const payload: AuctionReelEventPayload = {
      status: 'DONE',
      stream_id: 70277,
    };

    await publishAuctionReelEventService(payload, 'custom-notifications-topic');

    expect(mockTopic).toHaveBeenCalledWith('custom-notifications-topic');
  });

  it('gracefully handles publish failure without throwing', async () => {
    mockPublishMessage.mockRejectedValueOnce(new Error('PubSub connection error'));

    const payload: AuctionReelEventPayload = {
      status: 'FAILED',
      stream_id: 70277,
      error: 'fatal',
    };

    const result = await publishAuctionReelEventService(payload);
    expect(result).toBeNull();
  });
});
