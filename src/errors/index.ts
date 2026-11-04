export class NotReadyError extends Error {
  public retryInMs: number;
  public patch?: Record<string, any>;

  constructor(retryInMs: number, patch?: Record<string, any>, message?: string) {
    super(message || `Not ready. Retry in ${retryInMs}ms`);
    this.name = 'NotReadyError';
    this.retryInMs = retryInMs;
    this.patch = patch;
  }
}

export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}
