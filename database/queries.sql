-- =============================================================================
-- CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
-- Course: CS-2104 Database Systems
-- Example SQL Queries for Viva Voce & Laboratory Examination
-- Covers: Single & Multi-table JOINs, Aggregates, GROUP BY, HAVING, Subqueries,
-- Window Functions, Common Table Expressions (CTE), Stored Procedures & Views.
-- =============================================================================

USE carbonlens_db;

-- -----------------------------------------------------------------------------
-- QUERY 1: Multi-Table INNER JOIN with Date Filtering & Ordering
-- Viva Question: "How do you retrieve resource usage alongside department and building details?"
-- Explanation: Combines 3 tables (`monthly_usage`, `buildings`, `departments`) using
-- their foreign keys. Filters for the high-summer month of June 2026.
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
-- QUERY 2: LEFT OUTER JOIN with Aggregate Function (GROUP BY)
-- Viva Question: "Why use LEFT JOIN instead of INNER JOIN when counting buildings per department?"
-- Explanation: If a new department has no buildings yet, an INNER JOIN would omit it.
-- LEFT JOIN guarantees every department appears, showing 0 buildings if empty.
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
-- QUERY 3: Aggregates with GROUP BY & HAVING Filter
-- Viva Question: "What is the difference between WHERE and HAVING?"
-- Explanation: WHERE filters rows before aggregation, while HAVING filters aggregated
-- grouped results. Here, we filter for departments generating more than 50,000 kg CO2 overall.
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
-- QUERY 4: Scalar Subquery in the WHERE Clause
-- Viva Question: "How can you find buildings whose average electricity usage is higher than the campus average?"
-- Explanation: The subquery `(SELECT AVG(electricity_kwh) FROM monthly_usage)` computes
-- a single scalar value. The outer query compares each building's average against it.
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
-- QUERY 5: Correlated Subquery (Finding the Peak CO2 Month for Each Building)
-- Viva Question: "What is a correlated subquery, and why does it execute for every outer row?"
-- Explanation: The inner subquery references `outer_mu.building_id` from the outer query.
-- It finds the exact record where the building achieved its maximum monthly CO2 emission.
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
-- QUERY 6: Subquery with IN Operator & Multiple Table Joins
-- Viva Question: "How do you identify students who have logged activities that are still pending review?"
-- Explanation: Uses the IN predicate with a subquery on `student_activities` where status is 'pending'.
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
-- QUERY 7: Window Function RANK() and DENSE_RANK()
-- Viva Question: "What is the difference between RANK() and DENSE_RANK() in MySQL 8.0?"
-- Explanation: RANK() skips rank numbers after ties (e.g. 1, 2, 2, 4), whereas DENSE_RANK()
-- does not skip rank numbers (e.g. 1, 2, 2, 3). Here we rank student eco-scores.
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
-- QUERY 8: Common Table Expression (CTE) for Month-over-Month Carbon Growth
-- Viva Question: "What is a CTE (WITH clause) and what are its advantages?"
-- Explanation: A Common Table Expression creates a temporary named result set.
-- Combined with the LAG() window function, it computes the percentage change in campus emissions.
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
-- QUERY 9: Alerts Audit with Threshold Comparison
-- Viva Question: "How does the system identify which usage records triggered an alert?"
-- Explanation: Joins `alerts` with `monthly_usage`, `buildings`, and `usage_limits`
-- to present a clean incident report for administrators.
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
-- QUERY 10: Calling Stored Procedure 1: Campus-Wide Monthly Report
-- Viva Question: "What are the benefits of using stored procedures instead of inline queries?"
-- Explanation: Stored procedures reduce network traffic, pre-compile execution plans,
-- and encapsulate business logic inside the database engine.
-- -----------------------------------------------------------------------------
CALL sp_monthly_report(6, 2026);


-- -----------------------------------------------------------------------------
-- QUERY 11: Calling Stored Procedure 2: Department-Specific Building Breakdown
-- Viva Question: "How does sp_department_report support the Chairperson's dashboard?"
-- Explanation: Takes department_id (e.g., 1 for CS), month, and year, and returns
-- building-wise resource metrics and alert counts.
-- -----------------------------------------------------------------------------
CALL sp_department_report(1, 6, 2026);


-- -----------------------------------------------------------------------------
-- QUERY 12: Querying Database Views (v_department_leaderboard)
-- Viva Question: "What is a database view, and does it consume physical disk space for data?"
-- Explanation: A view is a virtual table defined by a stored SELECT query. It does not
-- store physical duplicate rows; it runs dynamically when called.
-- -----------------------------------------------------------------------------
SELECT 
    carbon_rank,
    department_name,
    department_code,
    total_buildings,
    total_co2_kg
FROM v_department_leaderboard
ORDER BY carbon_rank ASC;
