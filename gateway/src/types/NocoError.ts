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
