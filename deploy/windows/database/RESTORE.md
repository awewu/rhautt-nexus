# PostgreSQL database

This application ZIP does not restore or overwrite the production database.

The target server is expected to already have the `rhautt_GOT` PostgreSQL
database and `rhautt_nexus` schema. Keep same-server application connections on:

```dotenv
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=rhautt_GOT
POSTGRES_SCHEMA=rhautt_nexus
POSTGRES_SYNCHRONIZE=false
```

Before any future restore or data replacement, stop the Nexus backend, create a
server-side backup, and get explicit approval for the merge or replacement
strategy. Do not use `--clean`, DROP, or overwrite-style restore commands
without that approval.
