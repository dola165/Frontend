# Project agent instructions

## Development workflow

- Work directly in the current task with the user's selected Codex model and reasoning effort. Do not introduce model-selection machinery or force a different reasoning setting.
- Work without subagents by default. Use delegation only when the user explicitly asks for it; no standing request to delegate remains.
- Do not call Jev or any other external service to select development models, allocate work, or advise Codex orchestration. Application features using Jev/Dola have a separate scope and retain their existing credential and spending controls.
- Use ChatGPT subscription authentication for OpenAI development models. Do not add a separately billed generative API fallback or silently change models or billing.
- Preserve existing work and use focused verification. Keep required correctness, security, migration, backup and deployment checks; avoid redundant investigation and repeated checks without a concrete reason.
- Create separate user-visible tasks only when explicitly requested.
