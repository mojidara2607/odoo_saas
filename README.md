# Odoo 17 Multi-Tenant SaaS Demo

A Docker-based demonstration of how to run multiple isolated Odoo instances, simulating a SaaS (Software as a Service) platform where each company/client gets their own separate database and application.

---

## What This Demo Shows

- **2 completely isolated Odoo 17 instances** running simultaneously
- **Separate PostgreSQL databases** for each client (true multi-tenancy)
- **Network isolation** between clients using Docker networks
- **Custom CRM module** to demonstrate per-tenant customization
- **Nginx reverse proxy** for subdomain-based routing
- **Data persistence** across container restarts

---

## Prerequisites

Before you start, make sure you have:

1. **Docker Desktop** installed and running
   - Download: https://www.docker.com/products/docker-desktop/
   - After installing, open Docker Desktop and wait until it shows "Running"

2. **At least 4GB RAM** allocated to Docker
   - Docker Desktop > Settings > Resources > Memory > set to 4096MB or more

3. **Ports 8070-8071 available** on your machine

---

## Quick Start (3 Steps)

### Step 1: Navigate to the project folder

```cmd
cd C:\odoo-saas-demo
```

(Or wherever you placed this project)

### Step 2: Start everything

Double-click `start-all.bat` or run:

```cmd
docker compose up -d
```

First run will download Docker images (~1GB). This takes 3-5 minutes.

### Step 3: Open in browser

Wait 1-2 minutes for Odoo to initialize, then open:

| Client     | URL                    | Description      |
|------------|------------------------|------------------|
| Prajantha  | http://localhost:8070  | First company    |
| Farmer     | http://localhost:8071  | Second company   |

Database administrator UI:

| Tool    | URL                   | Login email      | Password |
|---------|-----------------------|------------------|----------|
| pgAdmin | http://localhost:0308 | admin@saasdemo.com | admin123 |

---

## Setting Up Each Client

When you first open a client URL, you'll see the Database Manager page.

For each client, fill in:

| Field           | Prajantha              | Farmer                 |
|-----------------|------------------------|------------------------|
| Master Password | admin                  | admin                  |
| Database Name   | prajatha_db            | farmer_db              |
| Email           | admin@prajatha.com     | admin@farmer.com       |
| Password        | admin123               | admin123               |
| Language        | English                | English                |
| Country         | Your country           | Your country           |

Click **Create Database** and wait 1-2 minutes.

---

## Installing the Custom CRM Module

1. Log in to any client
2. Go to **Settings** > scroll down > click **Activate Developer Mode**
3. Go to **Apps** > click **Update Apps List** > confirm
4. Remove the "Apps" filter in the search bar
5. Search for `SaaS CRM Demo`
6. Click **Install**

The module adds "Company Code" and "Tenant Name" fields to CRM leads.

---

## Project Structure

```
odoo-saas-demo/
|-- docker-compose.yml        # Defines all Docker containers
|-- .env                      # Environment variables (passwords)
|-- nginx/
|   +-- default.conf          # Reverse proxy configuration
|-- prajatha/
|   |-- addons/               # Custom Odoo modules
|   |   +-- saas_crm_demo/    # Our demo CRM module
|   |-- data/                 # PostgreSQL database files
|   +-- odoo-data/            # Odoo filestore (attachments)
|-- farmer/                   # Farmer data, addons, and filestore
|-- backups/                  # Database backup files
|-- start-all.bat             # Start all containers
|-- stop-all.bat              # Stop all containers
|-- restart-all.bat           # Restart all containers
|-- backup-all.bat            # Backup all databases
|-- reset-all.bat             # Delete everything and start fresh
|-- DEMO-SCRIPT.md            # Step-by-step presentation guide
|-- TROUBLESHOOTING.md        # Solutions for common problems
|-- architecture-diagram.txt  # ASCII architecture diagram
+-- commands-cheatsheet.txt   # Useful Docker commands
```

---

## Management Scripts

| Script             | What it does                           |
|--------------------|----------------------------------------|
| `start-all.bat`    | Starts both clients                    |
| `stop-all.bat`     | Stops all clients (keeps data)         |
| `restart-all.bat`  | Stops and starts all clients           |
| `logs-prajatha.bat`  | Shows live logs for Prajatha         |
| `logs-farmer.bat`    | Shows live logs for Farmer           |
| `backup-all.bat`   | Creates SQL backups for all databases  |
| `reset-all.bat`    | DELETES all data and starts fresh      |

---

## Database Administrator (pgAdmin)

This project includes a dedicated **pgAdmin** container so an administrator can view all client databases from one place.

1. Open `http://localhost:0308`
2. Log in with:
   - Email: `admin@saasdemo.com`
   - Password: `admin123`
3. Expand the group **Odoo SaaS Clients**
4. You will see:
   - `Prajatha DB` (`db-prajatha`)
   - `Farmer DB` (`db-farmer`)
5. On first connect, enter each database password from `.env`:
   - `PRAJATHA_DB_PASSWORD` and `FARMER_DB_PASSWORD`

---

## Nginx Reverse Proxy (Optional)

If port 80 is available, you can also access clients via subdomains:

- http://prajatha.localhost
- http://farmer.localhost

Modern browsers (Chrome, Edge) resolve `*.localhost` automatically.

---

## Architecture Overview

```
Browser --> Port 8070 --> Odoo Prajantha --> PostgreSQL Prajantha
Browser --> Port 8071 --> Odoo Farmer --> PostgreSQL Farmer
Administrator --> Port 0308 --> pgAdmin --> All Client Databases
```

Each client pair (Odoo + PostgreSQL) runs on its own isolated Docker network. Prajantha cannot access Farmer's database, ensuring complete data isolation.

---

## Useful Commands

```cmd
# See running containers
docker compose ps

# View logs for a specific client
docker compose logs -f odoo-prajatha

# Stop a single client
docker compose stop odoo-farmer db-farmer

# Connect to a client's database
docker exec -it saas-db-prajatha psql -U odoo_prajatha

# Force recreate all containers
docker compose up -d --force-recreate
```

See `commands-cheatsheet.txt` for the full list.

---

## Stopping the Demo

```cmd
# Stop containers (data is preserved)
docker compose down

# Or double-click stop-all.bat
```

---

## Cleaning Up

To completely remove everything:

```cmd
# Stop containers and delete volumes
docker compose down -v

# Optional: Remove downloaded Docker images
docker rmi odoo:17 postgres:15 nginx:alpine
```

Or double-click `reset-all.bat`.

---

## Resource Usage

| Component       | RAM per instance | Total (2 clients) |
|----------------|------------------|-------------------|
| Odoo 17         | ~200-300 MB      | ~400-600 MB       |
| PostgreSQL 15   | ~50-100 MB       | ~100-200 MB       |
| Nginx           | ~10 MB           | ~10 MB            |
| **Total**       |                  | **~510-810 MB**   |

Recommended: Allocate at least 4GB RAM to Docker Desktop.
