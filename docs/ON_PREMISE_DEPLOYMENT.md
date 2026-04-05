# On-Premise Deployment Guide

## Overview
This guide explains how to deploy the F-16 Maintenance System with local data sources (SQL databases, NAS, internal APIs).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│                  (localhost:5173)                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Local Data Proxy Server                        │
│                  (localhost:3001)                           │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ SQL       │  │ File      │  │ API       │               │
│  │ Adapter   │  │ Adapter   │  │ Adapter   │               │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
└────────┼──────────────┼──────────────┼──────────────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ SQL DBs  │   │ NAS/     │   │ Internal │
   │ (Any)    │   │ Local FS │   │ APIs     │
   └──────────┘   └──────────┘   └──────────┘
```

## Quick Start

### 1. Install Local Server

```bash
cd local-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Server

```bash
npm run dev
```

### 4. Access Dashboard

Open `http://localhost:5173` and configure data sources.

## SQL Database Support

| Database   | Connection String Example |
|------------|--------------------------|
| PostgreSQL | `postgresql://user:pass@host:5432/db` |
| MySQL      | `mysql://user:pass@host:3306/db` |
| MSSQL      | `mssql://user:pass@host:1433/db` |
| SQLite     | `/path/to/database.db` |

## File System Access

- **Local**: `C:\FlightData`
- **Network**: `\\server\share\data`

## Troubleshooting

1. **Cannot connect to proxy**: Ensure server is running on port 3001
2. **SQL errors**: Check connection string and credentials
3. **File access denied**: Verify folder permissions
