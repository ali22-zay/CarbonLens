-- =============================================================================
-- CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
-- Course: CS-2104 Database Systems
-- This file creates all the tables, triggers, stored procedures, and views
-- needed to run the CarbonLens system.
-- Works with: MySQL 8.0 or newer / MySQL Workbench
-- =============================================================================

CREATE DATABASE IF NOT EXISTS carbonlens_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE carbonlens_db;

-- If you run this file a second time, MySQL will first delete any old
-- views, procedures, triggers, and tables so there are no conflicts.
-- Think of this block as a "clean slate" before re-creating everything.
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
-- What it stores: The list of university departments (e.g., Computer Science,
--                 Electrical Engineering, Admin Office).
-- Primary Key (department_id): A unique number MySQL gives each department
--                              automatically so we can always tell them apart.
-- Each column stores only one piece of information (name, code, timestamp),
-- which keeps the table clean and easy to update.
-- =============================================================================
CREATE TABLE departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    department_code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 2: buildings
-- What it stores: Every physical building on campus and which department owns it.
-- Foreign Key (department_id): Links each building back to its department in
--                              the departments table.
-- ON DELETE CASCADE: If a department is deleted, all its buildings are
--                   automatically deleted too — no leftover orphan records.
-- ON UPDATE CASCADE: If a department's ID changes, MySQL updates the link
--                   in this table automatically.
-- =============================================================================
CREATE TABLE buildings (
    building_id INT AUTO_INCREMENT PRIMARY KEY,
    building_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_buildings_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 3: users
-- What it stores: Everyone who can log in — admins, chairpersons, and students.
-- The 'role' column limits values to only 'admin', 'chairperson', or 'student'
-- so no invalid role can ever be saved.
-- Admins are not tied to any department, so department_id can be NULL for them.
-- ON DELETE SET NULL: If a department is removed, the user account stays safe —
--                    their department_id just becomes NULL instead of being deleted.
-- =============================================================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'chairperson', 'student') NOT NULL,
    department_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 4: emission_factors
-- What it stores: The conversion rate for each resource type — basically,
--                 "how many kg of CO2 does one unit of this resource produce?"
-- Example: 1 kWh of electricity = 0.45 kg CO2
-- Admins can update these numbers any time without changing the table structure.
-- CHECK constraint: kg_co2_per_unit cannot be negative (a negative CO2 rate
--                  makes no real-world sense).
-- =============================================================================
CREATE TABLE emission_factors (
    factor_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_type ENUM('electricity', 'water', 'waste') NOT NULL UNIQUE,
    unit VARCHAR(20) NOT NULL,
    kg_co2_per_unit DECIMAL(10, 4) NOT NULL CHECK (kg_co2_per_unit >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 5: monthly_usage
-- What it stores: How much electricity, water, and waste each building used
--                 in a given month and year.
-- total_co2_kg: You do NOT enter this manually — a trigger calculates it for
--               you automatically every time a row is inserted or updated.
-- UNIQUE constraint on (building_id, month, year): Prevents the same building
--                 from having two different records for the same month.
-- Foreign Key (building_id): Each usage record must belong to a known building.
-- ON DELETE CASCADE: If a building is deleted, its usage history goes with it.
-- =============================================================================
CREATE TABLE monthly_usage (
    usage_id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    month TINYINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year SMALLINT NOT NULL CHECK (year >= 2000),
    electricity_kwh DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (electricity_kwh >= 0),
    water_liters DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (water_liters >= 0),
    waste_kg DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (waste_kg >= 0),
    total_co2_kg DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_co2_kg >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_building_month_year UNIQUE (building_id, month, year),
    CONSTRAINT fk_monthly_usage_building
        FOREIGN KEY (building_id) REFERENCES buildings(building_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 6: usage_limits
-- What it stores: The maximum allowed monthly usage for each resource
--                 (electricity, water, waste).
-- If any building's monthly usage goes over these limits, a trigger will
-- automatically create an alert in the alerts table.
-- =============================================================================
CREATE TABLE usage_limits (
    limit_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_type ENUM('electricity', 'water', 'waste') NOT NULL UNIQUE,
    max_monthly_value DECIMAL(12, 2) NOT NULL CHECK (max_monthly_value >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 7: alerts
-- What it stores: Warning messages that are created automatically whenever
--                 a building exceeds its allowed usage limit for any resource.
-- You never insert into this table manually — the triggers do it for you.
-- is_read: Lets admins mark an alert as "seen" (TRUE) or "unseen" (FALSE).
-- ON DELETE CASCADE: If the usage record is deleted, its alerts disappear too.
-- =============================================================================
CREATE TABLE alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    usage_id INT NOT NULL,
    resource_type ENUM('electricity', 'water', 'waste') NOT NULL,
    message VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_alerts_usage
        FOREIGN KEY (usage_id) REFERENCES monthly_usage(usage_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 8: eco_activity_types
-- What it stores: The approved list of green activities students can log
--                 (e.g., "Planted a tree", "Attended recycling workshop")
--                 and how many points each one is worth.
-- Having a separate table means if the points change, you update one row
-- here instead of hundreds of student records.
-- =============================================================================
CREATE TABLE eco_activity_types (
    activity_type_id INT AUTO_INCREMENT PRIMARY KEY,
    activity_name VARCHAR(100) NOT NULL UNIQUE,
    points INT NOT NULL CHECK (points > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- TABLE 9: student_activities
-- What it stores: Every green activity that a student has submitted for points.
-- status: Starts as 'pending'. A chairperson or admin can change it to
--         'approved' (points count) or 'rejected' (points don't count).
-- reviewed_by: The user_id of whoever approved or rejected the activity.
--              Can be NULL if nobody has reviewed it yet.
-- ON DELETE CASCADE (student): If a student account is deleted, their
--                              activity log is deleted too.
-- ON DELETE RESTRICT (activity type): You cannot delete an activity type
--                    if students have already logged it — prevents data loss.
-- ON DELETE SET NULL (reviewer): If the reviewer's account is deleted,
--                    the activity record stays but reviewed_by becomes NULL.
-- =============================================================================
CREATE TABLE student_activities (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    activity_type_id INT NOT NULL,
    activity_date DATE NOT NULL,
    description TEXT,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

-- These indexes speed up the most common searches in the system.
-- An index works like a book's index — it helps MySQL find rows faster
-- without scanning the entire table every time.
CREATE INDEX idx_usage_date ON monthly_usage(year, month);
CREATE INDEX idx_usage_building ON monthly_usage(building_id);
CREATE INDEX idx_activities_student ON student_activities(student_id, status);
CREATE INDEX idx_users_role_dept ON users(role, department_id);

-- =============================================================================
-- TRIGGERS
-- A trigger is code that MySQL runs automatically when something happens
-- to a table (an INSERT or UPDATE). You never call a trigger yourself.
-- =============================================================================

DELIMITER $$

-- TRIGGER 1: trg_usage_calc_co2_insert
-- When does it fire? Right BEFORE a new row is saved into monthly_usage.
-- What does it do? It looks up the current CO2 rates from emission_factors
--   and calculates total_co2_kg for you using this formula:
--   total_co2 = (electricity_kwh x elec_rate) + (water_liters x water_rate) + (waste_kg x waste_rate)
-- Why? So the total CO2 value is always accurate and you never have to
--   calculate it yourself when entering data.
CREATE TRIGGER trg_usage_calc_co2_insert
BEFORE INSERT ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_elec_factor DECIMAL(10, 4) DEFAULT 0.4500;
    DECLARE v_water_factor DECIMAL(10, 4) DEFAULT 0.0003;
    DECLARE v_waste_factor DECIMAL(10, 4) DEFAULT 0.5000;

    -- Lookup current emission factors
    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN kg_co2_per_unit END), 0.4500),
           COALESCE(MAX(CASE WHEN resource_type = 'water' THEN kg_co2_per_unit END), 0.0003),
           COALESCE(MAX(CASE WHEN resource_type = 'waste' THEN kg_co2_per_unit END), 0.5000)
    INTO v_elec_factor, v_water_factor, v_waste_factor
    FROM emission_factors;

    SET NEW.total_co2_kg = ROUND(
        (NEW.electricity_kwh * v_elec_factor) +
        (NEW.water_liters * v_water_factor) +
        (NEW.waste_kg * v_waste_factor),
        2
    );
END$$

-- TRIGGER 2: trg_usage_calc_co2_update
-- When does it fire? Right BEFORE an existing monthly_usage row is updated.
-- What does it do? Same CO2 calculation as Trigger 1, but for updates.
--   This keeps total_co2_kg correct even when someone edits old data.
CREATE TRIGGER trg_usage_calc_co2_update
BEFORE UPDATE ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_elec_factor DECIMAL(10, 4) DEFAULT 0.4500;
    DECLARE v_water_factor DECIMAL(10, 4) DEFAULT 0.0003;
    DECLARE v_waste_factor DECIMAL(10, 4) DEFAULT 0.5000;

    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN kg_co2_per_unit END), 0.4500),
           COALESCE(MAX(CASE WHEN resource_type = 'water' THEN kg_co2_per_unit END), 0.0003),
           COALESCE(MAX(CASE WHEN resource_type = 'waste' THEN kg_co2_per_unit END), 0.5000)
    INTO v_elec_factor, v_water_factor, v_waste_factor
    FROM emission_factors;

    SET NEW.total_co2_kg = ROUND(
        (NEW.electricity_kwh * v_elec_factor) +
        (NEW.water_liters * v_water_factor) +
        (NEW.waste_kg * v_waste_factor),
        2
    );
END$$

-- TRIGGER 3: trg_usage_alert_insert
-- When does it fire? Right AFTER a new row is saved into monthly_usage.
-- What does it do? It checks each resource (electricity, water, waste) against
--   the limits stored in usage_limits. If any value is too high, it
--   automatically writes a warning message into the alerts table.
-- Why AFTER and not BEFORE? Because the row needs to be saved first so
--   we have a usage_id to link the alert to.
CREATE TRIGGER trg_usage_alert_insert
AFTER INSERT ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_bldg_name VARCHAR(100);
    DECLARE v_limit_elec DECIMAL(12, 2);
    DECLARE v_limit_water DECIMAL(12, 2);
    DECLARE v_limit_waste DECIMAL(12, 2);

    SELECT building_name INTO v_bldg_name FROM buildings WHERE building_id = NEW.building_id;

    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'water' THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'waste' THEN max_monthly_value END), 999999999)
    INTO v_limit_elec, v_limit_water, v_limit_waste
    FROM usage_limits;

    -- Electricity check
    IF NEW.electricity_kwh > v_limit_elec THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'electricity',
            CONCAT('HIGH USAGE: ', v_bldg_name, ' exceeded electricity limit with ', NEW.electricity_kwh, ' kWh (limit: ', v_limit_elec, ' kWh) in ', NEW.month, '/', NEW.year)
        );
    END IF;

    -- Water check
    IF NEW.water_liters > v_limit_water THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'water',
            CONCAT('HIGH USAGE: ', v_bldg_name, ' exceeded water limit with ', NEW.water_liters, ' Liters (limit: ', v_limit_water, ' L) in ', NEW.month, '/', NEW.year)
        );
    END IF;

    -- Waste check
    IF NEW.waste_kg > v_limit_waste THEN
        INSERT INTO alerts (usage_id, resource_type, message)
        VALUES (
            NEW.usage_id,
            'waste',
            CONCAT('HIGH USAGE: ', v_bldg_name, ' exceeded waste limit with ', NEW.waste_kg, ' kg (limit: ', v_limit_waste, ' kg) in ', NEW.month, '/', NEW.year)
        );
    END IF;
END$$

-- TRIGGER 4: trg_usage_alert_update
-- When does it fire? Right AFTER an existing monthly_usage row is updated.
-- What does it do? Same limit-checking logic as Trigger 3, but for updates.
--   It only creates a new alert if the updated value still breaks the limit
--   or the value actually changed — avoids duplicate alerts for unchanged data.
CREATE TRIGGER trg_usage_alert_update
AFTER UPDATE ON monthly_usage
FOR EACH ROW
BEGIN
    DECLARE v_bldg_name VARCHAR(100);
    DECLARE v_limit_elec DECIMAL(12, 2);
    DECLARE v_limit_water DECIMAL(12, 2);
    DECLARE v_limit_waste DECIMAL(12, 2);

    SELECT building_name INTO v_bldg_name FROM buildings WHERE building_id = NEW.building_id;

    SELECT COALESCE(MAX(CASE WHEN resource_type = 'electricity' THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'water' THEN max_monthly_value END), 999999999),
           COALESCE(MAX(CASE WHEN resource_type = 'waste' THEN max_monthly_value END), 999999999)
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
-- A stored procedure is a saved SQL program you can run anytime by calling
-- its name with CALL. You can pass in values (called parameters) to make
-- it flexible — like calling a function in Python or Java.
-- =============================================================================

-- PROCEDURE 1: sp_monthly_report
-- How to call it: CALL sp_monthly_report(6, 2026);
-- What it does: Shows a summary of electricity, water, waste, and total CO2
--   for every department for a specific month and year.
-- Parameters: p_month = month number (1-12), p_year = the year (e.g. 2026)
-- It uses LEFT JOIN so departments with no buildings still appear in the list.
-- Results are sorted from lowest CO2 to highest (greener departments first).
CREATE PROCEDURE sp_monthly_report(
    IN p_month TINYINT,
    IN p_year SMALLINT
)
BEGIN
    SELECT 
        d.department_id,
        d.department_name,
        d.department_code,
        COUNT(DISTINCT b.building_id) AS total_buildings,
        COALESCE(SUM(mu.electricity_kwh), 0.00) AS total_electricity_kwh,
        COALESCE(SUM(mu.water_liters), 0.00) AS total_water_liters,
        COALESCE(SUM(mu.waste_kg), 0.00) AS total_waste_kg,
        COALESCE(SUM(mu.total_co2_kg), 0.00) AS total_co2_kg,
        COUNT(a.alert_id) AS total_alerts
    FROM departments d
    LEFT JOIN buildings b ON d.department_id = b.department_id
    LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id AND mu.month = p_month AND mu.year = p_year
    LEFT JOIN alerts a ON mu.usage_id = a.usage_id
    GROUP BY d.department_id, d.department_name, d.department_code
    ORDER BY total_co2_kg ASC;
END$$

-- PROCEDURE 2: sp_department_report
-- How to call it: CALL sp_department_report(1, 6, 2026);
-- What it does: Drills down into one specific department and shows the
--   usage numbers for each individual building that month.
-- Parameters: p_dept_id = department ID, p_month = month, p_year = year
-- COALESCE(..., 0) means "if there is no data for this building, show 0"
--   instead of showing NULL, which looks confusing in a report.
CREATE PROCEDURE sp_department_report(
    IN p_dept_id INT,
    IN p_month TINYINT,
    IN p_year SMALLINT
)
BEGIN
    SELECT 
        b.building_id,
        b.building_name,
        d.department_name,
        COALESCE(mu.usage_id, 0) AS usage_id,
        COALESCE(mu.electricity_kwh, 0.00) AS electricity_kwh,
        COALESCE(mu.water_liters, 0.00) AS water_liters,
        COALESCE(mu.waste_kg, 0.00) AS waste_kg,
        COALESCE(mu.total_co2_kg, 0.00) AS total_co2_kg,
        (SELECT COUNT(*) FROM alerts a WHERE a.usage_id = mu.usage_id) AS alerts_count
    FROM buildings b
    INNER JOIN departments d ON b.department_id = d.department_id
    LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id AND mu.month = p_month AND mu.year = p_year
    WHERE b.department_id = p_dept_id
    ORDER BY b.building_name ASC;
END$$

-- PROCEDURE 3: sp_student_points
-- How to call it: CALL sp_student_points(5);   -- where 5 is the student's user_id
-- What it does: Looks up one student and shows their total green points,
--   plus how many activities are approved, pending, or rejected.
-- Only works for users with role = 'student' (not admins or chairpersons).
-- CASE WHEN inside SUM: "Add up points only for approved activities."
CREATE PROCEDURE sp_student_points(
    IN p_student_id INT
)
BEGIN
    SELECT 
        u.user_id,
        u.full_name,
        u.email,
        d.department_name,
        COALESCE(SUM(CASE WHEN sa.status = 'approved' THEN eat.points ELSE 0 END), 0) AS total_green_points,
        COUNT(CASE WHEN sa.status = 'approved' THEN 1 END) AS approved_count,
        COUNT(CASE WHEN sa.status = 'pending' THEN 1 END) AS pending_count,
        COUNT(CASE WHEN sa.status = 'rejected' THEN 1 END) AS rejected_count
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN student_activities sa ON u.user_id = sa.student_id
    LEFT JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
    WHERE u.user_id = p_student_id AND u.role = 'student'
    GROUP BY u.user_id, u.full_name, u.email, d.department_name;
END$$

DELIMITER ;

-- =============================================================================
-- VIEWS
-- Think of a view as a saved SELECT query with a name.
-- Instead of writing a long query every time, you SELECT from the view like
-- it's a regular table. The data is always fresh — it re-runs the query
-- every time you access it. No data is duplicated on disk.
-- =============================================================================

-- VIEW 1: v_department_leaderboard
-- What it shows: All departments ranked from cleanest (least CO2) to dirtiest.
-- Rank 1 = the department with the lowest total carbon footprint.
-- RANK() is a window function — it assigns a position number to each row
--   based on how the rows are ordered, without collapsing them like GROUP BY does.
CREATE VIEW v_department_leaderboard AS
SELECT 
    d.department_id,
    d.department_name,
    d.department_code,
    COUNT(DISTINCT b.building_id) AS total_buildings,
    COALESCE(SUM(mu.electricity_kwh), 0.00) AS total_electricity_kwh,
    COALESCE(SUM(mu.water_liters), 0.00) AS total_water_liters,
    COALESCE(SUM(mu.waste_kg), 0.00) AS total_waste_kg,
    COALESCE(SUM(mu.total_co2_kg), 0.00) AS total_co2_kg,
    RANK() OVER (ORDER BY COALESCE(SUM(mu.total_co2_kg), 0.00) ASC) AS carbon_rank
FROM departments d
LEFT JOIN buildings b ON d.department_id = b.department_id
LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
GROUP BY d.department_id, d.department_name, d.department_code;

-- VIEW 2: v_student_leaderboard
-- What it shows: All students ranked from highest green points to lowest.
-- Rank 1 = the most eco-friendly student on campus.
-- Only approved activities count toward the total points.
-- Students with no approved activities appear with 0 points (not hidden).
CREATE VIEW v_student_leaderboard AS
SELECT 
    u.user_id,
    u.full_name,
    u.email,
    d.department_name,
    d.department_code,
    COALESCE(SUM(eat.points), 0) AS total_points,
    COUNT(sa.log_id) AS approved_activities_count,
    RANK() OVER (ORDER BY COALESCE(SUM(eat.points), 0) DESC) AS student_rank
FROM users u
LEFT JOIN departments d ON u.department_id = d.department_id
LEFT JOIN student_activities sa ON u.user_id = sa.student_id AND sa.status = 'approved'
LEFT JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
WHERE u.role = 'student'
GROUP BY u.user_id, u.full_name, u.email, d.department_name, d.department_code;

-- VIEW 3: v_building_co2_summary
-- What it shows: A lifetime summary for every building — total and average
--   monthly CO2, plus totals for electricity, water, and waste across all
--   months that have been recorded.
-- AVG(total_co2_kg): The average CO2 per month for that building.
-- INNER JOIN with departments: Only buildings that belong to a department
--   are shown (all buildings should, so this works fine here).
CREATE VIEW v_building_co2_summary AS
SELECT 
    b.building_id,
    b.building_name,
    d.department_id,
    d.department_name,
    d.department_code,
    COUNT(mu.usage_id) AS recorded_months,
    COALESCE(SUM(mu.electricity_kwh), 0.00) AS total_electricity_kwh,
    COALESCE(SUM(mu.water_liters), 0.00) AS total_water_liters,
    COALESCE(SUM(mu.waste_kg), 0.00) AS total_waste_kg,
    COALESCE(SUM(mu.total_co2_kg), 0.00) AS total_co2_kg,
    ROUND(COALESCE(AVG(mu.total_co2_kg), 0.00), 2) AS avg_monthly_co2_kg
FROM buildings b
INNER JOIN departments d ON b.department_id = d.department_id
LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
GROUP BY b.building_id, b.building_name, d.department_id, d.department_name, d.department_code;
