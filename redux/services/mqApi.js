'use client';

import { baseApi } from './baseApi';
import { ENDPOINTS } from '@/config/api';

/**
 * RabbitMQ Management köprüsü → tinnten-server /mq/cms.
 * Kuyruk derinlikleri, tüketiciler (worker'lar) ve bağlantılar (salt-okunur).
 */
export const mqApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMqOverview: build.query({
      query: () => ENDPOINTS.mq.cmsOverview,
      transformResponse: (res) => res?.data ?? res, // { ok, version, totals, messages, rates }
      providesTags: [{ type: 'MqStatus', id: 'OVERVIEW' }],
    }),
    getMqQueues: build.query({
      query: () => ENDPOINTS.mq.cmsQueues,
      transformResponse: (res) => res?.data ?? res, // { items, vhost }
      providesTags: [{ type: 'MqStatus', id: 'QUEUES' }],
    }),
    getMqConsumers: build.query({
      query: () => ENDPOINTS.mq.cmsConsumers,
      transformResponse: (res) => res?.data ?? res, // { items }
      providesTags: [{ type: 'MqStatus', id: 'CONSUMERS' }],
    }),
    getMqConnections: build.query({
      query: () => ENDPOINTS.mq.cmsConnections,
      transformResponse: (res) => res?.data ?? res, // { items }
      providesTags: [{ type: 'MqStatus', id: 'CONNECTIONS' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMqOverviewQuery,
  useGetMqQueuesQuery,
  useGetMqConsumersQuery,
  useGetMqConnectionsQuery,
} = mqApi;
