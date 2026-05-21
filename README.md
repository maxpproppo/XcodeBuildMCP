<img src="assets/banner.png" alt="XcodeBuild MCP" width="600"/>

A Model Context Protocol (MCP) server and CLI that provides tools for agent use when working on iOS and macOS projects.

[![CI](https://github.com/getsentry/XcodeBuildMCP/actions/workflows/ci.yml/badge.svg)](https://github.com/getsentry/XcodeBuildMCP/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/xcodebuildmcp.svg)](https://badge.fury.io/js/xcodebuildmcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Node.js](https://img.shields.io/badge/node->=18.x-brightgreen.svg)](https://nodejs.org/) [![Xcode 16](https://img.shields.io/badge/Xcode-16-blue.svg)](https://developer.apple.com/xcode/) [![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/) [![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/getsentry/XcodeBuildMCP) [![AgentAudit Security](https://img.shields.io/badge/AgentAudit-Safe-brightgreen?logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAxTDMgNXY2YzAgNS41NSAzLjg0IDEwLjc0IDkgMTIgNS4xNi0xLjI2IDktNi40NSA5LTEyVjVsLTktNHoiLz48L3N2Zz4=)](https://www.agentaudit.dev/skills/xcodebuildmcp)

## Installation

This fork is the internal hardened build of XcodeBuildMCP. It removes Sentry
telemetry and disables automatic template and helper downloads by default.

Use the internal install guide instead of the upstream Homebrew tap or the public
`xcodebuildmcp@latest` npm package:

- [Internal Install](INTERNAL_INSTALL.md)

## Requirements

- macOS 14.5 or later
- Xcode 16.x or later
- Node.js 18.x or later

## Skills

XcodeBuildMCP now includes two optional agent skills:

- **MCP Skill**: Primes the agent with instructions on how to use the MCP server's tools (optional when using the MCP server).

- **CLI Skill**: Primes the agent with instructions on how to navigate the CLI (recommended when using the CLI).


After installing the internal global binary:

```bash
xcodebuildmcp init
```

For further information on installing skills, see [Agent Skills](https://xcodebuildmcp.com/docs/skills).

## Notes

- XcodeBuildMCP requests xcodebuild to skip macro validation to avoid errors when building projects that use Swift Macros.
- Device tools require code signing to be configured in Xcode. See [Device Code Signing](https://xcodebuildmcp.com/docs/device-signing).

## Privacy

This hardened fork removes Sentry telemetry from the runtime. The doctor command
reports `Sentry telemetry: Removed in this hardened build`.

## CLI

XcodeBuildMCP provides a unified command-line interface. The `mcp` subcommand starts the MCP server, while all other commands provide direct terminal access to tools:

```bash
# Start the MCP server (for MCP clients)
xcodebuildmcp mcp

# List available tools
xcodebuildmcp tools

# Build for simulator
xcodebuildmcp simulator build --scheme MyApp --project-path ./MyApp.xcodeproj
```

Use [Internal Install](INTERNAL_INSTALL.md#updating) to update from the internal
fork. Do not use `xcodebuildmcp upgrade`, which is designed for the public
upstream package.

The CLI uses a per-workspace daemon for stateful operations (log capture,
debugging, etc.) that auto-starts when needed. See the [CLI guide](https://xcodebuildmcp.com/docs/cli) for full documentation.

## Documentation

- Internal installation: [Internal Install](INTERNAL_INSTALL.md)
- Setup: [https://xcodebuildmcp.com/docs/setup](https://xcodebuildmcp.com/docs/setup)
- MCP clients: [https://xcodebuildmcp.com/docs/clients](https://xcodebuildmcp.com/docs/clients)
- CLI usage: [https://xcodebuildmcp.com/docs/cli](https://xcodebuildmcp.com/docs/cli)
- Configuration and options: [https://xcodebuildmcp.com/docs/configuration](https://xcodebuildmcp.com/docs/configuration)
- Tools reference: [https://xcodebuildmcp.com/docs/tools](https://xcodebuildmcp.com/docs/tools)
- Troubleshooting: [https://xcodebuildmcp.com/docs/troubleshooting](https://xcodebuildmcp.com/docs/troubleshooting)
- Privacy: [https://xcodebuildmcp.com/docs/privacy](https://xcodebuildmcp.com/docs/privacy)
- Skills: [https://xcodebuildmcp.com/docs/skills](https://xcodebuildmcp.com/docs/skills)
- Contributing: [https://xcodebuildmcp.com/docs/contributing](https://xcodebuildmcp.com/docs/contributing)

## Licence

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
For third-party licensing notices see the [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES) file for details.
For npm package attributions see the [THIRD_PARTY_PACKAGE_LICENSES](THIRD_PARTY_PACKAGE_LICENSES.md) file for details.
