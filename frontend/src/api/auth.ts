import { apiClient } from './axiosConfig';

export interface QrInitiateResponse {
  sessionCode: string;
  pollToken: string;
  expiresIn: number;
}

export interface QrStatusResponse {
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
  accessToken?: string;
  expiresIn?: number;
}

export const initiateQrSession = async (rememberMe = false): Promise<QrInitiateResponse> => {
  const res = await apiClient.post('/auth/qr/initiate', { rememberMe });
  return res.data;
};

export const pollQrStatus = async (
  sessionCode: string,
  pollToken: string
): Promise<QrStatusResponse> => {
  const res = await apiClient.get(`/auth/qr/status/${sessionCode}`, {
    headers: { 'X-Poll-Token': pollToken },
  });
  return res.data;
};
