-- =============================================================================
-- CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
-- Course: CS-2104 Database Systems
-- File: schema.sql
-- Run this file FIRST, then run seed.sql
-- Compatible with MySQL 8.0 / MySQL Workbench
-- =============================================================================

-- Create the database if it doesn't already exist
CREATE DATABASE IF NOT EXISTS carbonlens_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Switch to using this database
USE carbonlens_db;

-- -----------------------------------------------------------------------------
-- Clean up: Drop everything first so we can re-run this file safely.
-- We drop in reverse order because child tables must be dropped before parents.
-- (You cannot drop a table that another table's FOREIGN KEY still references.)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_building_co2_summary;
DROP VIEW IF EXISTS v_student_leaderboard;
DROP VIEW IF EXISTS v_department_leaderboard;

DROP PROCEDURE IF EXISTS sp_student_points;
DROP PROCEDURE IF EXISTS sp_department_report;
DROP PROCEDURE IF EXISTS sp_monthly_report;

DROP TRIGGER IF EXISTS trg_usage_alert_update;
DROP TRIGGER IF EXISTS trg_usage_alert_insert;
DROP TRIGGER IF EXISTS trg_usage_calc_co2_update;
DROP TRIGGER IF EXISTS trg_usage_calc_co2_insert;

DROP TABLE IF EXISTS student_activities;
DROP TABLE IF EXISTS eco_activity_types;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS usage_limits;
DROP TABLE IF EXISTS monthly_usage;
DROP TABLE IF EXISTS emission_factors;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS buildings;
DROP TABLE IF EXISTS departments;

-- =============================================================================
-- TABLE 1: departments
-- Stores the list of university departments (e.g. Computer Science, Civil Engineering).
-- This is a PARENT table — other tables (buildings, users) refer back to it.
-- 
-- PRIMARY KEY: department_id  → uniquely identifies each department row
-- UNIQUE on department_name and department_code → prevents duplicate entries
-- =============================================================================
CREATE TABLE departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,  -- auto-increments: 1, 2, 3 ...
    department_name VARCHAR(100) NOT NULL UNIQUE,    -- e.g. 'Computer Science'
    department_code VARCHAR(20)  NOT NULL UNIQUE,    -- e.g. 'CS'
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- auto-saved timestamp
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 2: buildings
-- Stores campus buildings (e.g. CS Lab Block, Mechanical Workshop).
-- Each building belongs to one department → that's the FOREIGN KEY below.
--
-- FOREIGN KEY department_id → references departments(department_id)
--   ON DELETE CASCADE: if a department is deleted, its buildings are also deleted
--   ON UPDATE CASCADE: if a department_id number changes, this table updates too
-- =============================================================================
CREATE TABLE buildings (
    building_id   INT AUTO_INCREMENT PRIMARY KEY,
    building_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,                      -- which department owns this building
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_buildings_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 3: users
-- Stores everyone who can log into the system: admins, chairpersons, and students.
--
-- role ENUM: only three values are allowed — 'admin', 'chairperson', 'student'
-- department_id is NULL for admin (admin manages the whole campus, not one dept)
-- password_hash: we never store the real password — only its bcrypt hash
--
-- FOREIGN KEY department_id → references departments(department_id)
--   ON DELETE SET NULL: if a department is deleted, the user's dept becomes NULL
--   (we do NOT delete the user account — the person still exists)
-- =============================================================================
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,      -- used for login; must be unique
    password_hash VARCHAR(255) NOT NULL,             -- bcrypt-hashed password
    role          ENUM('admin', 'chairperson', 'student') NOT NULL,
    department_id INT NULL,                          -- NULL for admin
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 4: emission_factors
-- Stores how much CO₂ (in kg) is produced per unit of each resource.
-- Example: 1 kWh of electricity → 0.45 kg CO₂
--
-- These values are used by the TRIGGERS to calculate total_co2_kg automatically.
-- An admin can update these numbers if the conversion rates change.
-- =============================================================================
CREATE TABLE emission_factors (
    factor_id      INT AUTO_INCREMENT PRIMARY KEY,
    resource_type  ENUM('electricity', 'water', 'waste') NOT NULL UNIQUE,
    unit           VARCHAR(20) NOT NULL,              -- e.g. 'kWh', 'Liters', 'kg'
    kg_co2_per_unit DECIMAL(10, 4) NOT NULL CHECK (kg_co2_per_unit >= 0),
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 5: monthly_usage
-- The MAIN data table. Records how much electricity, water, and waste
-- each building used in a given month and year.
--
-- total_co2_kg is calculated AUTOMATICALLY by a trigger — you don't enter it.
--
-- UNIQUE(building_id, month, year): prevents entering duplicate data for the
-- same building in the same month (e.g. you cannot enter CS Lab June 2026 twice)
--
-- CHECK constraints: values like electricity_kwh cannot be negative
-- =============================================================================
CREATE TABLE monthly_usage (
    usage_id        INT AUTO_INCREMENT PRIMARY KEY,
    building_id     INT NOT NULL,                    -- which building
    month           TINYINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year            SMALLINT NOT NULL CHECK (year >= 2000),
    electricity_kwh DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (electricity_kwh >= 0),
    water_liters    DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (water_liters >= 0),
    waste_kg        DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (waste_kg >= 0),
    total_co2_kg    DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_co2_kg >= 0),  -- auto-calculated by trigger
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_building_month_year UNIQUE (building_id, month, year),
    CONSTRAINT fk_monthly_usage_building
        FOREIGN KEY (building_id) REFERENCES buildings(building_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 6: usage_limits
-- Stores the maximum allowed monthly usage for each resource type.
-- Example: electricity limit = 15000 kWh per month.
-- If a building exceeds this, a trigger automatically creates an ALERT.
-- =============================================================================
CREATE TABLE usage_limits (
    limit_id          INT AUTO_INCREMENT PRIMARY KEY,
    resource_type     ENUM('electricity', 'water', 'waste') NOT NULL UNIQUE,
    max_monthly_value DECIMAL(12, 2) NOT NULL CHECK (max_monthly_value >= 0),
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 7: alerts
-- Stores warning messages that are created AUTOMATICALLY by triggers.
-- When a building's monthly usage exceeds the limit, a row appears here.
--
-- is_read: tracks whether the admin has seen the alert (FALSE = unread)
--
-- FOREIGN KEY usage_id → references monthly_usage
--   ON DELETE CASCADE: if the usage record is deleted, its alert is also deleted
-- =============================================================================
CREATE TABLE alerts (
    alert_id      INT AUTO_INCREMENT PRIMARY KEY,
    usage_id      INT NOT NULL,                      -- which monthly_usage record caused this alert
    resource_type ENUM('electricity', 'water', 'waste') NOT NULL,
    message       VARCHAR(255) NOT NULL,             -- human-readable description
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read       BOOLEAN NOT NULL DEFAULT FALSE,    -- FALSE = not yet read by admin
    CONSTRAINT fk_alerts_usage
        FOREIGN KEY (usage_id) REFERENCES monthly_usage(usage_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 8: eco_activity_types
-- A lookup table listing the types of eco-friendly actions students can do.
-- Example: "Plant a tree" = 20 points, "Cycle to campus" = 10 points.
--
-- Why a separate table? So the points for each activity are stored ONCE here.
-- If the points change, we update ONE row instead of hundreds of activity logs.
-- =============================================================================
CREATE TABLE eco_activity_types (
    activity_type_id INT AUTO_INCREMENT PRIMARY KEY,
    activity_name    VARCHAR(100) NOT NULL UNIQUE,
    points           INT NOT NULL CHECK (points > 0),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =============================================================================
-- TABLE 9: student_activities
-- Records every eco-friendly activity that a student submits.
-- Status starts as 'pending', then a chairperson or admin approves or rejects it.
-- Only 'approved' activities count toward the student's green points total.
--
-- FOREIGN KEY student_id → the student who submitted it (from users table)
-- FOREIGN KEY activity_type_id → which type of activity it was
-- FOREIGN KEY reviewed_by → which user (chairperson/admin) reviewed it
--   ON DELETE RESTRICT on activity_type: prevents deleting an activity type
--     that students have already used (so old records stay valid)
-- =============================================================================
CREATE TABLE student_activities (
    log_id           INT AUTO_INCREMENT PRIMARY KEY,
    student_id       INT NOT NULL,
    activity_type_id INT NOT NULL,
    activity_date    DATE NOT NULL,
    description      TEXT,                           -- student's notes about the activity
    status           ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    reviewed_by      INT NULL,                       -- NULL until someone reviews it
    reviewed_at      TIMESTAMP NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activities_student
        FOREIGN KEY (student_id) REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_activities_type
        FOREIGN KEY (activity_type_id) REFERENCES eco_activity_types(activity_type_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_activities_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;


-- -----------------------------------------------------------------------------
-- INDEXES
-- An index speeds up SELECT queries on columns we search/filter often.
-- Without an index, MySQL scans every row. With an index, it jumps directly.
-- -----------------------------------------------------------------------------
CREATE INDEX idx_usage_date      ON monthly_usage(year, month);        -- speed up month/year filters
CREATE INDEX idx_usage_building  ON monthly_usage(building_id);        -- speed up building lookups
CREATE INDEX idx_activities_student ON student_activities(student_id, status); -- speed up student activity queries
CREATE INDEX idx_users_role_dept ON users(role, department_id);        -- speed up role-based logins


-- =============================================================================
-- TRIGGERS
-- A trigger is SQL code that MySQL runs AUTOMATICALLY when a table is changed.
-- You never call a trigger yourself — MySQL fires it for you.
-- =============================================================================

DELIMITER $$

-- -----------------------------------------------------------------------------
-- TRIGGER 1: trg_usage_calc_co2_insert
-- FIRES: BEFORE a new row is inserted into monthly_usage
-- DOES: Reads the emission factors and calculates total_co2_kg automatically.
--       Formula: CO2 = (electricity × 0.45) + (water × 0.0003) + (waste × 0.50)
-- WHY BEFORE (not AFTER): We use BEFORE so we can SET NEW.total_co2_kg before
--   the row is written to disk. In an AFTER trigger, you cannot modify the row.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_usage_calc_co2_insert
BEFORE INSERT ON monthly_usage
FOR EACH ROW
BEGIN
    -- Variables to hold the three emission factors (default values as fallback)
    DECLARE v_elec_factor  DECIMAL(10, 4) DEFAULT 0.4500;
    DECLARE v_water_factor DECIMAL(10, 4) DEFAULT 0.0003;
    DECLARE v_waste_factor DECIMAL(10, 4) DEFAULT 0.5000;

    -- Read the actual emission factors from the emission_factors table
    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN kg_co2_per_unit END), 0.4500),
           COALESCE(MAX(CASE WHEN resource_type = 'water'       THEN kg_co2_per_unit END), 0.0003),
           COALESCE(MAX(CASE WHEN resource_type = 'waste'       THEN kg_co2_per_unit END), 0.5000)
    INTO v_elec_factor, v_water_factor, v_waste_factor
    FROM emission_factors;

    -- Calculate and set the CO2 value on the new row before it is saved
    SET NEW.total_co2_kg = ROUND(
        (NEW.electricity_kwh * v_elec_factor) +
        (NEW.water_liters    * v_water_factor) +
        (NEW.waste_kg        * v_waste_factor),
        2  -- round to 2 decimal places
    );
END$$


-- -----------------------------------------------------------------------------
-- TRIGGER 2: trg_usage_calc_co2_update
-- FIRES: BEFORE an existing row in monthly_usage is updated
-- DOES: Same as Trigger 1, but for when someone EDITS an existing usage record.
--       It recalculates CO2 so the stored value is always up-to-date.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_usage_calc_co2_update
BEFORE UPDATE ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_elec_factor  DECIMAL(10, 4) DEFAULT 0.4500;
    DECLARE v_water_factor DECIMAL(10, 4) DEFAULT 0.0003;
    DECLARE v_waste_factor DECIMAL(10, 4) DEFAULT 0.5000;

    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN kg_co2_per_unit END), 0.4500),
           COALESCE(MAX(CASE WHEN resource_type = 'water'       THEN kg_co2_per_unit END), 0.0003),
           COALESCE(MAX(CASE WHEN resource_type = 'waste'       THEN kg_co2_per_unit END), 0.5000)
    INTO v_elec_factor, v_water_factor, v_waste_factor
    FROM emission_factors;

    SET NEW.total_co2_kg = ROUND(
        (NEW.electricity_kwh * v_elec_factor) +
        (NEW.water_liters    * v_water_factor) +
        (NEW.waste_kg        * v_waste_factor),
        2
    );
END$$


-- -----------------------------------------------------------------------------
-- TRIGGER 3: trg_usage_alert_insert
-- FIRES: AFTER a new row is inserted into monthly_usage
-- DOES: Compares the new usage values against the limits in usage_limits.
--       If any value is TOO HIGH, it automatically inserts a row into alerts.
-- WHY AFTER (not BEFORE): We need the new row's usage_id (primary key) to
--   create the alert. The usage_id only exists AFTER the row is saved.
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_usage_alert_insert
AFTER INSERT ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_bldg_name  VARCHAR(100);
    DECLARE v_limit_elec  DECIMAL(12, 2);
    DECLARE v_limit_water DECIMAL(12, 2);
    DECLARE v_limit_waste DECIMAL(12, 2);

    -- Get the building's name so the alert message is readable
    SELECT building_name INTO v_bldg_name
    FROM buildings WHERE building_id = NEW.building_id;

    -- Get the three limits from usage_limits table
    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'water'       THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'waste'       THEN max_monthly_value END), 999999999)
    INTO v_limit_elec, v_limit_water, v_limit_waste
    FROM usage_limits;

    -- Check electricity: if it exceeds the limit, create an alert
    IF NEW.electricity_kwh > v_limit_elec THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'electricity',
            CONCAT('HIGH USAGE: ', v_bldg_name, ' exceeded electricity limit with ', NEW.electricity_kwh, ' kWh (limit: ', v_limit_elec, ' kWh) in ', NEW.month, '/', NEW.year)
        );
    END IF;

    -- Check water: if it exceeds the limit, create an alert
    IF NEW.water_liters > v_limit_water THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'water',
            CONCAT('HIGH USAGE: ', v_bldg_name, ' exceeded water limit with ', NEW.water_liters, ' Liters (limit: ', v_limit_water, ' L) in ', NEW.month, '/', NEW.year)
        );
    END IF;

    -- Check waste: if it exceeds the limit, create an alert
    IF NEW.waste_kg > v_limit_waste THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'waste',
            CONCAT('HIGH USAGE: ', v_bldg_name, ' exceeded waste limit with ', NEW.waste_kg, ' kg (limit: ', v_limit_waste, ' kg) in ', NEW.month, '/', NEW.year)
        );
    END IF;
END$$


-- -----------------------------------------------------------------------------
-- TRIGGER 4: trg_usage_alert_update
-- FIRES: AFTER an existing row in monthly_usage is updated
-- DOES: Same alert check as Trigger 3, but for EDITED records.
--       Extra condition: only creates a new alert if the value actually changed
--       AND it now exceeds the limit (avoids duplicate alerts on every edit).
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_usage_alert_update
AFTER UPDATE ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_bldg_name  VARCHAR(100);
    DECLARE v_limit_elec  DECIMAL(12, 2);
    DECLARE v_limit_water DECIMAL(12, 2);
    DECLARE v_limit_waste DECIMAL(12, 2);

    SELECT building_name INTO v_bldg_name
    FROM buildings WHERE building_id = NEW.building_id;

    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'water'       THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'waste'       THEN max_monthly_value END), 999999999)
    INTO v_limit_elec, v_limit_water, v_limit_waste
    FROM usage_limits;

    -- Electricity check on change
    IF NEW.electricity_kwh > v_limit_elec AND (OLD.electricity_kwh <= v_limit_elec OR OLD.electricity_kwh != NEW.electricity_kwh) THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'electricity',
            CONCAT('HIGH USAGE UPDATE: ', v_bldg_name, ' recorded ', NEW.electricity_kwh, ' kWh exceeding limit of ', v_limit_elec, ' kWh (Period: ', NEW.month, '/', NEW.year, ')')
        );
    END IF;

    -- Water check on change
    IF NEW.water_liters > v_limit_water AND (OLD.water_liters <= v_limit_water OR OLD.water_liters != NEW.water_liters) THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'water',
            CONCAT('HIGH USAGE UPDATE: ', v_bldg_name, ' recorded ', NEW.water_liters, ' Liters exceeding limit of ', v_limit_water, ' L (Period: ', NEW.month, '/', NEW.year, ')')
        );
    END IF;

    -- Waste check on change
    IF NEW.waste_kg > v_limit_waste AND (OLD.waste_kg <= v_limit_waste OR OLD.waste_kg != NEW.waste_kg) THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'waste',
            CONCAT('HIGH USAGE UPDATE: ', v_bldg_name, ' recorded ', NEW.waste_kg, ' kg exceeding limit of ', v_limit_waste, ' kg (Period: ', NEW.month, '/', NEW.year, ')')
        );
    END IF;
END$$


-- =============================================================================
-- STORED PROCEDURES
-- A stored procedure is a saved SQL program that you run by calling its name.
-- Syntax to run a procedure: CALL procedure_name(parameter1, parameter2);
-- Benefit: the database pre-compiles it, so it runs faster than typing the
-- full query every time. Also keeps complex logic inside the database.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PROCEDURE 1: sp_monthly_report
-- WHAT IT DOES: Shows total electricity, water, waste, and CO2 for EVERY
--               department for a given month and year.
-- HOW TO CALL:  CALL sp_monthly_report(6, 2026);   -- June 2026
-- PARAMETERS:   p_month (1-12), p_year (e.g. 2026)
-- -----------------------------------------------------------------------------
CREATE PROCEDURE sp_monthly_report(
    IN p_month TINYINT,
    IN p_year  SMALLINT
)
BEGIN
    SELECT 
        d.department_id,
        d.department_name,
        d.department_code,
        COUNT(DISTINCT b.building_id)        AS total_buildings,
        COALESCE(SUM(mu.electricity_kwh), 0.00) AS total_electricity_kwh,
        COALESCE(SUM(mu.water_liters),    0.00) AS total_water_liters,
        COALESCE(SUM(mu.waste_kg),        0.00) AS total_waste_kg,
        COALESCE(SUM(mu.total_co2_kg),    0.00) AS total_co2_kg,
        COUNT(a.alert_id)                    AS total_alerts
    FROM departments d
    LEFT JOIN buildings    b  ON d.department_id = b.department_id
    LEFT JOIN monthly_usage mu ON b.building_id  = mu.building_id
                               AND mu.month = p_month
                               AND mu.year  = p_year
    LEFT JOIN alerts       a  ON mu.usage_id = a.usage_id
    GROUP BY d.department_id, d.department_name, d.department_code
    ORDER BY total_co2_kg ASC;  -- lowest CO2 first (best department first)
END$$


-- -----------------------------------------------------------------------------
-- PROCEDURE 2: sp_department_report
-- WHAT IT DOES: Shows each BUILDING's usage for a specific department,
--               month, and year. Used in the Chairperson's dashboard.
-- HOW TO CALL:  CALL sp_department_report(1, 6, 2026);  -- CS dept, June 2026
-- PARAMETERS:   p_dept_id (department number), p_month, p_year
-- -----------------------------------------------------------------------------
CREATE PROCEDURE sp_department_report(
    IN p_dept_id INT,
    IN p_month   TINYINT,
    IN p_year    SMALLINT
)
BEGIN
    SELECT 
        b.building_id,
        b.building_name,
        d.department_name,
        COALESCE(mu.usage_id,        0)    AS usage_id,
        COALESCE(mu.electricity_kwh, 0.00) AS electricity_kwh,
        COALESCE(mu.water_liters,    0.00) AS water_liters,
        COALESCE(mu.waste_kg,        0.00) AS waste_kg,
        COALESCE(mu.total_co2_kg,    0.00) AS total_co2_kg,
        -- Subquery: count alerts for this specific usage record
        (SELECT COUNT(*) FROM alerts a WHERE a.usage_id = mu.usage_id) AS alerts_count
    FROM buildings b
    INNER JOIN departments d   ON b.department_id = d.department_id
    LEFT  JOIN monthly_usage mu ON b.building_id  = mu.building_id
                                AND mu.month = p_month
                                AND mu.year  = p_year
    WHERE b.department_id = p_dept_id
    ORDER BY b.building_name ASC;
END$$


-- -----------------------------------------------------------------------------
-- PROCEDURE 3: sp_student_points
-- WHAT IT DOES: Shows a student's total green points (approved activities only),
--               plus a count of approved, pending, and rejected submissions.
-- HOW TO CALL:  CALL sp_student_points(8);   -- user_id = 8 (Ali Raza)
-- PARAMETERS:   p_student_id (the user_id of the student)
-- -----------------------------------------------------------------------------
CREATE PROCEDURE sp_student_points(
    IN p_student_id INT
)
BEGIN
    SELECT 
        u.user_id,
        u.full_name,
        u.email,
        d.department_name,
        -- SUM points only for 'approved' activities; rejected/pending count as 0
        COALESCE(SUM(CASE WHEN sa.status = 'approved' THEN eat.points ELSE 0 END), 0) AS total_green_points,
        COUNT(CASE WHEN sa.status = 'approved'  THEN 1 END) AS approved_count,
        COUNT(CASE WHEN sa.status = 'pending'   THEN 1 END) AS pending_count,
        COUNT(CASE WHEN sa.status = 'rejected'  THEN 1 END) AS rejected_count
    FROM users u
    LEFT JOIN departments       d   ON u.department_id      = d.department_id
    LEFT JOIN student_activities sa  ON u.user_id            = sa.student_id
    LEFT JOIN eco_activity_types eat ON sa.activity_type_id  = eat.activity_type_id
    WHERE u.user_id = p_student_id AND u.role = 'student'
    GROUP BY u.user_id, u.full_name, u.email, d.department_name;
END$$

DELIMITER ;


-- =============================================================================
-- VIEWS
-- A VIEW is like giving a name to a SELECT query.
-- You query it just like a table: SELECT * FROM view_name;
-- But it does NOT store any data — it runs the underlying SELECT each time.
-- Think of it as a "saved shortcut" to a complex query.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- VIEW 1: v_department_leaderboard
-- SHOWS: All departments ranked by their total CO2 (lowest CO2 = Rank 1 = best)
-- USES: RANK() window function — assigns a rank number based on CO2 amount
-- HOW TO QUERY: SELECT * FROM v_department_leaderboard ORDER BY carbon_rank;
-- -----------------------------------------------------------------------------
CREATE VIEW v_department_leaderboard AS
SELECT 
    d.department_id,
    d.department_name,
    d.department_code,
    COUNT(DISTINCT b.building_id)           AS total_buildings,
    COALESCE(SUM(mu.electricity_kwh), 0.00) AS total_electricity_kwh,
    COALESCE(SUM(mu.water_liters),    0.00) AS total_water_liters,
    COALESCE(SUM(mu.waste_kg),        0.00) AS total_waste_kg,
    COALESCE(SUM(mu.total_co2_kg),    0.00) AS total_co2_kg,
    -- RANK(): assigns 1 to the lowest CO2 dept, 2 to next, etc.
    -- OVER (ORDER BY ...): tells RANK() to sort by total CO2 ascending
    RANK() OVER (ORDER BY COALESCE(SUM(mu.total_co2_kg), 0.00) ASC) AS carbon_rank
FROM departments d
LEFT JOIN buildings    b  ON d.department_id = b.department_id
LEFT JOIN monthly_usage mu ON b.building_id  = mu.building_id
GROUP BY d.department_id, d.department_name, d.department_code;


-- -----------------------------------------------------------------------------
-- VIEW 2: v_student_leaderboard
-- SHOWS: All students ranked by their total approved green points
--        (highest points = Rank 1 = best eco student)
-- HOW TO QUERY: SELECT * FROM v_student_leaderboard ORDER BY student_rank;
-- -----------------------------------------------------------------------------
CREATE VIEW v_student_leaderboard AS
SELECT 
    u.user_id,
    u.full_name,
    u.email,
    d.department_name,
    d.department_code,
    COALESCE(SUM(eat.points), 0)   AS total_points,
    COUNT(sa.log_id)               AS approved_activities_count,
    -- RANK() descending: highest points gets rank 1
    RANK() OVER (ORDER BY COALESCE(SUM(eat.points), 0) DESC) AS student_rank
FROM users u
LEFT JOIN departments        d   ON u.department_id     = d.department_id
LEFT JOIN student_activities sa  ON u.user_id           = sa.student_id
                                 AND sa.status = 'approved'   -- only count approved
LEFT JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
WHERE u.role = 'student'
GROUP BY u.user_id, u.full_name, u.email, d.department_name, d.department_code;


-- -----------------------------------------------------------------------------
-- VIEW 3: v_building_co2_summary
-- SHOWS: Each building's total and average monthly CO2 across all recorded months.
-- Useful for spotting which buildings consistently consume the most resources.
-- HOW TO QUERY: SELECT * FROM v_building_co2_summary ORDER BY total_co2_kg DESC;
-- -----------------------------------------------------------------------------
CREATE VIEW v_building_co2_summary AS
SELECT 
    b.building_id,
    b.building_name,
    d.department_id,
    d.department_name,
    d.department_code,
    COUNT(mu.usage_id)                           AS recorded_months,
    COALESCE(SUM(mu.electricity_kwh), 0.00)      AS total_electricity_kwh,
    COALESCE(SUM(mu.water_liters),    0.00)      AS total_water_liters,
    COALESCE(SUM(mu.waste_kg),        0.00)      AS total_waste_kg,
    COALESCE(SUM(mu.total_co2_kg),    0.00)      AS total_co2_kg,
    ROUND(COALESCE(AVG(mu.total_co2_kg), 0.00), 2) AS avg_monthly_co2_kg
FROM buildings b
INNER JOIN departments  d   ON b.department_id = d.department_id
LEFT  JOIN monthly_usage mu ON b.building_id   = mu.building_id
GROUP BY b.building_id, b.building_name, d.department_id, d.department_name, d.department_code;
