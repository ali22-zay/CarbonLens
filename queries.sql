-- =============================================================================
-- CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
-- Course: CS-2104 Database Systems
-- This file contains example queries for your viva and lab exam.
-- Topics covered: JOINs, GROUP BY, HAVING, Subqueries, Window Functions,
--                 CTEs, Stored Procedures, and Views.
-- =============================================================================

USE carbonlens_db;

-- -----------------------------------------------------------------------------
-- QUERY 1: Joining Three Tables with a Date Filter
-- Q: Which buildings used which resources in June 2026, and who owns them?
--
-- How it works:
--   INNER JOIN links monthly_usage → buildings → departments using their
--   foreign keys. Only rows that exist in ALL three tables appear in the result.
--   WHERE filters to June (month = 6) of 2026 only.
--   ORDER BY total_co2_kg DESC puts the highest polluters at the top.
-- -----------------------------------------------------------------------------
SELECT 
    mu.usage_id,
    d.department_name,
    d.department_code,
    b.building_name,
    mu.month,
    mu.year,
    mu.electricity_kwh,
    mu.water_liters,
    mu.waste_kg,
    mu.total_co2_kg
FROM monthly_usage mu
INNER JOIN buildings b ON mu.building_id = b.building_id
INNER JOIN departments d ON b.department_id = d.department_id
WHERE mu.year = 2026 AND mu.month = 6
ORDER BY mu.total_co2_kg DESC;


-- -----------------------------------------------------------------------------
-- QUERY 2: Counting Buildings per Department (including empty departments)
-- Q: How many buildings does each department have on campus?
--
-- How it works:
--   LEFT JOIN is used instead of INNER JOIN so that departments with zero
--   buildings still show up in the result (with a count of 0).
--   If we used INNER JOIN, departments with no buildings would be hidden.
--   GROUP BY collapses all buildings in the same department into one result row.
--   COUNT(b.building_id) counts only real building rows (NULLs are skipped).
--
-- Viva Q: Why LEFT JOIN and not INNER JOIN?
-- A: INNER JOIN only returns rows that have a match in both tables. If a
--    department has no buildings yet, INNER JOIN would hide it completely.
--    LEFT JOIN keeps every department in the result even with no match.
-- -----------------------------------------------------------------------------
SELECT 
    d.department_id,
    d.department_name,
    d.department_code,
    COUNT(b.building_id) AS total_buildings
FROM departments d
LEFT JOIN buildings b ON d.department_id = b.department_id
GROUP BY d.department_id, d.department_name, d.department_code
ORDER BY total_buildings DESC, d.department_name ASC;


-- -----------------------------------------------------------------------------
-- QUERY 3: Total Resources per Department, Filtered by CO2 Amount
-- Q: Which departments have produced more than 50,000 kg of CO2 in total?
--
-- How it works:
--   GROUP BY groups all usage records by department so we can SUM them.
--   HAVING filters the grouped results — it works like WHERE but runs AFTER
--   the GROUP BY. You cannot use WHERE to filter on SUM() results.
--   WHERE filters individual rows BEFORE grouping; HAVING filters groups AFTER.
--
-- Viva Q: What is the difference between WHERE and HAVING?
-- A: WHERE runs before grouping and filters individual rows.
--    HAVING runs after grouping and filters entire groups.
--    You need HAVING whenever your filter uses an aggregate like SUM or COUNT.
-- -----------------------------------------------------------------------------
SELECT 
    d.department_name,
    ROUND(SUM(mu.electricity_kwh), 2) AS total_electricity_kwh,
    ROUND(SUM(mu.water_liters), 2) AS total_water_liters,
    ROUND(SUM(mu.waste_kg), 2) AS total_waste_kg,
    ROUND(SUM(mu.total_co2_kg), 2) AS total_co2_kg
FROM departments d
INNER JOIN buildings b ON d.department_id = b.department_id
INNER JOIN monthly_usage mu ON b.building_id = mu.building_id
GROUP BY d.department_id, d.department_name
HAVING total_co2_kg > 50000.00
ORDER BY total_co2_kg DESC;


-- -----------------------------------------------------------------------------
-- QUERY 4: Comparing Each Building to the Campus Average (Scalar Subquery)
-- Q: Which buildings use more electricity on average than the campus average?
--
-- How it works:
--   The part inside the parentheses — (SELECT AVG(electricity_kwh) FROM monthly_usage)
--   — is a subquery. It runs first and produces one single number (the campus average).
--   The outer query then compares each building's average against that number.
--   A subquery that returns exactly one value is called a "scalar subquery."
--
-- Viva Q: What is a scalar subquery?
-- A: It is a subquery written inside another query that returns exactly one
--    value (one row, one column). You can use it anywhere a single value is
--    expected — like inside HAVING or WHERE for comparisons.
-- -----------------------------------------------------------------------------
SELECT 
    b.building_name,
    d.department_name,
    ROUND(AVG(mu.electricity_kwh), 2) AS avg_building_electricity_kwh
FROM buildings b
INNER JOIN departments d ON b.department_id = d.department_id
INNER JOIN monthly_usage mu ON b.building_id = mu.building_id
GROUP BY b.building_id, b.building_name, d.department_name
HAVING avg_building_electricity_kwh > (
    SELECT AVG(electricity_kwh) 
    FROM monthly_usage
)
ORDER BY avg_building_electricity_kwh DESC;


-- -----------------------------------------------------------------------------
-- QUERY 5: Finding Each Building's Worst CO2 Month (Correlated Subquery)
-- Q: What was each building's single worst month for carbon emissions?
--
-- How it works:
--   The inner subquery references outer_mu.building_id, which comes from the
--   outer query. This means the subquery runs separately for every single
--   building row in the outer query — that is what makes it "correlated."
--   It finds the MAX CO2 for that specific building, then the outer query
--   keeps only the row where total_co2_kg equals that maximum.
--
-- Viva Q: What is a correlated subquery?
-- A: A correlated subquery uses a value from the outer query inside itself.
--    It re-executes for every row in the outer query, making it more powerful
--    but also slower than a regular subquery on large tables.
-- -----------------------------------------------------------------------------
SELECT 
    b.building_name,
    outer_mu.month,
    outer_mu.year,
    outer_mu.total_co2_kg AS peak_co2_kg
FROM monthly_usage outer_mu
INNER JOIN buildings b ON outer_mu.building_id = b.building_id
WHERE outer_mu.total_co2_kg = (
    SELECT MAX(inner_mu.total_co2_kg)
    FROM monthly_usage inner_mu
    WHERE inner_mu.building_id = outer_mu.building_id
)
ORDER BY outer_mu.total_co2_kg DESC;


-- -----------------------------------------------------------------------------
-- QUERY 6: Finding Students with Pending Activities (Subquery with IN)
-- Q: Which students have at least one activity that is still waiting for review?
--
-- How it works:
--   The subquery produces a list of student_id values where status = 'pending'.
--   The outer query then uses IN to keep only users whose user_id is in that list.
--   DISTINCT inside the subquery avoids duplicates — if a student has three
--   pending activities, their ID only appears once in the list.
--
-- Viva Q: What does IN do with a subquery?
-- A: IN checks whether a value exists anywhere in the list returned by the
--    subquery. It is a clean alternative to writing many OR conditions.
-- -----------------------------------------------------------------------------
SELECT 
    u.user_id,
    u.full_name,
    u.email,
    d.department_name
FROM users u
INNER JOIN departments d ON u.department_id = d.department_id
WHERE u.role = 'student'
  AND u.user_id IN (
      SELECT DISTINCT student_id 
      FROM student_activities 
      WHERE status = 'pending'
  )
ORDER BY u.full_name ASC;


-- -----------------------------------------------------------------------------
-- QUERY 7: Ranking Students by Green Points (Window Functions)
-- Q: How do students rank by eco-points, and what happens when two students tie?
--
-- How it works:
--   RANK() and DENSE_RANK() are window functions — they assign a rank number
--   to each row based on an ORDER BY without removing any rows.
--   RANK(): If two students tie at rank 2, the next student gets rank 4
--           (rank 3 is skipped). Think: like a sports podium where two silvers
--           means nobody gets bronze.
--   DENSE_RANK(): Ties still share the same rank, but the next rank is
--                 always one higher (no gaps). 1, 2, 2, 3, 4...
--
-- Viva Q: What is the difference between RANK() and DENSE_RANK()?
-- A: RANK() leaves gaps after ties (1, 2, 2, 4).
--    DENSE_RANK() never leaves gaps (1, 2, 2, 3).
--    Use DENSE_RANK() when you don't want to confuse users with missing numbers.
-- -----------------------------------------------------------------------------
SELECT 
    u.full_name,
    d.department_code,
    COALESCE(SUM(eat.points), 0) AS total_points,
    RANK() OVER (ORDER BY COALESCE(SUM(eat.points), 0) DESC) AS rank_with_gaps,
    DENSE_RANK() OVER (ORDER BY COALESCE(SUM(eat.points), 0) DESC) AS dense_rank_no_gaps
FROM users u
LEFT JOIN departments d ON u.department_id = d.department_id
LEFT JOIN student_activities sa ON u.user_id = sa.student_id AND sa.status = 'approved'
LEFT JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
WHERE u.role = 'student'
GROUP BY u.user_id, u.full_name, d.department_code
ORDER BY total_points DESC;


-- -----------------------------------------------------------------------------
-- QUERY 8: Month-over-Month CO2 Change Using a CTE and LAG()
-- Q: Is campus CO2 going up or down each month compared to the previous month?
--
-- How it works:
--   WITH CampusMonthlyTotals AS (...) is a CTE (Common Table Expression).
--   A CTE is a temporary named result that you define once and then use below,
--   like a temporary table that only lives for this one query.
--   LAG(monthly_co2, 1): This window function looks at the previous row's value
--   (1 row back in the ORDER BY). This lets us calculate the change between months.
--   The percentage change formula: ((this month - last month) / last month) * 100
--
-- Viva Q: What is a CTE and why is it useful?
-- A: A CTE (written with the WITH keyword) lets you write a sub-result once and
--    give it a name. It makes long queries much easier to read because you can
--    break them into labeled steps instead of nesting everything together.
-- -----------------------------------------------------------------------------
WITH CampusMonthlyTotals AS (
    SELECT 
        year,
        month,
        ROUND(SUM(total_co2_kg), 2) AS monthly_co2
    FROM monthly_usage
    GROUP BY year, month
)
SELECT 
    year,
    month,
    monthly_co2,
    LAG(monthly_co2, 1) OVER (ORDER BY year, month) AS prev_month_co2,
    ROUND(
        ((monthly_co2 - LAG(monthly_co2, 1) OVER (ORDER BY year, month)) / 
        LAG(monthly_co2, 1) OVER (ORDER BY year, month)) * 100, 
        2
    ) AS pct_change
FROM CampusMonthlyTotals
ORDER BY year, month;


-- -----------------------------------------------------------------------------
-- QUERY 9: Viewing All Alerts with Building Details
-- Q: Which buildings triggered an alert, and what was the reason?
--
-- How it works:
--   Joins the alerts table to monthly_usage to get the usage details,
--   then joins to buildings to get the building name.
--   This gives the admin a readable incident report showing every warning
--   message that the triggers created automatically.
--   ORDER BY created_at DESC shows the newest alerts first.
--
-- Viva Q: How does this query connect to the triggers in schema.sql?
-- A: The alerts table is only populated by the AFTER INSERT and AFTER UPDATE
--    triggers on monthly_usage. Admins never insert alerts manually.
--    This query reads what those triggers wrote.
-- -----------------------------------------------------------------------------
SELECT 
    a.alert_id,
    b.building_name,
    a.resource_type,
    a.message,
    a.is_read,
    a.created_at
FROM alerts a
INNER JOIN monthly_usage mu ON a.usage_id = mu.usage_id
INNER JOIN buildings b ON mu.building_id = b.building_id
ORDER BY a.created_at DESC;


-- -----------------------------------------------------------------------------
-- QUERY 10: Running a Stored Procedure — Campus Monthly Report
-- Q: What is the total CO2 output of every department for June 2026?
--
-- How it works:
--   CALL runs the stored procedure sp_monthly_report with the given inputs.
--   The procedure does all the complex joins and grouping internally.
--   You just provide the month (6) and year (2026) as arguments.
--
-- Viva Q: Why use a stored procedure instead of writing the query every time?
-- A: A stored procedure is saved inside the database. It runs faster (MySQL
--    pre-plans it), it can be reused by any application or user, and it hides
--    the complex SQL logic so you only expose a simple CALL command.
-- -----------------------------------------------------------------------------
CALL sp_monthly_report(6, 2026);


-- -----------------------------------------------------------------------------
-- QUERY 11: Running a Stored Procedure — Department Building Breakdown
-- Q: How did each building in department 1 perform in June 2026?
--
-- How it works:
--   Calls sp_department_report with three inputs: department ID, month, year.
--   The procedure returns one row per building showing electricity, water,
--   waste, total CO2, and how many alerts that building triggered.
--   Buildings with no data for that month still appear (with zeros) because
--   the procedure uses LEFT JOIN.
--
-- Viva Q: What would happen if we changed LEFT JOIN to INNER JOIN inside this procedure?
-- A: Buildings that have no usage record for that month would disappear
--    from the results. LEFT JOIN is safer for reports because it always
--    shows all buildings even if they have no data yet.
-- -----------------------------------------------------------------------------
CALL sp_department_report(1, 6, 2026);


-- -----------------------------------------------------------------------------
-- QUERY 12: Reading a Database View — Department Leaderboard
-- Q: Which departments are the most eco-friendly based on total CO2?
--
-- How it works:
--   v_department_leaderboard is a VIEW — a saved SELECT query stored in MySQL.
--   When you SELECT from it, MySQL runs the original query fresh each time.
--   No data is duplicated; the view always shows up-to-date figures.
--   We filter and order on top of the view just like a regular table.
--
-- Viva Q: Does a view store data on disk?
-- A: No. A regular view stores only the SELECT query definition, not the
--    actual data. Every time you query the view, MySQL re-runs that SELECT
--    to fetch fresh data. This saves disk space and keeps results current.
-- -----------------------------------------------------------------------------
SELECT 
    carbon_rank,
    department_name,
    department_code,
    total_buildings,
    total_co2_kg
FROM v_department_leaderboard
ORDER BY carbon_rank ASC;
