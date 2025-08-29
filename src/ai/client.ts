import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";
import { normalizeTokenParam } from "../utils/normalize-token-param";

export type QEMessage = ChatCompletionMessageParam;

export interface QETool {
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

export interface QEToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface SearchParameters {
  mode?: "auto" | "on" | "off";
  // sources removed - let API use default sources to avoid format issues
}

export interface SearchOptions {
  search_parameters?: SearchParameters;
}

export interface QEResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: QEToolCall[];
    };
    finish_reason: string;
  }>;
}

export class QuietEnableClient {
  private openaiClient: OpenAI;
  private grokClient: OpenAI;
  private currentModel: string = "gpt-5";
  private verbosity?: string;
  private reasoningEffort?: string;

  constructor(
    apiKey: string,
    model?: string,
    baseURL?: string,
    verbosity?: string,
    reasoningEffort?: string
  ) {
    this.openaiClient = new OpenAI({
      apiKey,
      baseURL: baseURL || process.env.QUIETENABLE_BASE_URL || "https://api.openai.com/v1",
      timeout: 360000,
    });

    // Fallback client for Grok4
    this.grokClient = new OpenAI({
      apiKey,
      baseURL: process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      timeout: 360000,
    });

    if (model) {
      this.currentModel = model;
    }

    this.verbosity = verbosity;
    this.reasoningEffort = reasoningEffort;
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  async chat(
    messages: QEMessage[],
    tools?: QETool[],
    model?: string,
    searchOptions?: SearchOptions
  ): Promise<QEResponse> {
    try {
      const basePayload: any = {
        model: model || this.currentModel,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.7,
        max_tokens: 4000,
      };

      if (searchOptions?.search_parameters) {
        basePayload.search_parameters = searchOptions.search_parameters;
      }

      const requestPayload = normalizeTokenParam({ ...basePayload }, "openai");

      if (this.verbosity) {
        requestPayload.verbosity = this.verbosity;
      }
      if (this.reasoningEffort) {
        requestPayload.reasoning_effort = this.reasoningEffort;
      }

      try {
        const response = await this.openaiClient.chat.completions.create(
          requestPayload
        );
        return response as QEResponse;
      } catch {
        // Fallback to Grok4 if OpenAI GPT-5 request fails
        const fallbackPayload = normalizeTokenParam(
          { ...basePayload, model: "grok-4-latest" },
          "grok"
        );
        const response = await this.grokClient.chat.completions.create(
          fallbackPayload
        );
        return response as QEResponse;
      }
    } catch (error: any) {
      throw new Error(`QuietEnable API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: QEMessage[],
    tools?: QETool[],
    model?: string,
    searchOptions?: SearchOptions
  ): AsyncGenerator<any, void, unknown> {
    try {
      const basePayload: any = {
        model: model || this.currentModel,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      };

      if (searchOptions?.search_parameters) {
        basePayload.search_parameters = searchOptions.search_parameters;
      }

      const requestPayload = normalizeTokenParam({ ...basePayload }, "openai");

      if (this.verbosity) {
        requestPayload.verbosity = this.verbosity;
      }
      if (this.reasoningEffort) {
        requestPayload.reasoning_effort = this.reasoningEffort;
      }

      let stream: any;
      try {
        stream = await this.openaiClient.chat.completions.create(
          requestPayload
        );
      } catch {
        const fallbackPayload = normalizeTokenParam(
          { ...basePayload, model: "grok-4-latest" },
          "grok"
        );
        stream = await this.grokClient.chat.completions.create(
          fallbackPayload
        );
      }

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      throw new Error(`QuietEnable API error: ${error.message}`);
    }
  }

  async search(
    query: string,
    searchParameters?: SearchParameters
  ): Promise<QEResponse> {
    const searchMessage: QEMessage = {
      role: "user",
      content: query,
    };

    const searchOptions: SearchOptions = {
      search_parameters: searchParameters || { mode: "on" },
    };

    return this.chat([searchMessage], [], undefined, searchOptions);
  }
}
