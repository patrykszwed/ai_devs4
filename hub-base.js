/**
 * Course hub base URL — set AI_DEVS_HUB_BASE in .env (value from private course materials).
 * No default in repo to avoid publishing infrastructure URLs.
 */
export function getAiDevsHubBase() {
  const raw = process.env.AI_DEVS_HUB_BASE?.trim();
  if (!raw) {
    throw new Error(
      "AI_DEVS_HUB_BASE is required (set in .env to the hub URL from course materials)",
    );
  }
  return raw.replace(/\/$/, "");
}
