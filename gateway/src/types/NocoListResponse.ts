export interface NocoListResponse<T> {
  list: T[];
  pageInfo?: { totalRows?: number };
}
