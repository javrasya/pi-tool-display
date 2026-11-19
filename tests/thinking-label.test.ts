import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerThinkingLabeling } from "../src/thinking-label.ts";

function register() {
  const handlers = new Map<string, (event: unknown) => unknown>();
  const renderers: Array<{ render: (markdown: string) => string; messageTypes: string[] }> = [];
  registerThinkingLabeling({
    on(event: string, handler: (event: unknown) => unknown) {
      handlers.set(event, handler);
    },
    registerMarkdownTransformer(render: (markdown: string) => string, options: { messageTypes: string[] }) {
      renderers.push({ render, messageTypes: options.messageTypes });
    },
  } as unknown as ExtensionAPI);
  return { handlers, renderers };
}

test("signed thinking is unchanged through streaming, finalization and provider context", async () => {
  const { handlers, renderers } = register();
  const message = {
    role: "assistant",
    provider: "claude-bridge",
    api: "claude-bridge",
    content: [{ type: "thinking", thinking: "\nThinking: check paths.\n\n", thinkingSignature: "signed-by-provider" }],
  };
  const original = structuredClone(message);
  await handlers.get("message_update")?.({ message });
  assert.deepEqual(message, original, "streaming display must not change the message");
  await handlers.get("message_end")?.({ message });
  assert.deepEqual(message, original, "what Pi saves must match the provider's output");
  const context = { messages: [structuredClone(message)] };
  const result = await handlers.get("context")?.(context) as typeof context | undefined;
  assert.deepEqual((result ?? context).messages, [original], "replay must preserve signed bytes");
  assert.equal(renderers.length, 1);
  assert.deepEqual(renderers[0].messageTypes, ["assistant-thinking"]);
  assert.equal(renderers[0].render(message.content[0].thinking), "**Thinking:**\n\ncheck paths.\n\n");
  assert.deepEqual(message, original);
});

test("thinking labels keep the Markdown body intact", () => {
  const { renderers: [{ render }] } = register();
  const markdown = "```text\nfirst line\nsecond line\n```";
  assert.equal(render(markdown), `**Thinking:**\n\n${markdown}`);
  assert.equal(render("  \n"), "  \n");
});

test("a label saved by earlier versions is not rendered twice", () => {
  const { renderers: [{ render }] } = register();
  assert.equal(render("\x1b[38;2;140;111;149mThinking:\x1b[39m \x1b[38;2;143;143;143mVerify this.\x1b[39m"), "**Thinking:**\n\nVerify this.");
});

test("hosts without the Markdown API do not install message-mutating fallbacks", () => {
  const events: string[] = [];
  registerThinkingLabeling({ on: (event: string) => events.push(event) } as unknown as ExtensionAPI);
  assert.deepEqual(events, []);
});
