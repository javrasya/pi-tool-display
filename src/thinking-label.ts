import { stripVTControlCharacters } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Older Pi releases don't expose a render-only Markdown hook. Use their native
// thinking UI rather than changing the assistant message to add a label.
interface ThinkingMarkdownApi {
  registerMarkdownTransformer?(
    transform: (markdown: string) => string,
    options: { messageTypes: ["assistant-thinking"] },
  ): void;
}

const LABEL_PREFIX = /^\s*(?:thinking:\s*)+/i;

export function registerThinkingLabeling(pi: ExtensionAPI): void {
  const renderer = pi as ExtensionAPI & ThinkingMarkdownApi;
  renderer.registerMarkdownTransformer?.((markdown) => {
    // Remove any previous label from the rendered copy only, including labels
    // persisted with ANSI styling by older versions of this extension.
    const plain = stripVTControlCharacters(markdown);
    const body = LABEL_PREFIX.test(plain) ? plain.replace(LABEL_PREFIX, "") : markdown;
    return body.trim() ? `**Thinking:**\n\n${body}` : markdown;
  }, { messageTypes: ["assistant-thinking"] });
}
