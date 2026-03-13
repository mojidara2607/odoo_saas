# Odoo 19 Manufacturing (MRP) Module — Complete Reference for Perfex CRM Rebuild

> This document contains the FULL database structure, fields, workflows, roles, permissions,
> and connected modules from Odoo 19's Manufacturing module — extracted directly from the
> running Odoo 19 Docker container source code.

---

## TABLE OF CONTENTS

1. [Module Overview](#1-module-overview)
2. [Complete Database Tables & Fields](#2-complete-database-tables--fields)
3. [Connected Modules & Dependencies](#3-connected-modules--dependencies)
4. [Complete Workflow & State Machine](#4-complete-workflow--state-machine)
5. [Roles & Permissions (Security Groups)](#5-roles--permissions-security-groups)
6. [Access Control Matrix](#6-access-control-matrix)
7. [Multi-Company Rules](#7-multi-company-rules)
8. [Configuration Settings](#8-configuration-settings)
9. [Relationship Diagram](#9-relationship-diagram)
10. [Perfex CRM Implementation Guide](#10-perfex-crm-implementation-guide)

---

## 1. MODULE OVERVIEW

- **Module name:** `mrp` (Manufacturing Resource Planning)
- **Odoo version:** 19.0
- **Category:** Supply Chain / Manufacturing
- **Dependencies:** `product`, `stock`, `resource`
- **Description:** Manages Bills of Materials, Manufacturing Orders, Work Centers, Work Orders, Unbuild Orders, and production planning.

### Core Concepts
| Concept | Odoo Model | What It Does |
|---------|-----------|--------------|
| Bill of Materials (BoM) | `mrp.bom` | Recipe/formula — lists components needed to make a product |
| BoM Line | `mrp.bom.line` | Individual component in a BoM |
| By-product | `mrp.bom.byproduct` | Secondary products created during manufacturing |
| Manufacturing Order (MO) | `mrp.production` | The actual production order |
| Work Center | `mrp.workcenter` | Machine/station where work happens |
| Work Order | `mrp.workorder` | Individual operation step within an MO |
| Operation/Routing | `mrp.routing.workcenter` | Step definition linked to a BoM |
| Unbuild Order | `mrp.unbuild` | Reverse manufacturing (disassemble) |
| Productivity Log | `mrp.workcenter.productivity` | Time tracking for work centers |

---

## 2. COMPLETE DATABASE TABLES & FIELDS

### 2.1 `mrp_production` — Manufacturing Orders

The main table. Each row = one manufacturing order.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | auto | Primary key |
| name | VARCHAR | Reference | Yes | 'New' (auto-sequence) | e.g., "MO/00001" |
| priority | VARCHAR | Priority | No | '0' | Values: '0'=Normal, '1'=Urgent |
| backorder_sequence | INTEGER | Backorder Sequence | No | 0 | For split orders |
| origin | VARCHAR | Source | No | | Source document (e.g., SO number) |
| product_id | INTEGER (FK) | Product | Yes | | FK → product_product.id |
| product_tmpl_id | INTEGER (FK) | Product Template | No | | FK → product_template.id (related via product_id) |
| production_group_id | INTEGER (FK) | Production Group | No | | FK → mrp_production_group.id |
| product_qty | FLOAT | Quantity To Produce | Yes | | Amount to manufacture |
| product_uom_id | INTEGER (FK) | Unit of Measure | Yes | | FK → uom_uom.id |
| product_uom_qty | FLOAT | Total Quantity | No | | Computed: qty in product's default UoM |
| qty_producing | FLOAT | Quantity Producing | No | | Currently being produced |
| qty_produced | FLOAT | Quantity Produced | No | | Computed: total done |
| bom_id | INTEGER (FK) | Bill of Material | No | | FK → mrp_bom.id |
| picking_type_id | INTEGER (FK) | Operation Type | Yes | | FK → stock_picking_type.id |
| location_src_id | INTEGER (FK) | Components Location | Yes | | FK → stock_location.id (where raw materials come from) |
| location_dest_id | INTEGER (FK) | Finished Products Location | Yes | | FK → stock_location.id (where finished goods go) |
| location_final_id | INTEGER (FK) | Final Location | No | | FK → stock_location.id |
| production_location_id | INTEGER (FK) | Production Location | No | | FK → stock_location.id (virtual production location) |
| date_start | TIMESTAMP | Start Date | Yes | now() | When production starts |
| date_finished | TIMESTAMP | End Date | No | | When production finished (computed) |
| date_deadline | TIMESTAMP | Deadline | No | | Expected completion |
| duration_expected | FLOAT | Expected Duration (min) | No | | Computed from operations |
| duration | FLOAT | Real Duration (min) | No | | Actual time spent |
| state | VARCHAR | State | Yes | 'draft' | See state machine below |
| reservation_state | VARCHAR | MO Readiness | No | | Values: confirmed/assigned/waiting |
| user_id | INTEGER (FK) | Responsible | No | current user | FK → res_users.id |
| company_id | INTEGER (FK) | Company | Yes | current company | FK → res_company.id |
| consumption | VARCHAR | Consumption | Yes | 'flexible' | Values: flexible/warning/strict |
| propagate_cancel | BOOLEAN | Propagate Cancel | No | False | |
| is_locked | BOOLEAN | Is Locked | No | True/False | Locks editing |
| is_planned | BOOLEAN | Operations Planned | No | | Computed |
| is_outdated_bom | BOOLEAN | Outdated BoM | No | False | |
| is_delayed | BOOLEAN | Is Delayed | No | | Computed |
| allow_workorder_dependencies | BOOLEAN | WO Dependencies | No | False | |
| product_description_variants | VARCHAR | Custom Description | No | | |
| orderpoint_id | INTEGER (FK) | Orderpoint | No | | FK → stock_warehouse_orderpoint.id |
| delay_alert_date | TIMESTAMP | Delay Alert | No | | Computed |

**State Values for `state`:**
| Value | Label | Description |
|-------|-------|-------------|
| `draft` | Draft | MO created but not confirmed |
| `confirmed` | Confirmed | MO confirmed, waiting for components |
| `progress` | In Progress | Production started |
| `to_close` | To Close | Production done, pending closure |
| `done` | Done | Fully completed |
| `cancel` | Cancelled | Cancelled |

**Reservation State Values:**
| Value | Label |
|-------|-------|
| `confirmed` | Waiting |
| `assigned` | Ready |
| `waiting` | Waiting Another Operation |

---

### 2.2 `mrp_production_group` — Production Groups

Groups related manufacturing orders together.

| Field Name | DB Type | Label | Required | Description |
|-----------|---------|-------|----------|-------------|
| id | INTEGER | ID | auto | Primary key |
| name | VARCHAR | Name | Yes | Group name |

**Relation tables:**
- `mrp_production_group_rel` (parent_group_id, child_group_id) — M2M self-relation

---

### 2.3 `mrp_bom` — Bills of Materials

The recipe/formula for manufacturing a product.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| code | VARCHAR | Reference | No | | Internal reference code |
| active | BOOLEAN | Active | No | True | Archive toggle |
| type | VARCHAR | BoM Type | Yes | 'normal' | 'normal'=Manufacture, 'phantom'=Kit |
| product_tmpl_id | INTEGER (FK) | Product | Yes | | FK → product_template.id |
| product_id | INTEGER (FK) | Product Variant | No | | FK → product_product.id (specific variant) |
| product_qty | FLOAT | Quantity | Yes | 1.0 | Quantity this BoM produces |
| product_uom_id | INTEGER (FK) | Unit | Yes | | FK → uom_uom.id |
| sequence | INTEGER | Sequence | No | | Display order |
| ready_to_produce | VARCHAR | Manufacturing Readiness | Yes | 'all_available' | 'all_available' or 'asap' |
| picking_type_id | INTEGER (FK) | Operation Type | No | | FK → stock_picking_type.id |
| company_id | INTEGER (FK) | Company | No | current | FK → res_company.id |
| consumption | VARCHAR | Flexible Consumption | Yes | 'warning' | flexible/warning/strict |
| allow_operation_dependencies | BOOLEAN | Operation Dependencies | No | False | |
| produce_delay | INTEGER | Mfg Lead Time (days) | No | 0 | |
| days_to_prepare_mo | INTEGER | Days to Prepare MO | No | 0 | |
| batch_size | FLOAT | Batch Size | No | 1.0 | |
| enable_batch_size | BOOLEAN | Enable Batch Size | No | False | |

**BoM Type values:**
| Value | Label | Behavior |
|-------|-------|----------|
| `normal` | Manufacture this product | Creates manufacturing orders |
| `phantom` | Kit | Auto-explodes into components (no MO created) |

---

### 2.4 `mrp_bom_line` — BoM Components

Each component line in a Bill of Materials.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| product_id | INTEGER (FK) | Component | Yes | | FK → product_product.id |
| product_tmpl_id | INTEGER (FK) | Product Template | No | | FK → product_template.id (related) |
| product_qty | FLOAT | Quantity | Yes | 1.0 | Amount needed per BoM qty |
| product_uom_id | INTEGER (FK) | Unit | Yes | | FK → uom_uom.id |
| sequence | INTEGER | Sequence | No | 1 | Display order |
| bom_id | INTEGER (FK) | Parent BoM | Yes | | FK → mrp_bom.id (CASCADE delete) |
| operation_id | INTEGER (FK) | Consumed in Operation | No | | FK → mrp_routing_workcenter.id |
| company_id | INTEGER (FK) | Company | No | | FK → res_company.id (from bom) |

**M2M relation table:** `mrp_bom_line_product_template_attribute_value_rel` — for variant-specific BoM lines

---

### 2.5 `mrp_bom_byproduct` — By-products

Secondary outputs of manufacturing.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| product_id | INTEGER (FK) | By-product | Yes | | FK → product_product.id |
| product_qty | FLOAT | Quantity | Yes | 1.0 | |
| product_uom_id | INTEGER (FK) | Unit | Yes | | FK → uom_uom.id |
| bom_id | INTEGER (FK) | BoM | No | | FK → mrp_bom.id (CASCADE delete) |
| operation_id | INTEGER (FK) | Produced in Operation | No | | FK → mrp_routing_workcenter.id |
| sequence | INTEGER | Sequence | No | | |
| cost_share | FLOAT | Cost Share (%) | No | | Percentage of cost allocated |
| company_id | INTEGER (FK) | Company | No | | FK → res_company.id |

---

### 2.6 `mrp_workcenter` — Work Centers

Machines, stations, or areas where manufacturing operations occur.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| name | VARCHAR | Work Center | Yes | | Name of the work center |
| resource_id | INTEGER (FK) | Resource | Yes | | FK → resource_resource.id (from resource.mixin) |
| code | VARCHAR | Code | No | | Short code |
| note | TEXT | Description | No | | HTML description |
| sequence | INTEGER | Sequence | Yes | 1 | Display order |
| color | INTEGER | Color | No | | For kanban |
| costs_hour | FLOAT | Cost per Hour | No | 0.0 | Hourly rate |
| time_efficiency | FLOAT | Time Efficiency (%) | No | 100 | 100% = normal speed |
| time_start | FLOAT | Setup Time (min) | No | | Time before each operation |
| time_stop | FLOAT | Cleanup Time (min) | No | | Time after each operation |
| active | BOOLEAN | Active | No | True | |
| oee_target | FLOAT | OEE Target (%) | No | 90 | Target efficiency |
| company_id | INTEGER (FK) | Company | No | | FK → res_company.id |
| resource_calendar_id | INTEGER (FK) | Working Hours | No | | FK → resource_calendar.id |
| currency_id | INTEGER (FK) | Currency | Yes | | FK → res_currency.id |

**Computed/display fields (not stored but useful for Perfex):**
- `working_state`: normal / blocked / done
- `oee`: Overall Equipment Effectiveness %
- `performance`: Performance metric
- `workorder_count`: Number of work orders
- `workcenter_load`: Current load in hours

**M2M relation table:** `mrp_workcenter_alternative_rel` — alternative work centers

---

### 2.7 `mrp_workcenter_tag` — Work Center Tags

| Field Name | DB Type | Label | Required | Description |
|-----------|---------|-------|----------|-------------|
| id | INTEGER | ID | auto | Primary key |
| name | VARCHAR | Tag Name | Yes | |
| color | INTEGER | Color | No | |

---

### 2.8 `mrp_workcenter_capacity` — Product-Specific Capacities

Different products may have different capacities at a work center.

| Field Name | DB Type | Label | Required | Description |
|-----------|---------|-------|----------|-------------|
| id | INTEGER | ID | auto | Primary key |
| workcenter_id | INTEGER (FK) | Work Center | Yes | FK → mrp_workcenter.id |
| product_id | INTEGER (FK) | Product | No | FK → product_product.id |
| product_uom_id | INTEGER (FK) | Unit | Yes | FK → uom_uom.id |
| capacity | FLOAT | Capacity | No | Units per cycle |
| time_start | FLOAT | Setup Time (min) | No | Override per product |
| time_stop | FLOAT | Cleanup Time (min) | No | Override per product |

---

### 2.9 `mrp_routing_workcenter` — Operations (Routing Steps)

Defines the sequence of operations in a BoM.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| name | VARCHAR | Operation | Yes | | Operation name |
| active | BOOLEAN | Active | No | True | |
| workcenter_id | INTEGER (FK) | Work Center | Yes | | FK → mrp_workcenter.id |
| sequence | INTEGER | Sequence | No | 100 | Operation order |
| bom_id | INTEGER (FK) | Bill of Material | Yes | | FK → mrp_bom.id (CASCADE delete) |
| company_id | INTEGER (FK) | Company | No | | Related from bom |
| time_mode | VARCHAR | Duration Computation | No | 'manual' | 'manual'=Fixed, 'auto'=Computed |
| time_mode_batch | INTEGER | Based on | No | 10 | Number of WOs for auto computation |
| time_cycle_manual | FLOAT | Manual Duration (min) | No | 60 | |
| time_cycle | FLOAT | Duration per Cycle | No | | Computed |
| cost_mode | VARCHAR | Cost Based On | No | 'actual' | 'actual' or 'estimated' |

**M2M relation table:** `mrp_routing_workcenter_dependencies_rel` (operation_id, blocked_by_id) — operation dependencies

---

### 2.10 `mrp_workorder` — Work Orders

Individual operation instances within a Manufacturing Order.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| name | VARCHAR | Work Order | Yes | | Name |
| sequence | INTEGER | Sequence | No | 100 | Order of execution |
| barcode | VARCHAR | Barcode | No | | Computed |
| workcenter_id | INTEGER (FK) | Work Center | Yes | | FK → mrp_workcenter.id |
| production_id | INTEGER (FK) | Manufacturing Order | Yes | | FK → mrp_production.id |
| operation_id | INTEGER (FK) | Operation | No | | FK → mrp_routing_workcenter.id |
| state | VARCHAR | Status | Yes | 'ready' | See states below |
| qty_producing | FLOAT | Currently Producing | No | | |
| qty_produced | FLOAT | Quantity Done | No | 0.0 | |
| qty_remaining | FLOAT | Remaining | No | | Computed |
| qty_reported_from_previous_wo | FLOAT | Carried Quantity | No | | From previous WO |
| date_start | TIMESTAMP | Start | No | | |
| date_finished | TIMESTAMP | End | No | | |
| duration_expected | FLOAT | Expected Duration (min) | No | | |
| duration | FLOAT | Real Duration (min) | No | | |
| duration_unit | FLOAT | Duration Per Unit | No | | |
| duration_percent | INTEGER | Duration Deviation % | No | | |
| costs_hour | FLOAT | Cost per Hour | No | 0.0 | |
| cost_mode | VARCHAR | Cost Mode | No | 'actual' | |
| leave_id | INTEGER (FK) | Calendar Leave | No | | FK → resource_calendar_leaves.id |
| production_date | TIMESTAMP | Production Date | No | | Computed |

**Work Order States:**
| Value | Label | Description |
|-------|-------|-------------|
| `blocked` | Blocked | Waiting for dependency |
| `ready` | Ready | Ready to start |
| `progress` | In Progress | Currently being worked on |
| `done` | Done | Completed |
| `cancel` | Cancelled | |

**M2M relation table:** `mrp_workorder_dependencies_rel` (id, blocked_by_workorder_id) — WO dependencies

---

### 2.11 `mrp_workcenter_productivity` — Time Tracking Logs

Every start/stop event at a work center.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| workcenter_id | INTEGER (FK) | Work Center | Yes | | FK → mrp_workcenter.id |
| workorder_id | INTEGER (FK) | Work Order | No | | FK → mrp_workorder.id |
| production_id | INTEGER (FK) | Manufacturing Order | No | | Related via workorder |
| user_id | INTEGER (FK) | User | No | current | FK → res_users.id |
| loss_id | INTEGER (FK) | Loss Reason | Yes | | FK → mrp_workcenter_productivity_loss.id |
| loss_type | VARCHAR | Effectiveness | No | | From loss_id |
| description | TEXT | Description | No | | |
| date_start | TIMESTAMP | Start Date | Yes | now() | |
| date_end | TIMESTAMP | End Date | No | | |
| duration | FLOAT | Duration (min) | No | | Computed from dates |
| company_id | INTEGER (FK) | Company | Yes | | FK → res_company.id |

---

### 2.12 `mrp_workcenter_productivity_loss` — Blocking Reasons

| Field Name | DB Type | Label | Required | Description |
|-----------|---------|-------|----------|-------------|
| id | INTEGER | ID | auto | Primary key |
| name | VARCHAR | Blocking Reason | Yes | Translatable |
| sequence | INTEGER | Sequence | No | 1 |
| manual | BOOLEAN | Is a Blocking Reason | No | True |
| loss_id | INTEGER (FK) | Category | No | FK → mrp_workcenter_productivity_loss_type.id |
| loss_type | VARCHAR | Effectiveness Category | No | From loss_id |

---

### 2.13 `mrp_workcenter_productivity_loss_type` — Loss Categories

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| loss_type | VARCHAR | Category | Yes | 'availability' | Values: availability/performance/quality/productive |

---

### 2.14 `mrp_unbuild` — Unbuild (Disassembly) Orders

Reverse a manufacturing process.

| Field Name | DB Type | Label | Required | Default | Description |
|-----------|---------|-------|----------|---------|-------------|
| id | INTEGER | ID | auto | | Primary key |
| name | VARCHAR | Reference | No | 'New' | Auto-sequence |
| product_id | INTEGER (FK) | Product | Yes | | FK → product_product.id |
| product_qty | FLOAT | Quantity | Yes | 1.0 | |
| product_uom_id | INTEGER (FK) | Unit | Yes | | FK → uom_uom.id |
| bom_id | INTEGER (FK) | Bill of Material | No | | FK → mrp_bom.id |
| mo_id | INTEGER (FK) | Manufacturing Order | No | | FK → mrp_production.id (must be done) |
| lot_id | INTEGER (FK) | Lot/Serial Number | No | | FK → stock_lot.id |
| location_id | INTEGER (FK) | Source Location | Yes | | FK → stock_location.id |
| location_dest_id | INTEGER (FK) | Destination Location | Yes | | FK → stock_location.id |
| company_id | INTEGER (FK) | Company | Yes | current | FK → res_company.id |
| state | VARCHAR | Status | No | 'draft' | 'draft' or 'done' |

---

### 2.15 `stock_move` — Inventory Moves (MRP Extensions)

These fields are ADDED to the existing stock_move table by the MRP module.

| Field Name | DB Type | Label | Description |
|-----------|---------|-------|-------------|
| created_production_id | INTEGER (FK) | Created Production Order | FK → mrp_production.id |
| production_id | INTEGER (FK) | Production Order (finished) | FK → mrp_production.id (CASCADE) |
| raw_material_production_id | INTEGER (FK) | Production Order (components) | FK → mrp_production.id (CASCADE) |
| production_group_id | INTEGER (FK) | Production Group | FK → mrp_production_group.id |
| unbuild_id | INTEGER (FK) | Disassembly Order | FK → mrp_unbuild.id |
| consume_unbuild_id | INTEGER (FK) | Consumed Disassembly Order | FK → mrp_unbuild.id |
| operation_id | INTEGER (FK) | Operation To Consume | FK → mrp_routing_workcenter.id |
| workorder_id | INTEGER (FK) | Work Order To Consume | FK → mrp_workorder.id |
| bom_line_id | INTEGER (FK) | BoM Line | FK → mrp_bom_line.id |
| byproduct_id | INTEGER (FK) | By-product Line | FK → mrp_bom_byproduct.id |
| unit_factor | FLOAT | Unit Factor | Ratio of MO qty to move qty |
| cost_share | FLOAT | Cost Share (%) | For by-products |
| manual_consumption | BOOLEAN | Manual Consumption | Don't auto-consume |

---

### 2.16 `stock_move_line` — Detailed Move Lines (MRP Extensions)

| Field Name | DB Type | Label | Description |
|-----------|---------|-------|-------------|
| workorder_id | INTEGER (FK) | Work Order | FK → mrp_workorder.id |
| production_id | INTEGER (FK) | Production Order | FK → mrp_production.id |

---

## 3. CONNECTED MODULES & DEPENDENCIES

### Direct Dependencies (Required)
```
mrp
├── product          — Product definitions (product_product, product_template)
├── stock            — Inventory/warehouse (stock_move, stock_location, stock_picking, stock_quant)
└── resource         — Work calendars, working hours (resource_calendar, resource_resource)
```

### Related/Connected Tables from Dependencies

| Table | Module | How MRP Uses It |
|-------|--------|-----------------|
| `product_product` | product | Products being manufactured & components |
| `product_template` | product | Product templates for BoMs |
| `uom_uom` | uom | Units of measure for quantities |
| `stock_move` | stock | Raw material consumption & finished goods production |
| `stock_move_line` | stock | Detailed tracking with lots/serials |
| `stock_location` | stock | Source, destination, production locations |
| `stock_picking` | stock | Transfer documents |
| `stock_picking_type` | stock | Operation types (manufacturing) |
| `stock_quant` | stock | Current stock levels |
| `stock_lot` | stock | Lot/serial number tracking |
| `stock_warehouse` | stock | Warehouse configuration |
| `stock_warehouse_orderpoint` | stock | Reordering rules |
| `stock_rule` | stock | Procurement rules |
| `stock_route` | stock | Routes (manufacture route) |
| `stock_scrap` | stock | Scrap management |
| `resource_resource` | resource | Work center resources |
| `resource_calendar` | resource | Working hour schedules |
| `resource_calendar_attendance` | resource | Daily attendance lines |
| `resource_calendar_leaves` | resource | Holidays/leaves |
| `res_company` | base | Multi-company support |
| `res_users` | base | User assignments |
| `res_partner` | base | Contacts |
| `mail_thread` | mail | Chatter/messaging on MOs, BoMs |
| `mail_activity` | mail | Activity scheduling |

### Optional Extension Modules
| Module | What It Adds |
|--------|-------------|
| `mrp_account` | Cost accounting for manufacturing |
| `mrp_subcontracting` | Outsourced manufacturing |
| `mrp_plm` | Product Lifecycle Management / Engineering Change Orders |
| `mrp_mps` | Master Production Schedule |
| `quality_control` | Quality checks during production |
| `maintenance` | Equipment maintenance for work centers |
| `purchase_mrp` | Auto-purchase when components are missing |
| `sale_mrp` | Link sales orders to manufacturing |

---

## 4. COMPLETE WORKFLOW & STATE MACHINE

### 4.1 Manufacturing Order Lifecycle

```
                        ┌──────────────────────────────────┐
                        │                                  │
   ┌──────┐    confirm  │  ┌───────────┐    ┌──────────┐   │   ┌──────┐
   │ DRAFT├────────────►│  │ CONFIRMED │───►│ PROGRESS │───┼──►│ DONE │
   └──┬───┘             │  └─────┬─────┘    └────┬─────┘   │   └──────┘
      │                 │        │               │         │
      │                 │        │          ┌────▼─────┐   │
      │   cancel        │        │          │ TO_CLOSE ├───┘
      ▼                 │        │          └──────────┘
   ┌────────┐           │        │
   │CANCELLED│◄─────────┼────────┘ (cancel at any point before done)
   └────────┘           │
                        └──────────────────────────────────┘
```

### 4.2 Detailed Flow

```
1. CREATE Manufacturing Order (state=draft)
   └── User creates MO (manually or auto from Sales/Reorder Rules)
   └── BoM is selected → components auto-populated
   └── Work orders auto-created from BoM operations

2. CONFIRM (state=confirmed)
   └── action_confirm()
   └── Components reserved from stock (reservation_state=assigned if available)
   └── If not available: reservation_state=confirmed (waiting)

3. START PRODUCTION (state=progress)
   └── User starts producing (clicks "Produce")
   └── Sets qty_producing
   └── Work orders can be started individually

4. RECORD PRODUCTION
   └── User records qty_producing
   └── Components consumed (stock_move done)
   └── Finished product produced (stock_move done)

5. MARK AS DONE (state=done) or TO_CLOSE (state=to_close)
   └── button_mark_done()
   └── If all qty produced → done
   └── If partial → can create backorder

6. CANCEL (state=cancel)
   └── action_cancel()
   └── Unreserves components
```

### 4.3 Work Order Lifecycle

```
  ┌─────────┐     ┌───────┐     ┌──────────┐     ┌──────┐
  │ BLOCKED │────►│ READY │────►│ PROGRESS │────►│ DONE │
  └─────────┘     └───────┘     └──────────┘     └──────┘
                      │                               │
                      └──► CANCEL ◄───────────────────┘
```

- **BLOCKED**: Waiting for a dependency (another WO to finish)
- **READY**: Can be started
- **PROGRESS**: Worker is actively working (time tracking active)
- **DONE**: Operation completed

### 4.4 Unbuild Order Flow

```
  ┌───────┐    action_unbuild    ┌──────┐
  │ DRAFT │─────────────────────►│ DONE │
  └───────┘                      └──────┘
```

---

## 5. ROLES & PERMISSIONS (SECURITY GROUPS)

### 5.1 User Groups

| Group XML ID | Name | Level | Implies |
|-------------|------|-------|---------|
| `mrp.group_mrp_user` | Manufacturing User | Basic | stock.group_stock_user |
| `mrp.group_mrp_manager` | Manufacturing Administrator | Full | mrp.group_mrp_user |

### 5.2 Feature Groups (Toggleable Settings)

| Group XML ID | Name | What It Enables |
|-------------|------|----------------|
| `mrp.group_mrp_routings` | Work Orders | Enables operations/routing/work orders |
| `mrp.group_mrp_byproducts` | By-Products | Enables by-product lines on BoMs |
| `mrp.group_unlocked_by_default` | Unlock MOs | MOs are editable by default |
| `mrp.group_mrp_reception_report` | Reception Report | Allocation report for MOs |
| `mrp.group_mrp_workorder_dependencies` | WO Dependencies | Work order dependency chains |

---

## 6. ACCESS CONTROL MATRIX

### Full CRUD Permissions per Model per Role

| Model | User (Read) | User (Write) | User (Create) | User (Delete) | Manager (Read) | Manager (Write) | Manager (Create) | Manager (Delete) |
|-------|:-----------:|:------------:|:--------------:|:--------------:|:--------------:|:---------------:|:-----------------:|:-----------------:|
| mrp.production | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| mrp.bom | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.bom.line | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.bom.byproduct | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.workcenter | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.workorder | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| mrp.routing.workcenter | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.unbuild | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| mrp.workcenter.productivity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| mrp.workcenter.productivity.loss | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.workcenter.tag | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| mrp.workcenter.capacity | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| stock.move (via MRP) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Additional Cross-Module Access for MRP Users
| Model | MRP User | MRP Manager |
|-------|----------|-------------|
| product.product | Read | Read |
| product.template | Read | Read |
| uom.uom | Read | Read |
| res.partner | Read | Read/Write/Create |
| resource.calendar | Read | Read/Write/Create/Delete |
| resource.calendar.leaves | RWCD | Read |
| resource.calendar.attendance | RWCD | RWCD |
| resource.resource | Read | RWCD |
| product.supplierinfo | - | Read |
| product.pricelist.item | - | RWCD |

### Stock Workers (Warehouse Users)
| Model | Permissions |
|-------|------------|
| mrp.production | Read only |
| mrp.bom | Read only |
| mrp.bom.line | Read only |

---

## 7. MULTI-COMPANY RULES

Every major MRP model has multi-company record rules:

| Model | Rule | Domain Filter |
|-------|------|---------------|
| mrp.production | Company restriction | `[('company_id', 'in', company_ids)]` |
| mrp.unbuild | Company restriction | `[('company_id', 'in', company_ids)]` |
| mrp.workcenter | Company + shared | `[('company_id', 'in', company_ids + [False])]` |
| mrp.workorder | Company restriction | `[('company_id', 'in', company_ids)]` |
| mrp.bom | Company + shared | `[('company_id', 'in', company_ids + [False])]` |
| mrp.bom.line | Company + shared | `[('company_id', 'in', company_ids + [False])]` |
| mrp.bom.byproduct | Company + shared | `[('company_id', 'in', company_ids + [False])]` |
| mrp.routing.workcenter | Company + shared | `[('company_id', 'in', company_ids + [False])]` |
| mrp.workcenter.productivity | Company restriction | `[('company_id', 'in', company_ids)]` |

**Note:** `company_ids + [False]` means records with no company are visible to all companies (shared configuration).

---

## 8. CONFIGURATION SETTINGS

These are toggles in Settings > Manufacturing:

| Setting | Field | What It Enables |
|---------|-------|----------------|
| By-Products | `group_mrp_byproducts` | By-product lines on BoMs |
| Work Orders | `group_mrp_routings` | Operations, work centers, work orders |
| Unlock MOs | `group_unlocked_by_default` | MOs editable by default |
| Reception Report | `group_mrp_reception_report` | Allocation report |
| WO Dependencies | `group_mrp_workorder_dependencies` | Operation dependency chains |
| Subcontracting | `module_mrp_subcontracting` | Installs subcontracting module |
| Quality | `module_quality_control` | Installs quality control module |
| PLM | `module_mrp_plm` | Installs Product Lifecycle Management |
| MPS | `module_mrp_mps` | Installs Master Production Schedule |

---

## 9. RELATIONSHIP DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BILL OF MATERIALS (mrp_bom)                     │
│  product_tmpl_id ──► product_template                               │
│  product_id ──► product_product (optional variant)                  │
│  picking_type_id ──► stock_picking_type                             │
│  company_id ──► res_company                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────────┐            │
│  │ mrp_bom_line         │    │ mrp_routing_workcenter   │            │
│  │ (BoM Components)     │    │ (Operations)             │            │
│  │ bom_id ──► mrp_bom  │    │ bom_id ──► mrp_bom      │            │
│  │ product_id ──► prod  │    │ workcenter_id ──► wc    │            │
│  │ operation_id ──► op  │    │                          │            │
│  └─────────────────────┘    └─────────────────────────┘            │
│                                                                     │
│  ┌─────────────────────┐                                            │
│  │ mrp_bom_byproduct   │                                            │
│  │ bom_id ──► mrp_bom  │                                            │
│  │ product_id ──► prod  │                                            │
│  │ operation_id ──► op  │                                            │
│  └─────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    (used by) │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MANUFACTURING ORDER (mrp_production)                    │
│  bom_id ──► mrp_bom                                                 │
│  product_id ──► product_product                                     │
│  picking_type_id ──► stock_picking_type                             │
│  location_src_id ──► stock_location                                 │
│  location_dest_id ──► stock_location                                │
│  user_id ──► res_users                                              │
│  company_id ──► res_company                                         │
│  orderpoint_id ──► stock_warehouse_orderpoint                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────┐       ┌─────────────────────┐               │
│  │ stock_move         │       │ mrp_workorder        │               │
│  │ (Components &      │       │ production_id ──► MO │               │
│  │  Finished Goods)   │       │ workcenter_id ──► WC │               │
│  │ raw_material_      │       │ operation_id ──► op  │               │
│  │   production_id    │       │                      │               │
│  │ production_id      │       │  ┌──────────────────┐│               │
│  │ bom_line_id        │       │  │ mrp_workcenter_  ││               │
│  │ workorder_id       │       │  │ productivity     ││               │
│  │ operation_id       │       │  │ (time logs)      ││               │
│  └───────────────────┘       │  └──────────────────┘│               │
│                               └─────────────────────┘               │
│  ┌───────────────────┐       ┌─────────────────────┐               │
│  │ stock_scrap        │       │ mrp_unbuild          │               │
│  │ production_id ──►MO│       │ mo_id ──► MO         │               │
│  └───────────────────┘       └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WORK CENTER (mrp_workcenter)                      │
│  resource_id ──► resource_resource                                  │
│  resource_calendar_id ──► resource_calendar                         │
│  company_id ──► res_company                                         │
│                                                                     │
│  ┌─────────────────────┐    ┌────────────────────────────────┐      │
│  │ mrp_workcenter_     │    │ mrp_workcenter_productivity_   │      │
│  │ capacity             │    │ loss                           │      │
│  │ workcenter_id ──► WC│    │ loss_id ──► loss_type          │      │
│  │ product_id ──► prod │    └────────────────────────────────┘      │
│  └─────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  WAREHOUSE INTEGRATION                               │
│  stock_warehouse                                                     │
│    manufacture_steps: mrp_one_step / pbm / pbm_sam                  │
│    manu_type_id ──► stock_picking_type (Manufacturing)              │
│    pbm_type_id ──► stock_picking_type (Pick Components)             │
│    sam_type_id ──► stock_picking_type (Store Finished)              │
│    pbm_loc_id ──► stock_location (Pre-Production)                   │
│    sam_loc_id ──► stock_location (Post-Production)                  │
│    manufacture_pull_id ──► stock_rule                               │
│    pbm_route_id ──► stock_route                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. PERFEX CRM IMPLEMENTATION GUIDE

### 10.1 Database Tables to Create in Perfex (MySQL)

Since Perfex CRM uses MySQL/MariaDB (vs Odoo's PostgreSQL), here are the tables you need:

#### Core Tables (Must Have)

```sql
-- 1. BILL OF MATERIALS
CREATE TABLE tbl_mrp_bom (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) DEFAULT NULL,
    active TINYINT(1) DEFAULT 1,
    type ENUM('normal', 'phantom') DEFAULT 'normal' NOT NULL,
    product_id INT NOT NULL COMMENT 'FK to your products table',
    product_qty DECIMAL(15,4) DEFAULT 1.0000 NOT NULL,
    product_uom VARCHAR(50) DEFAULT 'unit',
    sequence INT DEFAULT 0,
    ready_to_produce ENUM('all_available', 'asap') DEFAULT 'all_available',
    consumption ENUM('flexible', 'warning', 'strict') DEFAULT 'warning',
    produce_delay INT DEFAULT 0 COMMENT 'Manufacturing lead time in days',
    days_to_prepare_mo INT DEFAULT 0,
    company_id INT DEFAULT NULL COMMENT 'For multi-company if needed',
    created_by INT DEFAULT NULL COMMENT 'FK to tblstaff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product (product_id),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. BOM LINES (Components)
CREATE TABLE tbl_mrp_bom_line (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT NOT NULL,
    product_id INT NOT NULL COMMENT 'Component product',
    product_qty DECIMAL(15,4) DEFAULT 1.0000 NOT NULL,
    product_uom VARCHAR(50) DEFAULT 'unit',
    sequence INT DEFAULT 1,
    operation_id INT DEFAULT NULL COMMENT 'FK to tbl_mrp_operation',
    FOREIGN KEY (bom_id) REFERENCES tbl_mrp_bom(id) ON DELETE CASCADE,
    INDEX idx_bom (bom_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. BOM BY-PRODUCTS
CREATE TABLE tbl_mrp_bom_byproduct (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bom_id INT NOT NULL,
    product_id INT NOT NULL,
    product_qty DECIMAL(15,4) DEFAULT 1.0000,
    product_uom VARCHAR(50) DEFAULT 'unit',
    operation_id INT DEFAULT NULL,
    cost_share DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Cost allocation %',
    sequence INT DEFAULT 0,
    FOREIGN KEY (bom_id) REFERENCES tbl_mrp_bom(id) ON DELETE CASCADE,
    INDEX idx_bom (bom_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. WORK CENTERS
CREATE TABLE tbl_mrp_workcenter (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) DEFAULT NULL,
    active TINYINT(1) DEFAULT 1,
    description TEXT DEFAULT NULL,
    sequence INT DEFAULT 1,
    color INT DEFAULT 0,
    costs_hour DECIMAL(12,2) DEFAULT 0.00,
    time_efficiency DECIMAL(8,2) DEFAULT 100.00 COMMENT 'Percentage',
    time_start DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Setup time in minutes',
    time_stop DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Cleanup time in minutes',
    oee_target DECIMAL(5,2) DEFAULT 90.00,
    company_id INT DEFAULT NULL,
    working_hours_id INT DEFAULT NULL COMMENT 'FK to working schedule',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. WORKCENTER CAPACITY (per product)
CREATE TABLE tbl_mrp_workcenter_capacity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workcenter_id INT NOT NULL,
    product_id INT DEFAULT NULL,
    capacity DECIMAL(15,4) DEFAULT 1.0000,
    time_start DECIMAL(10,2) DEFAULT 0.00,
    time_stop DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (workcenter_id) REFERENCES tbl_mrp_workcenter(id) ON DELETE CASCADE,
    INDEX idx_wc (workcenter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. ALTERNATIVE WORK CENTERS (M2M)
CREATE TABLE tbl_mrp_workcenter_alternative (
    workcenter_id INT NOT NULL,
    alternative_workcenter_id INT NOT NULL,
    PRIMARY KEY (workcenter_id, alternative_workcenter_id),
    FOREIGN KEY (workcenter_id) REFERENCES tbl_mrp_workcenter(id) ON DELETE CASCADE,
    FOREIGN KEY (alternative_workcenter_id) REFERENCES tbl_mrp_workcenter(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. OPERATIONS / ROUTING
CREATE TABLE tbl_mrp_operation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    workcenter_id INT NOT NULL,
    bom_id INT NOT NULL,
    sequence INT DEFAULT 100,
    time_mode ENUM('manual', 'auto') DEFAULT 'manual',
    time_mode_batch INT DEFAULT 10,
    time_cycle_manual DECIMAL(10,2) DEFAULT 60.00 COMMENT 'Minutes',
    cost_mode ENUM('actual', 'estimated') DEFAULT 'actual',
    company_id INT DEFAULT NULL,
    FOREIGN KEY (workcenter_id) REFERENCES tbl_mrp_workcenter(id),
    FOREIGN KEY (bom_id) REFERENCES tbl_mrp_bom(id) ON DELETE CASCADE,
    INDEX idx_bom (bom_id),
    INDEX idx_wc (workcenter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. OPERATION DEPENDENCIES (M2M)
CREATE TABLE tbl_mrp_operation_dependency (
    operation_id INT NOT NULL,
    blocked_by_id INT NOT NULL,
    PRIMARY KEY (operation_id, blocked_by_id),
    FOREIGN KEY (operation_id) REFERENCES tbl_mrp_operation(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by_id) REFERENCES tbl_mrp_operation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. MANUFACTURING ORDERS (Main Table)
CREATE TABLE tbl_mrp_production (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL COMMENT 'e.g. MO/00001',
    priority ENUM('0', '1') DEFAULT '0' COMMENT '0=Normal, 1=Urgent',
    origin VARCHAR(255) DEFAULT NULL COMMENT 'Source document',
    product_id INT NOT NULL,
    product_qty DECIMAL(15,4) NOT NULL,
    product_uom VARCHAR(50) DEFAULT 'unit',
    qty_producing DECIMAL(15,4) DEFAULT 0.0000,
    qty_produced DECIMAL(15,4) DEFAULT 0.0000,
    bom_id INT DEFAULT NULL,
    state ENUM('draft', 'confirmed', 'progress', 'to_close', 'done', 'cancel') DEFAULT 'draft' NOT NULL,
    reservation_state ENUM('confirmed', 'assigned', 'waiting') DEFAULT NULL,
    consumption ENUM('flexible', 'warning', 'strict') DEFAULT 'flexible',
    date_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_finished DATETIME DEFAULT NULL,
    date_deadline DATETIME DEFAULT NULL,
    duration_expected DECIMAL(12,2) DEFAULT NULL COMMENT 'Minutes',
    duration DECIMAL(12,2) DEFAULT NULL COMMENT 'Actual minutes',
    location_src_id INT DEFAULT NULL COMMENT 'Components location',
    location_dest_id INT DEFAULT NULL COMMENT 'Finished goods location',
    user_id INT DEFAULT NULL COMMENT 'Responsible person, FK to tblstaff',
    company_id INT DEFAULT NULL,
    is_locked TINYINT(1) DEFAULT 1,
    propagate_cancel TINYINT(1) DEFAULT 0,
    backorder_sequence INT DEFAULT 0,
    description TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bom_id) REFERENCES tbl_mrp_bom(id),
    INDEX idx_state (state),
    INDEX idx_product (product_id),
    INDEX idx_date (date_start),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. PRODUCTION GROUPS
CREATE TABLE tbl_mrp_production_group (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_mrp_production_group_rel (
    production_id INT NOT NULL,
    group_id INT NOT NULL,
    PRIMARY KEY (production_id, group_id),
    FOREIGN KEY (production_id) REFERENCES tbl_mrp_production(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES tbl_mrp_production_group(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. WORK ORDERS
CREATE TABLE tbl_mrp_workorder (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sequence INT DEFAULT 100,
    barcode VARCHAR(128) DEFAULT NULL,
    workcenter_id INT NOT NULL,
    production_id INT NOT NULL,
    operation_id INT DEFAULT NULL,
    state ENUM('blocked', 'ready', 'progress', 'done', 'cancel') DEFAULT 'ready' NOT NULL,
    qty_producing DECIMAL(15,4) DEFAULT 0.0000,
    qty_produced DECIMAL(15,4) DEFAULT 0.0000,
    qty_remaining DECIMAL(15,4) DEFAULT 0.0000,
    date_start DATETIME DEFAULT NULL,
    date_finished DATETIME DEFAULT NULL,
    duration_expected DECIMAL(12,2) DEFAULT NULL COMMENT 'Minutes',
    duration DECIMAL(12,2) DEFAULT NULL COMMENT 'Actual minutes',
    duration_unit DECIMAL(12,4) DEFAULT NULL COMMENT 'Minutes per unit',
    costs_hour DECIMAL(12,2) DEFAULT 0.00,
    cost_mode ENUM('actual', 'estimated') DEFAULT 'actual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workcenter_id) REFERENCES tbl_mrp_workcenter(id),
    FOREIGN KEY (production_id) REFERENCES tbl_mrp_production(id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES tbl_mrp_operation(id),
    INDEX idx_production (production_id),
    INDEX idx_state (state),
    INDEX idx_wc (workcenter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. WORK ORDER DEPENDENCIES (M2M)
CREATE TABLE tbl_mrp_workorder_dependency (
    workorder_id INT NOT NULL,
    blocked_by_workorder_id INT NOT NULL,
    PRIMARY KEY (workorder_id, blocked_by_workorder_id),
    FOREIGN KEY (workorder_id) REFERENCES tbl_mrp_workorder(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by_workorder_id) REFERENCES tbl_mrp_workorder(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. STOCK MOVES (Component Consumption & Finished Production)
CREATE TABLE tbl_mrp_stock_move (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) DEFAULT NULL,
    product_id INT NOT NULL,
    product_qty DECIMAL(15,4) NOT NULL,
    product_uom VARCHAR(50) DEFAULT 'unit',
    production_id INT DEFAULT NULL COMMENT 'For finished goods',
    raw_material_production_id INT DEFAULT NULL COMMENT 'For components consumed',
    workorder_id INT DEFAULT NULL,
    bom_line_id INT DEFAULT NULL,
    byproduct_id INT DEFAULT NULL,
    unbuild_id INT DEFAULT NULL,
    operation_id INT DEFAULT NULL,
    location_src_id INT DEFAULT NULL COMMENT 'Source location/warehouse',
    location_dest_id INT DEFAULT NULL COMMENT 'Destination location',
    state ENUM('draft', 'waiting', 'confirmed', 'assigned', 'done', 'cancel') DEFAULT 'draft',
    date_expected DATETIME DEFAULT NULL,
    date_done DATETIME DEFAULT NULL,
    lot_id INT DEFAULT NULL COMMENT 'Lot/Serial number',
    unit_factor DECIMAL(12,6) DEFAULT 1.000000,
    cost_share DECIMAL(5,2) DEFAULT 0.00,
    manual_consumption TINYINT(1) DEFAULT 0,
    company_id INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_id) REFERENCES tbl_mrp_production(id) ON DELETE CASCADE,
    FOREIGN KEY (raw_material_production_id) REFERENCES tbl_mrp_production(id) ON DELETE CASCADE,
    INDEX idx_production (production_id),
    INDEX idx_raw_prod (raw_material_production_id),
    INDEX idx_product (product_id),
    INDEX idx_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. PRODUCTIVITY / TIME TRACKING
CREATE TABLE tbl_mrp_productivity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workcenter_id INT NOT NULL,
    workorder_id INT DEFAULT NULL,
    production_id INT DEFAULT NULL,
    user_id INT DEFAULT NULL COMMENT 'FK to tblstaff',
    loss_id INT DEFAULT NULL,
    loss_type ENUM('availability', 'performance', 'quality', 'productive') DEFAULT 'productive',
    description TEXT DEFAULT NULL,
    date_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_end DATETIME DEFAULT NULL,
    duration DECIMAL(12,2) DEFAULT NULL COMMENT 'Minutes, computed from dates',
    company_id INT DEFAULT NULL,
    FOREIGN KEY (workcenter_id) REFERENCES tbl_mrp_workcenter(id),
    FOREIGN KEY (workorder_id) REFERENCES tbl_mrp_workorder(id),
    INDEX idx_wc (workcenter_id),
    INDEX idx_wo (workorder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. PRODUCTIVITY LOSS TYPES
CREATE TABLE tbl_mrp_productivity_loss_type (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loss_type ENUM('availability', 'performance', 'quality', 'productive') DEFAULT 'availability' NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. PRODUCTIVITY LOSS REASONS
CREATE TABLE tbl_mrp_productivity_loss (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sequence INT DEFAULT 1,
    manual TINYINT(1) DEFAULT 1,
    loss_type_id INT DEFAULT NULL,
    loss_type ENUM('availability', 'performance', 'quality', 'productive') DEFAULT 'availability',
    FOREIGN KEY (loss_type_id) REFERENCES tbl_mrp_productivity_loss_type(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. UNBUILD ORDERS
CREATE TABLE tbl_mrp_unbuild (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL COMMENT 'Auto-sequence',
    product_id INT NOT NULL,
    product_qty DECIMAL(15,4) DEFAULT 1.0000 NOT NULL,
    product_uom VARCHAR(50) DEFAULT 'unit',
    bom_id INT DEFAULT NULL,
    mo_id INT DEFAULT NULL COMMENT 'Original manufacturing order',
    lot_id INT DEFAULT NULL,
    location_src_id INT DEFAULT NULL,
    location_dest_id INT DEFAULT NULL,
    company_id INT DEFAULT NULL,
    state ENUM('draft', 'done') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bom_id) REFERENCES tbl_mrp_bom(id),
    FOREIGN KEY (mo_id) REFERENCES tbl_mrp_production(id),
    INDEX idx_product (product_id),
    INDEX idx_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. SCRAP TRACKING
CREATE TABLE tbl_mrp_scrap (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    product_qty DECIMAL(15,4) NOT NULL,
    product_uom VARCHAR(50) DEFAULT 'unit',
    lot_id INT DEFAULT NULL,
    production_id INT DEFAULT NULL,
    workorder_id INT DEFAULT NULL,
    location_id INT DEFAULT NULL COMMENT 'Source location',
    scrap_location_id INT DEFAULT NULL COMMENT 'Scrap location',
    state ENUM('draft', 'done') DEFAULT 'draft',
    date_done DATETIME DEFAULT NULL,
    company_id INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (production_id) REFERENCES tbl_mrp_production(id),
    INDEX idx_production (production_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. WORKCENTER TAGS
CREATE TABLE tbl_mrp_workcenter_tag (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tbl_mrp_workcenter_tag_rel (
    workcenter_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (workcenter_id, tag_id),
    FOREIGN KEY (workcenter_id) REFERENCES tbl_mrp_workcenter(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tbl_mrp_workcenter_tag(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 10.2 Perfex CRM Roles to Create

Map Odoo's groups to Perfex staff roles/permissions:

| Perfex Permission Key | Equivalent Odoo Group | Capabilities |
|----------------------|----------------------|--------------|
| `manufacturing_view` | group_mrp_user (read) | View MOs, BoMs, work centers, work orders |
| `manufacturing_create` | group_mrp_user (write) | Create/edit MOs, work orders, log time |
| `manufacturing_admin` | group_mrp_manager | Full CRUD on all MRP tables + settings |
| `manufacturing_delete` | group_mrp_manager | Delete records |

**Permission Matrix for Perfex:**

```php
// Add to Perfex permissions array
$manufacturing_permissions = [
    // BoM permissions
    'bom' => [
        'view'    => ['manufacturing_view', 'manufacturing_admin'],
        'create'  => ['manufacturing_admin'],
        'edit'    => ['manufacturing_admin'],
        'delete'  => ['manufacturing_admin'],
    ],
    // Manufacturing Order permissions
    'production' => [
        'view'    => ['manufacturing_view', 'manufacturing_admin'],
        'create'  => ['manufacturing_view', 'manufacturing_admin'],
        'edit'    => ['manufacturing_view', 'manufacturing_admin'],
        'delete'  => ['manufacturing_admin'],
    ],
    // Work Center permissions
    'workcenter' => [
        'view'    => ['manufacturing_view', 'manufacturing_admin'],
        'create'  => ['manufacturing_admin'],
        'edit'    => ['manufacturing_admin'],
        'delete'  => ['manufacturing_admin'],
    ],
    // Work Order permissions
    'workorder' => [
        'view'    => ['manufacturing_view', 'manufacturing_admin'],
        'create'  => ['manufacturing_view', 'manufacturing_admin'],
        'edit'    => ['manufacturing_view', 'manufacturing_admin'],
        'delete'  => ['manufacturing_admin'],
    ],
    // Unbuild permissions
    'unbuild' => [
        'view'    => ['manufacturing_view', 'manufacturing_admin'],
        'create'  => ['manufacturing_view', 'manufacturing_admin'],
        'edit'    => ['manufacturing_view', 'manufacturing_admin'],
        'delete'  => ['manufacturing_admin'],
    ],
];
```

### 10.3 Key Perfex Module Files to Create

```
modules/manufacturing/
├── manufacturing.php                 # Module init, hooks, permissions
├── install.php                       # DB table creation (SQL above)
├── controllers/
│   ├── Manufacturing.php             # Main controller
│   ├── Bom.php                      # Bill of Materials CRUD
│   ├── Production.php               # Manufacturing Orders CRUD
│   ├── Workcenter.php               # Work Centers CRUD
│   ├── Workorder.php                # Work Orders CRUD
│   └── Unbuild.php                  # Unbuild Orders CRUD
├── models/
│   ├── Bom_model.php                # BoM queries & logic
│   ├── Production_model.php         # MO queries, state machine, stock moves
│   ├── Workcenter_model.php         # Work center queries & OEE calculations
│   ├── Workorder_model.php          # Work order queries & time tracking
│   └── Unbuild_model.php            # Unbuild logic
├── views/
│   ├── bom/
│   │   ├── list.php
│   │   ├── form.php                 # BoM form with component lines
│   │   └── structure.php            # BoM structure/explosion report
│   ├── production/
│   │   ├── list.php                 # Kanban + List view
│   │   ├── form.php                 # MO form with components & work orders
│   │   └── overview.php             # MO overview report
│   ├── workcenter/
│   │   ├── list.php                 # Kanban view with OEE
│   │   └── form.php
│   ├── workorder/
│   │   ├── list.php                 # Kanban by work center
│   │   ├── form.php
│   │   └── tablet.php               # Tablet/shop floor view
│   └── settings.php                 # Module settings
├── helpers/
│   ├── manufacturing_helper.php      # Utility functions
│   └── sequence_helper.php           # MO/WO number generation
├── libraries/
│   └── Mrp_stock.php                # Stock move logic
└── assets/
    ├── css/
    └── js/
        ├── production.js             # MO form interactions
        ├── workorder.js              # Timer/time tracking
        └── bom_structure.js          # BoM explosion tree
```

### 10.4 Key Business Logic to Implement

#### A. Manufacturing Order State Machine
```php
class Production_model extends App_Model {

    // State transitions
    const TRANSITIONS = [
        'draft'     => ['confirmed', 'cancel'],
        'confirmed' => ['progress', 'cancel'],
        'progress'  => ['to_close', 'cancel'],
        'to_close'  => ['done'],
        'done'      => [],      // Terminal state
        'cancel'    => ['draft'] // Can reset to draft
    ];

    public function action_confirm($id) {
        // 1. Validate BoM exists and has components
        // 2. Create stock moves for components (raw materials)
        // 3. Create stock move for finished product
        // 4. Reserve available components from stock
        // 5. Create work orders from BoM operations
        // 6. Update state to 'confirmed'
    }

    public function action_produce($id, $qty) {
        // 1. Check component availability
        // 2. Consume components (mark stock moves as done)
        // 3. Produce finished goods (mark stock move as done)
        // 4. Update qty_produced
        // 5. Update state to 'progress'
    }

    public function button_mark_done($id) {
        // 1. Check if qty_produced >= product_qty
        // 2. If partial: offer backorder creation
        // 3. Mark all remaining moves as done
        // 4. Close all work orders
        // 5. Update state to 'done'
    }

    public function action_cancel($id) {
        // 1. Unreserve all components
        // 2. Cancel all stock moves
        // 3. Cancel all work orders
        // 4. If propagate_cancel: cancel downstream MOs
        // 5. Update state to 'cancel'
    }
}
```

#### B. BoM Explosion (Calculating Components)
```php
public function explode_bom($bom_id, $product_id, $qty, $picking_type = null) {
    // 1. Get BoM and its lines
    // 2. For each BoM line:
    //    a. Calculate qty needed = line_qty * (qty / bom_qty)
    //    b. If component has its own BoM (type=phantom/kit):
    //       Recursively explode
    //    c. Filter by product variant attributes if applicable
    //    d. Skip lines where operation is filtered out
    // 3. Return flat list of components with quantities
}
```

#### C. Work Order Time Tracking
```php
public function button_start($workorder_id) {
    // 1. Create productivity record with date_start = now
    // 2. Set loss_type = 'productive'
    // 3. Update workorder state to 'progress'
    // 4. Update workcenter working_state
}

public function button_finish($workorder_id) {
    // 1. Close current productivity record (date_end = now)
    // 2. Calculate duration
    // 3. Update workorder state to 'done'
    // 4. Record qty_produced
    // 5. Start next workorder if auto-start enabled
}

public function button_block($workorder_id, $loss_reason_id) {
    // 1. Close current productive time
    // 2. Create new productivity record with the loss reason
    // 3. Update workcenter working_state = 'blocked'
}
```

#### D. OEE Calculation
```php
public function calculate_oee($workcenter_id, $date_from, $date_to) {
    // OEE = Availability × Performance × Quality

    // Availability = (Total Time - Downtime) / Total Time
    // Performance = (Standard Cycle Time × Units Produced) / Operating Time
    // Quality = Good Units / Total Units

    // Get all productivity records for this workcenter in date range
    // Sum productive time vs blocked time
    // Compare expected duration vs actual duration
}
```

### 10.5 Warehouse / Stock Integration Points

For Perfex, you'll need a simplified inventory system or integrate with an existing one:

| Odoo Concept | Perfex Equivalent |
|-------------|------------------|
| `stock.location` | Warehouse/Location table |
| `stock.move` | `tbl_mrp_stock_move` (created above) |
| `stock.quant` | Product quantity on hand per location |
| `stock.lot` | Lot/Serial number tracking table |
| `stock.picking` | Transfer/receipt documents |
| `stock.warehouse` | Warehouse configuration |

### 10.6 Auto-Numbering Sequences

```php
// Manufacturing Order: MO/00001, MO/00002, ...
function get_next_mo_number() {
    $last = $this->db->query("SELECT name FROM tbl_mrp_production ORDER BY id DESC LIMIT 1")->row();
    $next = $last ? intval(substr($last->name, 3)) + 1 : 1;
    return 'MO/' . str_pad($next, 5, '0', STR_PAD_LEFT);
}

// Unbuild: UB/00001
// Work Order: WO/00001
// Same pattern for all sequences
```

---

## SUMMARY OF ALL TABLES

| # | Table Name | Records Per | Purpose |
|---|-----------|------------|---------|
| 1 | `tbl_mrp_bom` | Per product | Bill of Materials (recipes) |
| 2 | `tbl_mrp_bom_line` | Per BoM | Components needed |
| 3 | `tbl_mrp_bom_byproduct` | Per BoM | Secondary outputs |
| 4 | `tbl_mrp_workcenter` | Per facility | Machines/stations |
| 5 | `tbl_mrp_workcenter_capacity` | Per WC+product | Product-specific speeds |
| 6 | `tbl_mrp_workcenter_alternative` | M2M | Alternative machines |
| 7 | `tbl_mrp_workcenter_tag` | Global | Tags for grouping |
| 8 | `tbl_mrp_workcenter_tag_rel` | M2M | WC ↔ Tag links |
| 9 | `tbl_mrp_operation` | Per BoM | Manufacturing steps |
| 10 | `tbl_mrp_operation_dependency` | M2M | Operation ordering |
| 11 | `tbl_mrp_production` | Per order | Manufacturing orders |
| 12 | `tbl_mrp_production_group` | Per group | Group related MOs |
| 13 | `tbl_mrp_production_group_rel` | M2M | MO ↔ Group links |
| 14 | `tbl_mrp_workorder` | Per MO operation | Work order instances |
| 15 | `tbl_mrp_workorder_dependency` | M2M | WO ordering |
| 16 | `tbl_mrp_stock_move` | Per component/product | Inventory movements |
| 17 | `tbl_mrp_productivity` | Per time entry | Time tracking logs |
| 18 | `tbl_mrp_productivity_loss_type` | Global | Loss categories (4 types) |
| 19 | `tbl_mrp_productivity_loss` | Global | Blocking reasons |
| 20 | `tbl_mrp_unbuild` | Per unbuild | Disassembly orders |
| 21 | `tbl_mrp_scrap` | Per scrap | Scrapped materials |

**Total: 21 tables (including 5 M2M relation tables)**

---

*Document generated from Odoo 19.0 source code (Docker image odoo:19.0)*
*Extracted on: 2026-03-12*
