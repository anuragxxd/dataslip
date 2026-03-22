<h1 align="center">DataSlip</h1>

<p align="center">
  <strong>A terminal-first PostgreSQL browser and query editor.</strong>
</p>

<p align="center">
  Save connections, inspect schemas, browse rows, filter tables, edit cells, and run SQL from a native TUI built with Bun, OpenTUI, and React.
</p>

<p align="center">
  <a href="https://github.com/anuragxxd/dataslip/actions/workflows/test.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/anuragxxd/dataslip/test.yml?style=flat-square&branch=master" /></a>
  <a href="https://github.com/anuragxxd/dataslip/releases"><img alt="Release" src="https://img.shields.io/github/v/release/anuragxxd/dataslip?style=flat-square" /></a>
  <a href="https://github.com/anuragxxd/dataslip/blob/master/LICENSE"><img alt="License" src="https://img.shields.io/github/license/anuragxxd/dataslip?style=flat-square" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#installation">Installation</a> &middot;
  <a href="#usage-guide">Usage Guide</a> &middot;
  <a href="#keyboard-shortcuts">Keyboard</a>
</p>

---

## Quick Start

Install the latest release on macOS or Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/anuragxxd/dataslip/master/install.sh | sh
dataslip
```

Then:

1. Press `n` to create a PostgreSQL connection.
2. Press `Ctrl+T` in the form to test it.
3. Press `Enter` to connect.
4. Browse the schema tree, open a table, and start exploring.

## Features

- **Saved PostgreSQL connections** - create, edit, test, and delete connection profiles.
- **Schema browser** - inspect schemas, tables, views, columns, indexes, and foreign keys.
- **Fast schema search** - press `/` to jump directly to schemas, tables, views, columns, indexes, or FKs.
- **Data grid** - paginate, sort, reload, and navigate rows with terminal-native keyboard controls.
- **Search and filters** - apply quick text search, add structured filters, preview generated SQL, and clear constraints quickly.
- **Cell editing** - edit table cells inline, toggle `NULL`, and confirm updates before writing.
- **Query tabs** - open multiple query workspaces, run ad-hoc SQL, and inspect result sets in a grid.
- **Session restore** - reconnect automatically on launch and reopen your previous tabs, focus state, table view settings, and tree expansion.
- **Theme picker** - choose from multiple built-in themes with live preview.
- **Command palette and help** - discover actions with `Ctrl+K` and open shortcuts with `?`.
- **Local persistence** - connection metadata, UI settings, and session state are stored locally in SQLite.

## Installation

### Option 1: Install script

The install script downloads the latest GitHub release for your platform and places the binary in your local bin directory.

For a public repo:

```bash
curl -fsSL https://raw.githubusercontent.com/anuragxxd/dataslip/master/install.sh | sh
```

If the repo is still private, use an authenticated GitHub API request instead:

```bash
export DATASLIP_GITHUB_TOKEN="$(gh auth token)"
curl -fsSL \
  -H "Authorization: Bearer $DATASLIP_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.raw" \
  "https://api.github.com/repos/anuragxxd/dataslip/contents/install.sh?ref=master" | \
  env DATASLIP_GITHUB_TOKEN="$DATASLIP_GITHUB_TOKEN" sh
```

The script supports these environment variables:

| Variable | Description |
| --- | --- |
| `DATASLIP_GITHUB_TOKEN` | GitHub token for downloading from a private repo |
| `DATASLIP_VERSION` | Install a specific version, for example `DATASLIP_VERSION=v0.1.0` |
| `DATASLIP_INSTALL_DIR` | Override the install directory |
| `DATASLIP_REPO` | Override the GitHub repo, useful for testing a fork |
| `XDG_BIN_DIR` | Alternate bin directory if you prefer XDG-style installs |

Examples:

```bash
DATASLIP_VERSION=v0.1.0 curl -fsSL https://raw.githubusercontent.com/anuragxxd/dataslip/master/install.sh | sh
DATASLIP_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/anuragxxd/dataslip/master/install.sh | sh
```

By default the script installs to:

- `$DATASLIP_INSTALL_DIR` if set
- `$XDG_BIN_DIR` if set
- `$HOME/.local/bin` on macOS and Linux
- `$HOME/bin` on Windows shells that support `sh`

### Option 2: Download a release manually

Prebuilt binaries are published on the [Releases](https://github.com/anuragxxd/dataslip/releases) page.

| Platform | Archive |
| --- | --- |
| macOS (Apple Silicon) | `dataslip-darwin-arm64.tar.gz` |
| macOS (Intel) | `dataslip-darwin-x64.tar.gz` |
| Linux (x64) | `dataslip-linux-x64.tar.gz` |
| Windows (x64) | `dataslip-windows-x64.zip` |

Each release also includes `SHA256SUMS` if you want to verify the archive manually.

### Option 3: Run from source

If you want to hack on DataSlip or run directly from source:

```bash
bun install
bun run dev
```

Requirements:

- [Bun](https://bun.sh) >= 1.3
- A terminal with TrueColor support (iTerm2, Kitty, WezTerm, Ghostty, etc.)
- A PostgreSQL database to connect to

## Usage Guide

### 1. Create and test a connection

DataSlip starts on the connection screen.

- Press `n` to open the connection form.
- Fill in the connection name, host, port, database, username, password, and SSL toggle.
- Press `Ctrl+T` to test the connection before saving.
- Press `Ctrl+S` or `Enter` to save.

### 2. Explore the schema

After connecting, the left sidebar shows the schema tree.

- Navigate with `j/k` or arrow keys.
- Press `Enter`, `l`, or right arrow to expand or open.
- Press `h` or left arrow to collapse.
- Press `/` to search across the schema catalog and jump directly to a result.

The tree includes:

- Schemas
- Tables
- Views
- Columns
- Indexes
- Foreign keys

### 3. Browse table data

Opening a table creates a table workspace in the main panel.

- Move around with `h/j/k/l` or arrow keys.
- Press `n` and `p` to move between pages.
- Press `s` to sort by the selected column.
- Press `F` to open the search and filters dialog.
- Press `=` to create a filter from the selected cell.
- Press `x` to clear active search and filters.
- Press `r` to reload the table.
- Press `g` / `G` to jump to the first or last visible row.

The filters dialog supports both quick text search and structured filter clauses, with a SQL preview before applying the new view.

### 4. Edit table cells

If the current workspace is a real table and DataSlip can identify primary keys, cells can be edited inline.

- Press `Enter` on a selected cell to start editing.
- Press `Ctrl+N` while editing to toggle `NULL`.
- Press `Enter` again to review and confirm the update.
- Press `Esc` to cancel.

### 5. Run ad-hoc SQL

DataSlip supports dedicated query tabs alongside table tabs.

- Press `Ctrl+T` to open a blank query tab.
- Press `q` while viewing a table to open a seeded query tab for that relation.
- Press `Ctrl+R` to execute the current SQL.
- Use `Tab` to cycle between sidebar, query editor, and query results.
- Navigate results with `h/j/k/l`, `g`, and `G`.

### 6. Resume where you left off

On startup, DataSlip attempts to restore the previous session.

If the saved connection is still present and reconnects successfully, DataSlip restores:

- the active connection
- open table and query tabs
- selected workspace and focused panel
- schema tree expansion state
- table pagination, sorting, and selection
- saved query text

If reconnecting fails, DataSlip safely falls back to the connection screen.

## Keyboard Shortcuts

### Global

| Key | Action |
| --- | --- |
| `Ctrl+K` | Open command palette |
| `?` | Show help |
| `Ctrl+C` | Open quit confirmation |

### Main Screen

| Key | Action |
| --- | --- |
| `Tab` | Cycle focus between panels |
| `Esc` | Move focus back to the sidebar or disconnect |
| `Ctrl+T` | Open a new query tab |
| `Ctrl+P` / `Ctrl+N` | Previous / next tab |
| `Ctrl+W` | Close the current tab |
| `/` | Search schema |

### Connection Screen

| Key | Action |
| --- | --- |
| `j/k` or `↑/↓` | Move through saved connections |
| `Enter` | Connect |
| `n` | New connection |
| `e` | Edit connection |
| `d` | Delete connection |
| `q` | Quit |

### Schema Tree

| Key | Action |
| --- | --- |
| `j/k` or `↑/↓` | Move cursor |
| `Enter`, `l`, `→` | Expand or open |
| `h`, `←` | Collapse |

### Table Grid

| Key | Action |
| --- | --- |
| `h/j/k/l` or arrows | Move selection |
| `Enter` | Edit selected cell |
| `F` | Open search and filters |
| `=` | Filter by selected cell |
| `x` | Clear search and filters |
| `n` / `p` | Next / previous page |
| `s` | Sort by selected column |
| `r` | Reload |
| `g` / `G` | First / last row |

### Query Tabs

| Key | Action |
| --- | --- |
| `Ctrl+R` | Run query |
| `Tab` | Cycle query editor and results focus |
| `Esc` | Return to sidebar |
| `q` | Return from results to the editor |
| `h/j/k/l` | Navigate results |
| `g` / `G` | First / last result row |

## Storage and Logs

DataSlip keeps local state in a single data directory.

Default location:

```bash
~/.dataslip
```

Override it with:

```bash
export DATASLIP_HOME=/path/to/dataslip-data
```

Files stored there:

- `dataslip.db` - SQLite database for saved connections, settings, and session state
- `dataslip.log` - application log file used for debugging connection and runtime issues

## Current Scope

DataSlip currently focuses on PostgreSQL.

That includes:

- PostgreSQL connection management
- schema introspection
- table and view browsing
- ad-hoc SQL execution
- local session persistence

## Development

```bash
# Install dependencies
bun install

# Run the TUI directly
bun run dev

# Typecheck
bun run typecheck

# Run tests
bun run test

# Build a release binary for the current machine
bun run build:release
```

## License

MIT
