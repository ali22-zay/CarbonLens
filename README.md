# CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
**Course:** CS-2104 Database Systems  
**Institution:** Dawood University of Engineering & Technology (DUET), Karachi *(Generic — usable by any campus)*  
**Stack:** MySQL 8.0, Node.js, Express, mysql2, bcryptjs, express-session, Bootstrap 5, Chart.js

---

## 🌿 What is CarbonLens?

CarbonLens is a campus environmental tracking system. It records monthly electricity, water, and waste consumption for every university building, automatically calculates CO₂ emissions, sends alerts when limits are exceeded, and lets students earn green points for eco-friendly activities.

The **main focus** of this project is the **database** — the tables, queries, triggers, views, and stored procedures. The web app is just a simple interface so the database can be demonstrated visually.

---

## ⚡ Quick Start

### What you need:
1. **MySQL Server 8.0** running on port 3306
2. **Node.js** (v18 or higher)

### Step 1 — Set up the database
Open MySQL Workbench (or the terminal), run these files **in order**:
1. `database/schema.sql` → creates all 9 tables, triggers, procedures, and views
2. `database/seed.sql` → inserts sample DUET data

```bash
# Using terminal:
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### Step 2 — Configure environment
Copy `.env.example` to `.env` and fill in your MySQL password:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=carbonlens_db
SESSION_SECRET=carbonlens_secret_key_duet_cs2104
CAMPUS_NAME=Dawood University of Engineering & Technology (DUET)
```

### Step 3 — Run the server
```bash
npm install
npm start
```

Then open: **http://localhost:3000**

---

## 🔐 Login Accounts

All passwords are stored **hashed** in the database using bcrypt (never plain text).

| Role | Name | Email | Password |
|---|---|---|---|
| **Admin** | Muhammad Tariq Siddiqui | `admin@carbonlens.com` | `admin123` |
| **Chairperson** | Dr. Farhan Ahmed Khan (CS) | `chair.cs@carbonlens.com` | `chair123` |
| **Chairperson** | Engr. Saira Naseem (EE) | `chair.ee@carbonlens.com` | `chair123` |
| **Chairperson** | Dr. Imran Hussain Shaikh (CE) | `chair.ce@carbonlens.com` | `chair123` |
| **Chairperson** | Prof. Nadia Qureshi (ME) | `chair.me@carbonlens.com` | `chair123` |
| **Chairperson** | Dr. Kashif Mehmood (SE) | `chair.se@carbonlens.com` | `chair123` |
| **Chairperson** | Mr. Rashid Ali Memon (ADM) | `chair.adm@carbonlens.com` | `chair123` |
| **Student** | Ali Raza (CS) | `ali.raza@carbonlens.com` | `student123` |
| **Student** | Sana Javed (SE — Top scorer) | `sana.javed@carbonlens.com` | `student123` |

> The login page also has a "Demo Accounts" panel where you can click any account to auto-fill the form.

---

## 🗄️ Database Design (9 Tables)

This is the most important part of the project. The database follows **Third Normal Form (3NF)**.

### The 9 Tables

| # | Table | What it stores |
|---|---|---|
| 1 | `departments` | University departments (CS, EE, Civil, etc.) |
| 2 | `buildings` | Campus buildings, each belonging to a department |
| 3 | `users` | Admin, chairperson, and student accounts |
| 4 | `emission_factors` | How many kg of CO₂ per kWh / liter / kg of waste |
| 5 | `monthly_usage` | Monthly electricity, water, and waste readings for each building |
| 6 | `usage_limits` | Maximum allowed values before an alert fires |
| 7 | `alerts` | Auto-generated warnings when usage exceeds limits |
| 8 | `eco_activity_types` | Types of eco-friendly actions students can do (and their points) |
| 9 | `student_activities` | Log of activities submitted by students (pending/approved/rejected) |

### Relationship Diagram

```
departments  ──┬── buildings ── monthly_usage ── alerts
               │
               └── users ──── student_activities ── eco_activity_types
```

- One department has many buildings (1-to-many)
- One building has many monthly usage records (1-to-many)
- One usage record can generate many alerts (1-to-many)
- One user (student) can submit many activities (1-to-many)

---

## 📐 Normalization — In Simple Words

**Why do we normalize?** To avoid storing the same data in multiple places. If we store a department's name in 100 rows and then the department renames itself, we'd have to update 100 rows. With normalization, we store the name in **one** place (the `departments` table) and use its ID everywhere else.

### 1NF — First Normal Form ✅
**Rule:** Each column stores one single value. No lists or repeating groups in a cell.

**Example in CarbonLens:** The `monthly_usage` table stores `electricity_kwh`, `water_liters`, and `waste_kg` in **separate columns**, not as a comma-separated list like `"9400, 18000, 650"` in a single column.

### 2NF — Second Normal Form ✅
**Rule:** Every column must depend on the **whole** primary key, not just part of it.

**Example in CarbonLens:** In `monthly_usage`, the primary key is `usage_id`. We do NOT store `building_name` here — building name depends only on `building_id`, not on the full record. So we keep building names in the `buildings` table and just link via `building_id`.

### 3NF — Third Normal Form ✅
**Rule:** No column should depend on another non-key column. All columns must depend **directly** on the primary key only.

**Example in CarbonLens:** The `users` table stores `department_id` (just the ID number). It does NOT store `department_name` — because that would create a chain: `user_id → department_id → department_name`. The name belongs in `departments`, not `users`.

---

## ⚙️ Database Objects

### Triggers (automatic actions inside MySQL)

A **trigger** is code that MySQL runs automatically when something happens to a table. You don't call it — it fires by itself.

| Trigger | When it fires | What it does |
|---|---|---|
| `trg_usage_calc_co2_insert` | Before a new usage record is saved | Calculates `total_co2_kg` automatically using the emission factors |
| `trg_usage_calc_co2_update` | Before an existing usage record is updated | Recalculates `total_co2_kg` with the new values |
| `trg_usage_alert_insert` | After a new usage record is saved | Checks if electricity/water/waste exceeds the limit; if yes, adds a row to `alerts` |
| `trg_usage_alert_update` | After an existing usage record is updated | Same alert check for updated values |

**The CO₂ formula used in the trigger:**
```
total_co2_kg = (electricity_kwh × 0.45) + (water_liters × 0.0003) + (waste_kg × 0.50)
```

### Stored Procedures (saved queries you call by name)

A **stored procedure** is a saved SQL query that you run with `CALL procedure_name(...)`. It accepts inputs (parameters) and returns results.

| Procedure | How to call it | What it returns |
|---|---|---|
| `sp_monthly_report` | `CALL sp_monthly_report(6, 2026)` | All departments' total electricity, water, waste, and CO₂ for June 2026 |
| `sp_department_report` | `CALL sp_department_report(1, 6, 2026)` | Building-by-building breakdown for Department 1 (CS) in June 2026 |
| `sp_student_points` | `CALL sp_student_points(8)` | Total green points earned by student with user_id = 8 |

### Views (saved SELECT queries)

A **view** looks like a table, but it doesn't store any data itself. Every time you query a view, MySQL runs the underlying SELECT query fresh and returns the latest result.

| View | What it shows |
|---|---|
| `v_department_leaderboard` | All departments ranked by CO₂ (lowest = rank 1 = best) using `RANK()` |
| `v_student_leaderboard` | All students ranked by green points (highest = rank 1) using `RANK()` |
| `v_building_co2_summary` | Each building's total and average monthly CO₂ across all months |

---

## 🎓 Viva Q&A — Common Questions

**Q: Why did you calculate CO₂ inside a trigger instead of in the web app (Node.js)?**
> Using a database trigger means the CO₂ is always calculated correctly, no matter how the data was entered — whether through the web app, MySQL Workbench, or a script. The calculation happens inside MySQL itself, so there is no way to accidentally skip it.

**Q: Why is the CO₂ trigger BEFORE INSERT, but the alert trigger is AFTER INSERT?**
> The BEFORE trigger runs before the row is actually saved, so we can change the value of `total_co2_kg` before it gets written to the database. The AFTER trigger runs after the row is saved because the alert needs to reference `usage_id` (the new row's ID), which only exists once the row is saved.

**Q: What is a stored procedure? Why use it instead of a normal query?**
> A stored procedure is a query saved inside the database with a name. You call it with `CALL`. It is useful because: (1) the query is pre-compiled so it runs faster, (2) the web app just calls one procedure instead of sending a long complex query over the network, and (3) if the query needs to change, you update it in one place.

**Q: What is the difference between RANK() and DENSE_RANK()?**
> If two students tie at 50 points: `RANK()` gives them both rank 1, then skips to rank 3 (no rank 2). `DENSE_RANK()` gives them both rank 1, then the next person is rank 2 (no gap). We use `RANK()` in our leaderboard because skipping ranks feels more natural in competition.

**Q: What is a view? Does it store data?**
> No. A view is just a saved SELECT query with a name. When you run `SELECT * FROM v_department_leaderboard`, MySQL runs the original SELECT behind the scenes and gives you fresh results. No extra data is stored on disk.

**Q: What is the difference between WHERE and HAVING?**
> `WHERE` filters rows **before** grouping. `HAVING` filters groups **after** GROUP BY. You cannot use aggregate functions like `SUM()` or `COUNT()` in a WHERE clause — those go in HAVING.

**Q: What is ON DELETE CASCADE vs ON DELETE SET NULL?**
> `ON DELETE CASCADE`: if you delete a department, all its buildings are also automatically deleted. `ON DELETE SET NULL`: if you delete a department, the users who belonged to it remain in the database but their `department_id` becomes NULL (so you don't lose the user accounts).

**Q: How is SQL injection prevented?**
> All queries in the backend use `?` placeholders (parameterized queries). The user's input is sent to MySQL separately from the SQL text, so MySQL never treats the input as part of the SQL command.

---

## 📁 Project Files

```
CaronLens/
├── database/
│   ├── schema.sql      ← All 9 tables, triggers, procedures, and views (START HERE)
│   ├── seed.sql        ← Sample DUET data (departments, buildings, users, 6 months of usage)
│   └── queries.sql     ← 12 example queries with explanations for viva
├── routes/             ← Backend API (Node.js + Express)
├── views/              ← HTML pages (login, admin, chairperson, student)
├── public/             ← CSS and JavaScript files
├── server.js           ← Starts the web server
└── README.md           ← This file
```

> **For the viva:** Open `database/queries.sql` — it has 12 ready-made queries covering JOIN, GROUP BY, HAVING, subqueries, window functions, stored procedures, and views, each with a simple explanation you can read out.
