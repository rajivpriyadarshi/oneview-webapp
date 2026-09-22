/**
 * The server side of the model boundary for /lab/generative-ui.
 *
 * Almost nothing left. The three passes, their prompts and the two provider shapes moved
 * to `../../../lab/generative-ui/model.ts` when the lab had to be able to run with no
 * server at all — see that file's header. What stays here is the part that is genuinely
 * about being a route, and it is the part worth keeping separate:
 *
 *   - the key comes from the *server's* environment and never leaves it;
 *   - the model ids can be overridden per deployment;
 *   - an outcome becomes a status code.
 *
 * Wherever this route is reachable, ./pipeline.ts prefers it, precisely because the key
 * stays on this side. The browser-key path exists for the static deployment, where there
 * is no this side.
 */

import { NextResponse } from "next/server";
import { runStage, type Credential } from "../../../lab/generative-ui/model";

/**
 * The server's key, if it has one.
 *
 * Anthropic first, OpenAI if that is the key that is present — the same precedence the
 * route has always had. Read per request rather than at module load so that changing the
 * environment does not need a rebuild.
 */
function serverCredential(): Credential | null {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) {
    return { provider: "anthropic", key: anthropic, model: process.env.DYNAMIC_UI_MODEL };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return { provider: "openai", key: openai, model: process.env.DYNAMIC_UI_OPENAI_MODEL };
  }
  return null;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request", detail: "unparseable" }, { status: 400 });
  }

  const outcome = await runStage(payload as never, serverCredential());
  if (outcome.ok) return NextResponse.json(outcome.body);

  return NextResponse.json(
    { error: outcome.error, detail: outcome.detail, dropped: outcome.dropped },
    { status: outcome.status },
  );
}
