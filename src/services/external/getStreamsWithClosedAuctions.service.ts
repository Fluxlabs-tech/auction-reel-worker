import axios, { AxiosResponse } from 'axios';
import { env } from '../../config/env';

export interface StreamsWithClosedAuctionsResponse {
  streams: Array<{
    stream_id: number;
    last_closed_at: string;
    auction_count: number;
  }>;
  next_cursor: string;
}

export const getStreamsWithClosedAuctionsService = async (
  closedAfter: string,
  limit: number = 200,
): Promise<StreamsWithClosedAuctionsResponse> => {
  let url: string;
  let headers: Record<string, string>;
  let response: AxiosResponse<StreamsWithClosedAuctionsResponse>;

  try {
    url = `${env.SHARE_LEADERBOARD_URL}/api/v1/auction/_internal/streams/with-closed-auctions`;
    headers = {
      ...(env.X_API_SIGN_TOKEN ? { 'x-api-sign-token': env.X_API_SIGN_TOKEN } : {}),
    };

    response = await axios.get<StreamsWithClosedAuctionsResponse>(url, {
      params: {
        closed_after: closedAfter,
        limit,
      },
      headers,
      timeout: 10000,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      '[getStreamsWithClosedAuctionsService] Error fetching closed streams:',
      error?.response?.data || error?.message || error,
      { closedAfter, limit },
    );
    throw error;
  }
};
