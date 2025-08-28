import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

export type ChatMessage = ChatCompletionMessageParam;

export interface AITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface SearchParameters {
  mode?: "auto" | "on" | "off";
}

export interface SearchOptions {
  search_parameters?: SearchParameters;
}

export interface AIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: AIToolCall[];
    };
    finish_reason: string;
  }>;
}

export class QuietClient {
  private primary: OpenAI;
  private fallback: OpenAI | null = null;
  private currentModel: string = "gpt-5";

  constructor(
    apiKey: string,
    model?: string,
    baseURL?: string,
    fallbackApiKey?: string
  ) {
    this.primary = new OpenAI({
      apiKey,
      baseURL: baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      timeout: 360000,
    });

    const grokKey = fallbackApiKey || process.env.GROK_API_KEY;
    if (grokKey) {
      this.fallback = new OpenAI({
        apiKey: grokKey,
        baseURL: process.env.GROK_BASE_URL || "https://api.x.ai/v1",
        timeout: 360000,
      });
    }

    if (model) {
      this.currentModel = model;
    }
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  async chat(
    messages: ChatMessage[],
    tools?: AITool[],
    model?: string,
    searchOptions?: SearchOptions
  ): Promise<AIResponse> {
    const requestPayload: any = {
      model: model || this.currentModel,
      messages,
      tools: tools || [],
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: 0.7,
      max_tokens: 4000,
    };

    if (searchOptions?.search_parameters) {
      requestPayload.search_parameters = searchOptions.search_parameters;
    }

    try {
      const response = await this.primary.chat.completions.create(requestPayload);
      return response as AIResponse;
    } catch (error: any) {
      if (this.fallback) {
        const fallbackPayload = {
          ...requestPayload,
          model: "grok-4-latest",
        };
        const response = await this.fallback.chat.completions.create(
          fallbackPayload
        );
        return response as AIResponse;
      }
      throw new Error(`API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    tools?: AITool[],
    model?: string,
    searchOptions?: SearchOptions
  ): AsyncGenerator<any, void, unknown> {
    const requestPayload: any = {
      model: model || this.currentModel,
      messages,
      tools: tools || [],
      tool_choice: tools && tools.length > 0 ? "auto" : undefined,
      temperature: 0.7,
      max_tokens: 4000,
      stream: true,
    };

    if (searchOptions?.search_parameters) {
      requestPayload.search_parameters = searchOptions.search_parameters;
    }

    try {
      const stream = (await this.primary.chat.completions.create(
        requestPayload
      )) as any;
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      if (this.fallback) {
        const fallbackPayload = {
          ...requestPayload,
          model: "grok-4-latest",
        };
        const stream = (await this.fallback.chat.completions.create(
          fallbackPayload
        )) as any;
        for await (const chunk of stream) {
          yield chunk;
        }
        return;
      }
      throw new Error(`API error: ${error.message}`);
    }
  }

  async search(
    query: string,
    searchParameters?: SearchParameters
  ): Promise<AIResponse> {
    const searchMessage: ChatMessage = {
      role: "user",
      content: query,
    };

    const searchOptions: SearchOptions = {
      search_parameters: searchParameters || { mode: "on" },
    };

    return this.chat([searchMessage], [], undefined, searchOptions);
  }
}

