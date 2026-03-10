# Troubleshooting Guide

Common problems and solutions for the Odoo Multi-Tenant SaaS Demo.

---

## 1. Port Already in Use

**Error message:**
```
Error: Ports are not available: listen tcp 0.0.0.0:8070: bind: address already in use
```

**Solution:**

Find what's using the port:
```cmd
netstat -ano | findstr :8070
```

This shows the Process ID (PID). Kill it:
```cmd
taskkill /PID <PID_NUMBER> /F
```

Or change the port in the `.env` file:
```
PRAJATHA_PORT=9070
```

Then restart: `docker compose up -d`

---

## 2. Docker Desktop Not Running

**Error message:**
```
error during connect: This error may indicate that the docker daemon is not running
```

**Solution:**
1. Open **Docker Desktop** from the Start menu
2. Wait until the Docker icon in the system tray shows "Docker is running"
3. Then try your command again

If Docker Desktop won't start:
1. Open **Task Manager** (Ctrl+Shift+Esc)
2. Go to **Services** tab
3. Find `com.docker.service`
4. Right-click > **Start**

---

## 3. Database Connection Error

**Error message:**
```
psycopg2.OperationalError: could not connect to server
```

**Solution:**

The PostgreSQL container might not be ready yet. Wait 30 seconds and refresh.

If it persists:
```cmd
REM Check if the database container is running
docker compose ps db-prajatha

REM View database logs for errors
docker compose logs db-prajatha

REM Restart just the database
docker compose restart db-prajatha

REM Wait 10 seconds, then restart Odoo
docker compose restart odoo-prajatha
```

---

## 4. Permission Issues on Windows

**Error message:**
```
Permission denied: '/var/lib/postgresql/data'
```

**Solution:**

1. Right-click on the `prajatha/data` folder
2. Properties > Security > Edit
3. Add "Everyone" with Full Control (for development only!)

Or run in PowerShell as Administrator:
```powershell
icacls "C:\odoo-saas-demo\prajatha\data" /grant Everyone:F /T
```

Alternative fix - delete data and recreate:
```cmd
docker compose down
rd /s /q prajatha\data
mkdir prajatha\data
docker compose up -d
```

---

## 5. Odoo Page Shows "Internal Server Error"

**Solution:**

1. Check the Odoo logs:
```cmd
docker compose logs --tail=50 odoo-prajatha
```

2. Common causes:
   - Database not initialized yet (wait and refresh)
   - Module error (check the custom module code)
   - Memory issue (Docker needs at least 4GB RAM)

3. Fix Docker memory:
   - Open Docker Desktop > Settings > Resources
   - Set Memory to at least 4GB
   - Click Apply & Restart

---

## 6. "No Database Found" Page

**What happened:** Odoo is running but no database exists yet.

**Solution:** This is normal on first run! You need to create a database:
1. Go to http://localhost:8070/web/database/manager
2. Click "Create Database"
3. Fill in the details and create

---

## 7. Custom Module Not Showing in Apps

**Solution:**

1. Make sure the module files are in the correct folder:
   ```
   prajatha/addons/saas_crm_demo/__manifest__.py
   ```

2. In Odoo, go to:
   - Settings > Activate Developer Mode (at the bottom)
   - Then go to Apps > Update Apps List

3. Search for "SaaS CRM Demo" (remove any filters first)

4. If still not showing, restart the Odoo container:
   ```cmd
   docker compose restart odoo-prajatha
   ```

---

## 8. Containers Keep Restarting

**Solution:**

Check what's causing the crash:
```cmd
docker compose logs --tail=100 odoo-prajatha
```

Common causes:
- Database password mismatch (check `.env` file)
- Port conflict
- Corrupted data folder

Nuclear fix:
```cmd
docker compose down
rd /s /q prajatha\data prajatha\odoo-data
mkdir prajatha\data prajatha\odoo-data
docker compose up -d
```

---

## 9. Docker Compose Command Not Found

**Error:**
```
'docker compose' is not recognized
```

**Solution:**
- Make sure Docker Desktop is installed (not just Docker Engine)
- Docker Desktop includes `docker compose` (v2)
- If you have an older version, try `docker-compose` (with hyphen)

---

## 10. Running Out of Disk Space

**Solution:**

Check Docker disk usage:
```cmd
docker system df
```

Clean up unused resources:
```cmd
REM Remove stopped containers
docker container prune -f

REM Remove unused images
docker image prune -f

REM Remove unused volumes (CAREFUL: deletes data!)
docker volume prune -f
```

---

## 11. Nginx Shows "502 Bad Gateway"

**Solution:**

The Odoo container behind Nginx isn't ready yet.

1. Wait 30 seconds and refresh
2. Check if Odoo is running:
   ```cmd
   docker compose ps odoo-prajatha
   ```
3. Check Nginx logs:
   ```cmd
   docker compose logs nginx
   ```

---

## 12. How to Clean Up Everything

If you want to completely remove the demo:

```cmd
REM 1. Stop and remove all containers + volumes
docker compose down -v

REM 2. Remove Docker images (optional, saves disk space)
docker rmi odoo:17 postgres:15 nginx:alpine

REM 3. Delete the project folder
cd ..
rd /s /q odoo-saas-demo
```

---

## 13. Slow Performance

**Solutions:**

1. **Increase Docker resources:**
   - Docker Desktop > Settings > Resources
   - CPU: at least 4 cores
   - Memory: at least 4GB (6GB recommended for 5 instances)

2. **Start fewer clients:**
   ```cmd
   REM Start only 2 clients instead of 5
   docker compose up -d odoo-prajatha db-prajatha odoo-farmer db-farmer
   ```

3. **Disable Nginx if not needed:**
   ```cmd
   docker compose up -d --scale nginx=0
   ```

---

## Getting Help

If you're still stuck:

1. Check Docker logs: `docker compose logs -f`
2. Check container status: `docker compose ps`
3. Google the exact error message
4. Check Odoo forums: https://www.odoo.com/forum
5. Check Docker forums: https://forums.docker.com
