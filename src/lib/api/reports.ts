import { apiClient } from '@/lib/api/client';
import type { ListParams } from '@/lib/api/resource';
import type { PaginatedResult, ReportRow, ReportType, StatMetric, TrendPoint } from '@/types';

export interface ReportResponse {
  stats: StatMetric[];
  trend: TrendPoint[];
  topItems: TrendPoint[];
  rows: PaginatedResult<ReportRow>;
}

export const reportsApi = {
  get: (type: ReportType, params?: ListParams) => {
    const searchParams = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    return apiClient.get<ReportResponse>(`/reports/${type}${suffix}`);
  },
};
