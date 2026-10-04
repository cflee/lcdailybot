# Agent attribution

For commits containing work performed by an agent:

- Set the Git author to `Codex <codex@openai.com>` by default. Include a model name only when the exact model identifier is explicitly available and reliable. A broad family label such as GPT-6 is insufficient. When uncertain, use only `Codex`; never guess or imply an exact model.
- Preserve the original human committer identity when rewriting existing commits. For new commits, use the human identity explicitly supplied in the session or configured in Git; confirm that it belongs to the human rather than the agent. If the human identity cannot be established reliably, ask instead of guessing.
- Include a `Co-authored-by` trailer at the end of the commit message using that same human name and email. Derive the identity for the current work; do not hard-code a person's name or email in these instructions.
- End each agent-prepared pull request description with `Prepared by Codex.` by default. Include a model only when its exact identifier is explicitly available and reliable; otherwise omit it.
- When rewriting attribution on existing commits, preserve source trees and existing dates, update stacked descendants to their rewritten parents, and push with explicit force-with-lease checks. Do not rewrite unrelated human commits.
- If the available GitHub tool cannot set author/committer fields, prepare correctly attributed commits locally and report the publishing limitation rather than silently attributing the agent's work to the human.
