import { hubUrlFromPathEnv, hubVerifyUrl } from "../../../../hub-paths.js";
import { apiKey } from "../config.js";

const zmailApiUrl = () => hubUrlFromPathEnv("AI_DEVS_HUB_PATH_API_ZMAIL");

const extractFlag = (text: string) => text.match(/\{FLG:[^}]+}/)?.[0];

const zmailPost = async (body: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(zmailApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: apiKey, ...body }),
  });

  if (!response.ok) {
    throw new Error(
      `zmail API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
};

export const createHandlers = () => ({
  async zmail_help() {
    const result = await zmailPost({ action: "help", page: 1 });
    return { ok: true, result };
  },

  async zmail_get_inbox({ page }: { page?: number }) {
    const result = await zmailPost({ action: "getInbox", page: page ?? 1 });
    return { ok: true, result };
  },

  async zmail_search({ query, page }: { query: string; page?: number }) {
    const result = await zmailPost({
      action: "search",
      query,
      page: page ?? 1,
    });
    return { ok: true, result };
  },

  async zmail_get_message({ id }: { id: string }) {
    const result = await zmailPost({ action: "getMessages", ids: id });
    return { ok: true, result };
  },

  async submit_answer({
    password,
    date,
    confirmation_code,
  }: {
    password: string;
    date: string;
    confirmation_code: string;
  }) {
    const response = await fetch(hubVerifyUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        task: "mailbox",
        answer: { password, date, confirmation_code },
      }),
    });

    const rawBody = await response.text();
    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // keep null
    }

    const flag = extractFlag(rawBody);

    console.log("[submit_answer] status:", response.status);
    console.log("[submit_answer] body:", rawBody.slice(0, 500));

    return {
      ok: response.ok,
      status: response.status,
      body: parsedBody,
      rawBodyPreview: rawBody.slice(0, 500),
      flag,
    };
  },
});
