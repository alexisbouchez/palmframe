# Palmframe

[![npm][npm-badge]][npm-url] [![License: MIT][license-badge]][license-url]

[npm-badge]: https://img.shields.io/npm/v/palmframe.svg
[npm-url]: https://www.npmjs.com/package/palmframe
[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT

A desktop interface for [deepagentsjs](https://github.com/langchain-ai/deepagentsjs) — an opinionated harness for building deep agents with filesystem capabilities planning, and subagent delegation.

![Palmframe screenshot](docs/screenshot.png)

> [!CAUTION]
> Palmframe gives AI agents direct access to your filesystem and the ability to execute shell commands. Always review tool calls before approving them, and only run in workspaces you trust.

## Get Started

```bash
# Run directly with npx
npx palmframe

# Or install globally
npm install -g palmframe
palmframe

```

Requires Node.js 18+.

### From Source

```bash
git clone https://github.com/langchain-ai/palmframe.git
cd palmframe
npm install
npm run dev
```

Or configure them in-app via the settings panel.

## Supported Models

| Provider  | Models                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Anthropic | Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1, Claude Sonnet 4 |
| OpenAI    | GPT-5.2, GPT-5.1, o3, o3 Mini, o4 Mini, o1, GPT-4.1, GPT-4o                            |
| Google    | Gemini 3 Pro Preview, Gemini 3 Flash Preview, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite |
| Mistral   | Mistral Large, Mistral Medium, Mistral Small, Codestral, Pixtral Large, Ministral 8B  |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Report bugs via [GitHub Issues](https://github.com/langchain-ai/palmframe/issues).

## License

MIT — see [LICENSE](LICENSE) for details.
