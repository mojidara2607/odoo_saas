# Demo Script: Multi-Tenant SaaS with Odoo 17

> Use this guide to present the demo to your senior step by step.
> Estimated demo time: 15-20 minutes.

---

## Before the Demo (Preparation)

1. Make sure Docker Desktop is running
2. Double-click `start-all.bat` and wait 1-2 minutes
3. Open 5 browser tabs with these URLs:
   - Tab 1: http://localhost:8070
   - Tab 2: http://localhost:8071
   - Tab 3: http://localhost:8072
   - Tab 4: http://localhost:8073
   - Tab 5: http://localhost:8074
4. Each tab should show the Odoo database creation page

---

## Step 1: Show the Infrastructure (2 minutes)

**What to say:**
> "We have 5 completely isolated Odoo instances running, each with its own
> PostgreSQL database. Let me show you the running containers."

**Action:** Open a terminal and run:
```
docker compose ps
```

**Point out:**
- 10 containers are running (5 Odoo + 5 PostgreSQL)
- Each client has its own network (no cross-access)
- Each client maps to a different port (8070-8074)

---

## Step 2: Create Databases for Client 1 and Client 2 (3 minutes)

### Client 1 - "Acme Corporation"

1. Go to http://localhost:8070
2. You'll see the **Database Manager** page
3. Fill in:
   - **Master Password:** `admin` (default)
   - **Database Name:** `acme_corp`
   - **Email:** `admin@acme.com`
   - **Password:** `admin123`
   - **Language:** English
   - **Country:** Your country
   - Check "Demo data" (optional, adds sample data)
4. Click **Create Database**
5. Wait for Odoo to initialize (1-2 minutes)

### Client 2 - "Beta Industries"

1. Go to http://localhost:8071
2. Fill in:
   - **Master Password:** `admin`
   - **Database Name:** `beta_industries`
   - **Email:** `admin@beta.com`
   - **Password:** `admin123`
   - **Language:** English
   - **Country:** Your country
4. Click **Create Database**

**What to say:**
> "Notice that each client has their own database name, their own admin user,
> and their own password. These are completely separate PostgreSQL instances."

---

## Step 3: Demonstrate Data Isolation (3 minutes)

### In Client 1 (Acme Corp - port 8070):

1. Go to **Contacts** menu
2. Create a new contact:
   - Name: `John Smith - Acme`
   - Company: `Acme Corporation`
   - Email: `john@acme.com`
3. Save it

### In Client 2 (Beta Industries - port 8071):

1. Go to **Contacts** menu
2. **Show that John Smith does NOT exist here**
3. Create a different contact:
   - Name: `Jane Doe - Beta`
   - Company: `Beta Industries`
   - Email: `jane@beta.com`
4. Save it

**What to say:**
> "As you can see, Client 1 has John Smith but NOT Jane Doe. Client 2 has
> Jane Doe but NOT John Smith. The data is completely isolated. There's no
> way for one client to see another client's data."

---

## Step 4: Show the Custom CRM Module (3 minutes)

> Note: You need to install CRM and the custom module first.

### Install the Module in Client 1:

1. In Client 1 (http://localhost:8070), go to **Apps**
2. Remove the "Apps" filter from the search bar
3. Search for `CRM` and install it (if not already installed)
4. After CRM is installed, click **Update Apps List** (in Apps menu > Update Apps List)
5. Search for `SaaS CRM Demo`
6. Install it

### Demonstrate the Custom Field:

1. Go to **CRM** > **Pipeline**
2. Create a new lead:
   - Name: `Big Deal - Acme`
   - Expected Revenue: `50,000`
   - **Company Code:** `ACME-001` (this is our custom field!)
   - **Tenant Name:** `Acme Corporation`
3. Save it

**What to say:**
> "We've added a custom 'Company Code' field to CRM leads. This module is
> installed independently on each client. We could even give different clients
> different modules. This is exactly how SaaS platforms work - each tenant
> gets their own customized experience."

---

## Step 5: Show Different Modules Per Client (2 minutes)

1. In Client 1: Show that CRM and SaaS CRM Demo are installed
2. In Client 2: Go to Apps and show these modules are NOT installed
3. Install only CRM (not the custom module) in Client 2

**What to say:**
> "Each client can have different modules installed. Client 1 has our custom
> CRM module, but Client 2 doesn't. In a real SaaS product, you could offer
> different packages - Basic, Pro, Enterprise - each with different modules."

---

## Step 6: Explain the Architecture (3 minutes)

Open the file `architecture-diagram.txt` and show the ASCII diagram.

**Key points to explain:**

1. **Docker Containers:** Each client = 1 Odoo container + 1 PostgreSQL container
2. **Network Isolation:** Each pair runs on its own Docker network
3. **Data Persistence:** Database files are stored on your hard drive, not inside containers
4. **Scalability:** To add Client 6, just duplicate the config block
5. **Security:** Even if one client's database is compromised, others are safe

**What to say:**
> "In production, you'd use Kubernetes for orchestration, a load balancer
> instead of Nginx, and cloud-managed PostgreSQL. But the core concept is
> the same: one database per tenant, complete isolation."

---

## Step 7: Show Data Persists After Restart (2 minutes)

1. Stop all containers: double-click `stop-all.bat`
2. Show in Docker Desktop that all containers are stopped
3. Start again: double-click `start-all.bat`
4. Go back to http://localhost:8070
5. Login with `admin@acme.com` / `admin123`
6. Show that all data (contacts, CRM leads) is still there

**What to say:**
> "Even after stopping and restarting, all data is preserved. This is because
> we use Docker volumes that map to folders on the host machine."

---

## Bonus: Questions You Might Get

### "How would you scale this?"
> In production, we'd use Kubernetes to manage containers, a shared PostgreSQL
> cluster with separate databases, and a reverse proxy for routing.

### "What about backups?"
> Each database can be backed up independently using pg_dump. We have a
> backup script that automates this for all 5 clients.

### "How do you manage updates?"
> You update the Odoo Docker image version, then restart containers.
> All clients can be updated simultaneously or one at a time.

### "What about security?"
> Each client runs on its own Docker network. Client 1's Odoo cannot
> connect to Client 2's database. Plus, each has unique DB credentials.

### "How much resources does this use?"
> Each Odoo instance uses about 200-300MB RAM. With 5 clients, you need
> about 2-3GB total. In production, you'd use shared resources more efficiently.

---

## After the Demo

1. Run `stop-all.bat` to shut everything down
2. If you want to clean up completely, run `reset-all.bat`
