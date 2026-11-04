import axios, { AxiosResponse } from 'axios';
import { env } from '../../config/env';

export interface StreamSummaryResponse {
  stream_id: number;
  stream_duration?: number;
  rehearsal?: boolean;
  store_identifier?: string;
  seller_id?: number | string;
  seller_store_name?: string;
  category?: string;
  title?: string;
  status?: string;
}

export const getStreamSummaryService = async (streamId: number): Promise<StreamSummaryResponse> => {
  let url: string;
  let headers: Record<string, string>;
  let response: AxiosResponse<StreamSummaryResponse>;

  try {
    url = `${env.LIVESTREAM_URL}/api/stream-details/internal/${streamId}/summary`;
    headers = {
      ...(env.X_API_SIGN_TOKEN ? { 'x-api-sign-token': env.X_API_SIGN_TOKEN } : {}),
    };

    response = await axios.get<StreamSummaryResponse>(url, {
      headers,
      timeout: 10000,
    });

    return response.data;
  } catch (error: any) {
    console.error(
      '[getStreamSummaryService] Error fetching stream summary:',
      error?.response?.data || error?.message || error,
      { streamId },
    );
    throw error;
  }
};
