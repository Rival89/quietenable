export type Provider = 'openai' | 'grok' | 'xai';

interface TokenPayload {
  max_tokens?: number;
  max_completion_tokens?: number;
  [key: string]: any;
}

export function normalizeTokenParam<T extends TokenPayload>(payload: T, provider: Provider): T {
  if (provider === 'openai') {
    if (payload.max_tokens !== undefined && payload.max_completion_tokens === undefined) {
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
    }
  } else {
    if (payload.max_completion_tokens !== undefined && payload.max_tokens === undefined) {
      payload.max_tokens = payload.max_completion_tokens;
      delete payload.max_completion_tokens;
    }
  }
  return payload;
}
