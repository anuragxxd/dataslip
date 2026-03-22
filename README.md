# DataSlip

A DataGrip-like TUI database editor for the terminal. Built with [OpenTUI](https://opentui.com) + React.

## Features (MVP)

- **Connection Manager** — Save, edit, delete, and test PostgreSQL connections
- **Schema Browser** — Browse schemas, tables, views, and columns in a tree view
- **Data Grid** — View table data with pagination, sorting, and cell navigation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| TUI Framework | [OpenTUI](https://opentui.com) + React |
| State Management | [Zustand](https://zustand.docs.pmnd.rs/) |
| Database Driver | [postgres.js](https://github.com/porsager/postgres) |
| Local Storage | bun:sqlite |
| Validation | [Zod](https://zod.dev) |

## Requirements

- [Bun](https://bun.sh) >= 1.3
- A terminal with TrueColor support (iTerm2, Kitty, WezTerm, Ghostty, etc.)

## Install & Run

```bash
bun install
bun run dev
```

## Keyboard Shortcuts

### Connection Screen
| Key | Action |
|-----|--------|
| `j/k` or `↑/↓` | Navigate connections |
| `Enter` | Connect |
| `n` | New connection |
| `e` | Edit connection |
| `d` | Delete connection |
| `q` | Quit |

### Main Screen
| Key | Action |
|-----|--------|
| `Tab` | Switch between sidebar and data grid |
| `Esc` | Disconnect and go back |
| `?` | Show help |
| `Ctrl+C` | Exit |

### Schema Tree (Sidebar)
| Key | Action |
|-----|--------|
| `j/k` or `↑/↓` | Navigate |
| `Enter` or `l/→` | Expand / Select table |
| `h/←` | Collapse |

### Data Grid
| Key | Action |
|-----|--------|
| `h/j/k/l` | Navigate cells |
| `[/]` | Previous / Next page |
| `s` | Sort by current column |
| `g/G` | Go to first / last row |

## Project Structure

```
src/
├── index.tsx              # Entry point
├── app.tsx                # Root component
├── db/                    # Database layer
│   ├── types.ts           # Type definitions
│   ├── connection.ts      # Connection manager
│   ├── introspect.ts      # Schema introspection
│   └── query.ts           # Query execution
├── store/                 # Zustand state stores
│   ├── connections.ts     # Connection state
│   ├── schema.ts          # Schema tree state
│   ├── table-data.ts      # Table data state
│   └── ui.ts              # UI state
├── storage/               # Local persistence (SQLite)
├── components/            # TUI components
│   ├── layout/            # Header, sidebar, main panel, status bar
│   ├── connection/        # Connection list & form
│   ├── schema/            # Schema tree
│   ├── table/             # Data grid
│   └── ui/                # Dialog, toast, keybind bar
├── theme/                 # Color theme
└── utils/                 # Formatting utilities
```

## License

MIT
