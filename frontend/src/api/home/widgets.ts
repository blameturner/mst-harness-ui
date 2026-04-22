// frontend/src/api/home/widgets.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type {
  WidgetEnvelope,
  GraphWidgetData,
  ActivityWidgetData,
} from './types';

export function getEmailWidget() {
  return http.get('home/widgets/email').json<WidgetEnvelope<null>>();
}

export function getCalendarWidget() {
  return http.get('home/widgets/calendar').json<WidgetEnvelope<null>>();
}

export function getGraphWidget(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('home/widgets/graph', { searchParams: { org_id: orgId, limit } })
    .json<WidgetEnvelope<GraphWidgetData>>();
}

export function getActivityWidget(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('home/widgets/activity', { searchParams: { org_id: orgId, limit } })
    .json<WidgetEnvelope<ActivityWidgetData>>();
}
