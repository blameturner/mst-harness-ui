export interface NocoListResponse<T> {
  list: T[];
  pageInfo?: { totalRows?: number };
}

export interface NocoTableMeta {
  title: string;
  id: string;
}

export interface NocoTablesResponse {
  list: NocoTableMeta[];
}

export class NocoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly tableName?: string,
  ) {
    super(message);
    this.name = 'NocoError';
  }
}
