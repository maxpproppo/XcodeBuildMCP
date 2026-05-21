# Internal Install

This fork is the internal hardened build of XcodeBuildMCP. Use this repository
instead of the upstream Homebrew tap or the public `xcodebuildmcp@latest` npm
package.

The hardened build removes Sentry telemetry and disables automatic template and
helper downloads by default.

## Requirements

- macOS 14.5 or later
- Xcode 16.x or later
- Node.js 18.x or later
- GitHub access to `maxpproppo/XcodeBuildMCP`

## Install

If you previously installed the public upstream package, remove it first:

```bash
brew uninstall xcodebuildmcp 2>/dev/null || true
npm uninstall -g xcodebuildmcp 2>/dev/null || true
```

Clone and install from the internal fork:

```bash
git clone https://github.com/maxpproppo/XcodeBuildMCP.git
cd XcodeBuildMCP
npm ci --ignore-scripts
npm run build
npm pack --ignore-scripts
npm install -g ./xcodebuildmcp-*.tgz --ignore-scripts
rm ./xcodebuildmcp-*.tgz
```

Verify the installed binary:

```bash
command -v xcodebuildmcp
xcodebuildmcp --version
xcodebuildmcp-doctor --style minimal
```

The doctor output should include:

```text
Sentry telemetry: Removed in this hardened build
```

## Codex Configuration

Add this MCP server entry to `~/.codex/config.toml`:

```toml
[mcp_servers.xcodebuildmcp]
command = "/opt/homebrew/bin/xcodebuildmcp"
args = ["mcp"]
env = { XCODEBUILDMCP_SENTRY_DISABLED = "true", INCREMENTAL_BUILDS_ENABLED = "false" }
```

If `command -v xcodebuildmcp` prints a different path, use that path for the
`command` value.

Restart Codex after changing the config.

## Cursor / VS Code Configuration

Use the global binary installed from this fork:

```json
{
  "servers": {
    "XcodeBuildMCP": {
      "type": "stdio",
      "command": "xcodebuildmcp",
      "args": ["mcp"],
      "env": {
        "XCODEBUILDMCP_SENTRY_DISABLED": "true",
        "INCREMENTAL_BUILDS_ENABLED": "false"
      }
    }
  }
}
```

## Claude Desktop Configuration

Use the same command in Claude Desktop's MCP config:

```json
{
  "mcpServers": {
    "xcodebuildmcp": {
      "command": "xcodebuildmcp",
      "args": ["mcp"],
      "env": {
        "XCODEBUILDMCP_SENTRY_DISABLED": "true",
        "INCREMENTAL_BUILDS_ENABLED": "false"
      }
    }
  }
}
```

## Updating

Pull the latest internal fork and reinstall:

```bash
cd XcodeBuildMCP
git checkout main
git pull --ff-only
npm ci --ignore-scripts
npm run build
npm pack --ignore-scripts
npm install -g ./xcodebuildmcp-*.tgz --ignore-scripts
rm ./xcodebuildmcp-*.tgz
```

## Do Not Use

These commands install the upstream public build and should not be used for
internal/customer code:

```bash
brew tap getsentry/xcodebuildmcp
brew install xcodebuildmcp
npm install -g xcodebuildmcp@latest
npx -y xcodebuildmcp@latest mcp
```

## Optional Local Templates

Automatic template downloads are disabled. If project scaffolding is needed,
clone or maintain approved templates internally and point the server at them:

```bash
export XCODEBUILDMCP_IOS_TEMPLATE_PATH=/path/to/internal/iOS-template
export XCODEBUILDMCP_MACOS_TEMPLATE_PATH=/path/to/internal/macOS-template
```

Add those variables to the MCP client's `env` block if the templates should be
available through the MCP server.
