export class ProviderError extends Error {
  code: string;
  statusCode?: number;

  constructor(message: string, code = "PROVIDER_ERROR", statusCode = 500) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class RateLimitError extends ProviderError {
  retryAfterSeconds?: number;

  constructor(message = "Provider rate limit reached (HTTP 429). Please try again shortly.", retryAfter?: number) {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfter;
  }
}

export class TimeoutError extends ProviderError {
  constructor(message = "Request to AI provider timed out.") {
    super(message, "TIMEOUT", 504);
    this.name = "TimeoutError";
  }
}

export class ProviderNotConfiguredError extends ProviderError {
  constructor(providerName: string, envVar: string) {
    super(
      `Provider ${providerName} is not configured. Missing required ${envVar} in environment or .env.local.`,
      "PROVIDER_NOT_CONFIGURED",
      503
    );
    this.name = "ProviderNotConfiguredError";
  }
}
