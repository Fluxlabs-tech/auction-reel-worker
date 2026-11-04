import axios, { AxiosResponse } from 'axios';
import { env } from '../../config/env';

export interface AuctionBidRecord {
  submitted_at: string;
  amount: string | number;
  bidder_display_name: string;
}

export interface AuctionWinnerRecord {
  slot_rank: number;
  winning_amount: string | number;
  display_name: string;
}

export interface StreamAuctionItem {
  auction_id: string;
  product_id: number;
  varient_id?: number;
  status: string; // 'settled' | 'closed' | 'open' | etc.
  close_reason: string;
  starting_price: string | number;
  currency: string;
  closing_rule_type: string;
  closing_rule_config: {
    duration_seconds: number;
  };
  started_at: string;
  ends_at: string;
  closed_at: string;
  extension_used_ms: number;
  extension_window_ms?: number;
  winner_count: number;
  bids: AuctionBidRecord[];
  winner: AuctionWinnerRecord | null;
}

export interface StreamAuctionTimelineResponse {
  stream_id: number;
  extension_window_ms: number;
  auctions: StreamAuctionItem[];
}

export const getStreamAuctionTimelineService = async (
  streamId: number,
): Promise<StreamAuctionTimelineResponse> => {
  let url: string;
  let headers: Record<string, string>;
  let response: AxiosResponse<StreamAuctionTimelineResponse>;

  try {
    url = `${env.SHARE_LEADERBOARD_URL}/api/v1/auction/_internal/streams/${streamId}/timeline`;
    headers = {
      ...(env.X_API_SIGN_TOKEN ? { 'x-api-sign-token': env.X_API_SIGN_TOKEN } : {}),
    };

    response = await axios.get<StreamAuctionTimelineResponse>(url, {
      headers,
      timeout: 10000,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      '[getStreamAuctionTimelineService] Error fetching auction timeline:',
      error?.response?.data || error?.message || error,
      { streamId },
    );
    throw error;
  }
};
