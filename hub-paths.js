/**
 * Hub API paths — set in .env from private course materials (no defaults in repo).
 * Values must be path-only (leading /), never a full URL. Use {apiKey} where the URL includes your key.
 */
import { getAiDevsHubBase } from "./hub-base.js";

/** @param {string} name */
function requirePathEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `${name} is required (hub path from private course materials; path only, starting with /)`,
    );
  }
  if (/^https?:\/\//i.test(v)) {
    throw new Error(`${name} must be a path only (starting with /), not a full URL`);
  }
  return v.startsWith("/") ? v : `/${v}`;
}

export function hubVerifyUrl() {
  return `${getAiDevsHubBase()}${requirePathEnv("AI_DEVS_HUB_PATH_VERIFY")}`;
}

/**
 * @param {string} envName
 * @param {string} [apiKey] replaced for each `{apiKey}` in the path template
 */
export function hubUrlFromPathEnv(envName, apiKey = "") {
  let path = requirePathEnv(envName);
  if (apiKey) path = path.replaceAll("{apiKey}", apiKey);
  return `${getAiDevsHubBase()}${path}`;
}
