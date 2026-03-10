# Ubuntu Server Setup

Use this guide to deploy the current Odoo Docker project on an Ubuntu server where:

- Docker is already installed
- PostgreSQL is already installed on the server itself
- You do not want to use pgAdmin

## Files To Upload

Upload these files and folders to the server:

- `docker-compose.yml`
- `.env`
- `nginx/default.conf`
- `prajatha/`
- `farmer/`

Do not upload `admin/`. It is not needed for this server setup.

## Target Folder On Server

Recommended path:

```bash
/opt/odoo-saas-demo
```

## Step 1: Create Project Folder

Run on Ubuntu:

```bash
sudo mkdir -p /opt/odoo-saas-demo
sudo chown -R $USER:$USER /opt/odoo-saas-demo
cd /opt/odoo-saas-demo
```

## Step 2: Upload Project Files

From your Windows machine, run:

```powershell
scp -r docker-compose.yml .env nginx prajatha farmer username@your-server-ip:/opt/odoo-saas-demo/
```

Replace:

- `username` with your Ubuntu server username
- `104.248.42.69` is your server IP

## Step 3: Verify Files On Server

Run on Ubuntu:

```bash
cd /opt/odoo-saas-demo
ls -la
find nginx prajatha farmer -maxdepth 2 -type d
```

Expected structure:

```text
/opt/odoo-saas-demo/
  docker-compose.yml
  .env
  nginx/default.conf
  prajatha/
    addons/
    odoo-data/
  farmer/
    addons/
    odoo-data/
```

## Optional: If You Do Not Want Nginx

If you only want direct access by port, you can still keep `nginx/default.conf` on disk, but you do not need to use the Nginx URL.

Use these direct URLs:

- `http://104.248.42.69:8070`
- `http://104.248.42.69:8071`

## Step 4: Start Containers

Run:

```bash
cd /opt/odoo-saas-demo
docker compose up -d
```

## Step 5: Check Status

Run:

```bash
docker compose ps
```

Expected published ports:

- `8070` -> `odoo-prajatha`
- `8071` -> `odoo-farmer`
- `80` -> `nginx`

You can also check with:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

## Step 6: Open In Browser

Use:

- `http://104.248.42.69:8070`
- `http://104.248.42.69:8071`

Server IP used here: `104.248.42.69`

If you configure a real domain later, then Nginx can proxy traffic on port `80`.

## Step 7: View Logs

Run:

```bash
docker compose logs -f odoo-prajatha
docker compose logs -f odoo-farmer
```

## Step 8: Open Firewall Ports

If `ufw` is enabled:

```bash
sudo ufw allow 8070
sudo ufw allow 8071
sudo ufw allow 80
sudo ufw reload
```

## Notes

- This setup uses PostgreSQL already installed on the Ubuntu server.
- No PostgreSQL Docker container is used.
- Docker Compose reads the DB host, port, username, password, database, and SSL mode from `.env`.
- `host.docker.internal` is mapped to the Ubuntu host so the Odoo containers can reach PostgreSQL running on the server.

## PostgreSQL Setup On Ubuntu

The Odoo containers connect to PostgreSQL on the Ubuntu host. For that to work, PostgreSQL must allow connections from Docker containers.

### 1. Create users and databases

Run as the `postgres` user:

```bash
sudo -u postgres psql
```

Then run:

```sql
CREATE USER prajatha WITH PASSWORD 'test';
CREATE USER farmer WITH PASSWORD 'test';
CREATE DATABASE prajatha_db OWNER prajatha;
CREATE DATABASE farmer_db OWNER farmer;
\q
```

### 2. Allow PostgreSQL to listen for Docker connections

Edit:

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Set:

```conf
listen_addresses = '*'
```

### 3. Allow authentication from Docker network

Edit:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Add this line:

```conf
host    all    all    172.17.0.0/16    md5
```

If your Docker bridge uses a different subnet, use that subnet instead.

### 4. Restart PostgreSQL

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

## Important Warning

If PostgreSQL only listens on `127.0.0.1` or `pg_hba.conf` does not allow Docker traffic, Odoo containers will fail to connect.
