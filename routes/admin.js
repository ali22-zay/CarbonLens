const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Protect all admin routes
router.use(requireRole('admin'));

// =============================================================================
// ADMIN DASHBOARD OVERVIEW & STATS (Supports Department, Month, Year Filters)
// =============================================================================
router.get('/stats', async (req, res) => {
  try {
    const { department_id, month, year } = req.query;
    const deptId = department_id && department_id !== 'all' ? parseInt(department_id, 10) : null;
    const m = month && month !== 'all' ? parseInt(month, 10) : null;
    const y = year && year !== 'all' ? parseInt(year, 10) : null;

    // 1. Filtered Aggregates
    const [[totals]] = await db.query(`
      SELECT 
        COUNT(DISTINCT b.building_id) AS total_buildings,
        COUNT(DISTINCT d.department_id) AS total_departments,
        COUNT(DISTINCT u.user_id) AS total_users,
        COALESCE(SUM(mu.electricity_kwh), 0) AS total_electricity_kwh,
        COALESCE(SUM(mu.water_liters), 0) AS total_water_liters,
        COALESCE(SUM(mu.waste_kg), 0) AS total_waste_kg,
        COALESCE(SUM(mu.total_co2_kg), 0) AS total_co2_kg
      FROM departments d
      LEFT JOIN buildings b ON d.department_id = b.department_id
      LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
        AND (? IS NULL OR mu.month = ?)
        AND (? IS NULL OR mu.year = ?)
      LEFT JOIN users u ON u.role = 'student' AND u.department_id = d.department_id
      WHERE (? IS NULL OR d.department_id = ?)
    `, [m, m, y, y, deptId, deptId]);

    // 2. Alert Counts
    const [[alertStats]] = await db.query(`
      SELECT 
        COUNT(a.alert_id) AS total_alerts,
        SUM(CASE WHEN a.is_read = 0 THEN 1 ELSE 0 END) AS unread_alerts
      FROM alerts a
      INNER JOIN monthly_usage mu ON a.usage_id = mu.usage_id
      INNER JOIN buildings b ON mu.building_id = b.building_id
      WHERE (? IS NULL OR b.department_id = ?)
        AND (? IS NULL OR mu.month = ?)
        AND (? IS NULL OR mu.year = ?)
    `, [deptId, deptId, m, m, y, y]);

    // 3. Pending Activities Count
    const [[activityStats]] = await db.query(`
      SELECT COUNT(*) AS pending_activities 
      FROM student_activities sa
      INNER JOIN users u ON sa.student_id = u.user_id
      WHERE sa.status = 'pending'
        AND (? IS NULL OR u.department_id = ?)
    `, [deptId, deptId]);

    // 4. Monthly Trend for Chart.js
    let trendQuery = `
      SELECT 
        mu.year, 
        mu.month, 
        ROUND(SUM(mu.electricity_kwh), 2) AS electricity,
        ROUND(SUM(mu.water_liters), 2) AS water,
        ROUND(SUM(mu.waste_kg), 2) AS waste,
        ROUND(SUM(mu.total_co2_kg), 2) AS co2
      FROM monthly_usage mu
      INNER JOIN buildings b ON mu.building_id = b.building_id
      WHERE 1=1
    `;
    const trendParams = [];
    if (deptId) {
      trendQuery += ` AND b.department_id = ?`;
      trendParams.push(deptId);
    }
    if (y) {
      trendQuery += ` AND mu.year = ?`;
      trendParams.push(y);
    }
    trendQuery += ` GROUP BY mu.year, mu.month ORDER BY mu.year ASC, mu.month ASC`;

    const [monthlyTrends] = await db.query(trendQuery, trendParams);

    return res.json({
      success: true,
      data: {
        totals,
        alerts: alertStats,
        pendingActivities: activityStats.pending_activities || 0,
        monthlyTrends,
        filter: { department_id: deptId, month: m, year: y }
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// DEPARTMENTS CRUD
// =============================================================================
router.get('/departments', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.department_id, 
        d.department_name, 
        d.department_code,
        COUNT(DISTINCT b.building_id) AS building_count,
        COALESCE(SUM(mu.total_co2_kg), 0) AS total_co2_kg
      FROM departments d
      LEFT JOIN buildings b ON d.department_id = b.department_id
      LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
      GROUP BY d.department_id, d.department_name, d.department_code
      ORDER BY d.department_id ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { department_name, department_code } = req.body;
    if (!department_name || !department_code) {
      return res.status(400).json({ success: false, error: 'Department name and code are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO departments (department_name, department_code) VALUES (?, ?)`,
      [department_name.trim(), department_code.trim().toUpperCase()]
    );
    return res.json({ success: true, message: 'Department created successfully.', id: result.insertId });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/departments/:id', async (req, res) => {
  try {
    const { department_name, department_code } = req.body;
    const { id } = req.params;

    await db.query(
      `UPDATE departments SET department_name = ?, department_code = ? WHERE department_id = ?`,
      [department_name.trim(), department_code.trim().toUpperCase(), id]
    );
    return res.json({ success: true, message: 'Department updated successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM departments WHERE department_id = ?`, [id]);
    return res.json({ success: true, message: 'Department deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// BUILDINGS CRUD
// =============================================================================
router.get('/buildings', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.building_id, 
        b.building_name, 
        b.department_id,
        d.department_name, 
        d.department_code,
        COUNT(mu.usage_id) AS record_count,
        COALESCE(SUM(mu.total_co2_kg), 0) AS total_co2_kg
      FROM buildings b
      INNER JOIN departments d ON b.department_id = d.department_id
      LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
      GROUP BY b.building_id, b.building_name, b.department_id, d.department_name, d.department_code
      ORDER BY b.building_id ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/buildings', async (req, res) => {
  try {
    const { building_name, department_id } = req.body;
    if (!building_name || !department_id) {
      return res.status(400).json({ success: false, error: 'Building name and department are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO buildings (building_name, department_id) VALUES (?, ?)`,
      [building_name.trim(), department_id]
    );
    return res.json({ success: true, message: 'Building created successfully.', id: result.insertId });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/buildings/:id', async (req, res) => {
  try {
    const { building_name, department_id } = req.body;
    const { id } = req.params;

    await db.query(
      `UPDATE buildings SET building_name = ?, department_id = ? WHERE building_id = ?`,
      [building_name.trim(), department_id, id]
    );
    return res.json({ success: true, message: 'Building updated successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/buildings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM buildings WHERE building_id = ?`, [id]);
    return res.json({ success: true, message: 'Building deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// USERS CRUD
// =============================================================================
router.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        u.user_id, 
        u.full_name, 
        u.email, 
        u.role, 
        u.department_id,
        d.department_name,
        d.department_code,
        u.created_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.department_id
      ORDER BY u.role ASC, u.full_name ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { full_name, email, password, role, department_id } = req.body;
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Full name, email, password, and role are required.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const deptId = (role === 'admin' || !department_id) ? null : department_id;

    const [result] = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?)`,
      [full_name.trim(), email.trim().toLowerCase(), passwordHash, role, deptId]
    );

    return res.json({ success: true, message: 'User created successfully.', id: result.insertId });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { full_name, email, password, role, department_id } = req.body;
    const { id } = req.params;
    const deptId = (role === 'admin' || !department_id) ? null : department_id;

    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query(
        `UPDATE users SET full_name = ?, email = ?, password_hash = ?, role = ?, department_id = ? WHERE user_id = ?`,
        [full_name.trim(), email.trim().toLowerCase(), passwordHash, role, deptId, id]
      );
    } else {
      await db.query(
        `UPDATE users SET full_name = ?, email = ?, role = ?, department_id = ? WHERE user_id = ?`,
        [full_name.trim(), email.trim().toLowerCase(), role, deptId, id]
      );
    }

    return res.json({ success: true, message: 'User updated successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent admin deleting themselves
    if (parseInt(id, 10) === req.session.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own admin account.' });
    }
    await db.query(`DELETE FROM users WHERE user_id = ?`, [id]);
    return res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// MONTHLY USAGE CRUD (Triggers auto-calculate CO2 & generate alerts)
// =============================================================================
router.get('/usage', async (req, res) => {
  try {
    const { month, year, department_id, building_id } = req.query;
    let query = `
      SELECT 
        mu.usage_id,
        mu.building_id,
        b.building_name,
        d.department_id,
        d.department_name,
        d.department_code,
        mu.month,
        mu.year,
        mu.electricity_kwh,
        mu.water_liters,
        mu.waste_kg,
        mu.total_co2_kg,
        (SELECT COUNT(*) FROM alerts a WHERE a.usage_id = mu.usage_id) AS alerts_count
      FROM monthly_usage mu
      INNER JOIN buildings b ON mu.building_id = b.building_id
      INNER JOIN departments d ON b.department_id = d.department_id
      WHERE 1=1
    `;
    const params = [];

    if (month) {
      query += ` AND mu.month = ?`;
      params.push(month);
    }
    if (year) {
      query += ` AND mu.year = ?`;
      params.push(year);
    }
    if (department_id) {
      query += ` AND d.department_id = ?`;
      params.push(department_id);
    }
    if (building_id) {
      query += ` AND mu.building_id = ?`;
      params.push(building_id);
    }

    query += ` ORDER BY mu.year DESC, mu.month DESC, mu.total_co2_kg DESC`;

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/usage', async (req, res) => {
  try {
    const { building_id, month, year, electricity_kwh, water_liters, waste_kg } = req.body;

    if (!building_id || !month || !year) {
      return res.status(400).json({ success: false, error: 'Building, month, and year are required.' });
    }

    // Insert usage with total_co2_kg = 0; trg_usage_calc_co2_insert will calculate it!
    const [result] = await db.query(
      `INSERT INTO monthly_usage (building_id, month, year, electricity_kwh, water_liters, waste_kg)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        building_id,
        parseInt(month, 10),
        parseInt(year, 10),
        parseFloat(electricity_kwh || 0),
        parseFloat(water_liters || 0),
        parseFloat(waste_kg || 0)
      ]
    );

    // Retrieve inserted row to show calculated total_co2_kg
    const [[insertedRow]] = await db.query(
      `SELECT usage_id, total_co2_kg FROM monthly_usage WHERE usage_id = ?`,
      [result.insertId]
    );

    // Check if alerts were fired
    const [newAlerts] = await db.query(
      `SELECT alert_id, message FROM alerts WHERE usage_id = ?`,
      [result.insertId]
    );

    return res.json({
      success: true,
      message: 'Monthly usage record added successfully. CO2 auto-calculated by database trigger.',
      data: insertedRow,
      alertsTriggered: newAlerts
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'A usage record already exists for this building, month, and year.'
      });
    }
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/usage/:id', async (req, res) => {
  try {
    const { electricity_kwh, water_liters, waste_kg } = req.body;
    const { id } = req.params;

    // Trigger trg_usage_calc_co2_update will automatically update total_co2_kg
    await db.query(
      `UPDATE monthly_usage 
       SET electricity_kwh = ?, water_liters = ?, waste_kg = ?
       WHERE usage_id = ?`,
      [
        parseFloat(electricity_kwh || 0),
        parseFloat(water_liters || 0),
        parseFloat(waste_kg || 0),
        id
      ]
    );

    const [[updatedRow]] = await db.query(
      `SELECT usage_id, total_co2_kg FROM monthly_usage WHERE usage_id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Monthly usage updated successfully. CO2 recalculated by database trigger.',
      data: updatedRow
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/usage/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM monthly_usage WHERE usage_id = ?`, [id]);
    return res.json({ success: true, message: 'Monthly usage record deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// EMISSION FACTORS & USAGE LIMITS
// =============================================================================
router.get('/emission-factors', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM emission_factors ORDER BY factor_id ASC`);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/emission-factors/:id', async (req, res) => {
  try {
    const { kg_co2_per_unit } = req.body;
    const { id } = req.params;

    await db.query(
      `UPDATE emission_factors SET kg_co2_per_unit = ? WHERE factor_id = ?`,
      [parseFloat(kg_co2_per_unit), id]
    );
    return res.json({ success: true, message: 'Emission factor updated successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/usage-limits', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM usage_limits ORDER BY limit_id ASC`);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/usage-limits/:id', async (req, res) => {
  try {
    const { max_monthly_value } = req.body;
    const { id } = req.params;

    await db.query(
      `UPDATE usage_limits SET max_monthly_value = ? WHERE limit_id = ?`,
      [parseFloat(max_monthly_value), id]
    );
    return res.json({ success: true, message: 'Usage limit updated successfully.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ALERTS (Supports Department, Month, Year Filters)
// =============================================================================
router.get('/alerts', async (req, res) => {
  try {
    const { department_id, month, year } = req.query;
    let query = `
      SELECT 
        a.alert_id,
        a.usage_id,
        a.resource_type,
        a.message,
        a.is_read,
        a.created_at,
        b.building_name,
        d.department_id,
        d.department_name,
        d.department_code,
        mu.month,
        mu.year,
        mu.electricity_kwh,
        mu.water_liters,
        mu.waste_kg,
        mu.total_co2_kg
      FROM alerts a
      INNER JOIN monthly_usage mu ON a.usage_id = mu.usage_id
      INNER JOIN buildings b ON mu.building_id = b.building_id
      INNER JOIN departments d ON b.department_id = d.department_id
      WHERE 1=1
    `;
    const params = [];
    if (department_id && department_id !== 'all') {
      query += ` AND d.department_id = ?`;
      params.push(department_id);
    }
    if (month && month !== 'all') {
      query += ` AND mu.month = ?`;
      params.push(month);
    }
    if (year && year !== 'all') {
      query += ` AND mu.year = ?`;
      params.push(year);
    }
    query += ` ORDER BY a.created_at DESC`;
    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/alerts/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE alerts SET is_read = NOT is_read WHERE alert_id = ?`, [id]);
    return res.json({ success: true, message: 'Alert status toggled.' });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// STUDENT ACTIVITIES MODERATION
// =============================================================================
router.get('/activities', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT 
        sa.log_id,
        sa.student_id,
        u.full_name AS student_name,
        u.email AS student_email,
        d.department_name,
        d.department_code,
        eat.activity_name,
        eat.points,
        sa.activity_date,
        sa.description,
        sa.status,
        sa.reviewed_at,
        reviewer.full_name AS reviewer_name
      FROM student_activities sa
      INNER JOIN users u ON sa.student_id = u.user_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      INNER JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
      LEFT JOIN users reviewer ON sa.reviewed_by = reviewer.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND sa.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY sa.activity_date DESC, sa.log_id DESC`;

    const [rows] = await db.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/activities/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status provided.' });
    }

    await db.query(
      `UPDATE student_activities 
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
       WHERE log_id = ?`,
      [status, req.session.user.id, id]
    );

    return res.json({ success: true, message: `Activity marked as ${status}.` });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// STORED PROCEDURE EXECUTION: Campus-Wide / Department Monthly Report
// =============================================================================
router.get('/reports/monthly', async (req, res) => {
  try {
    const month = parseInt(req.query.month || '6', 10);
    const year = parseInt(req.query.year || '2026', 10);
    const department_id = req.query.department_id && req.query.department_id !== 'all' ? parseInt(req.query.department_id, 10) : null;

    if (department_id) {
      // Execute sp_department_report for specific department
      const [results] = await db.query(`CALL sp_department_report(?, ?, ?)`, [department_id, month, year]);
      return res.json({
        success: true,
        data: results[0] || [],
        isDepartmentScoped: true,
        params: { month, year, department_id }
      });
    }

    // Call stored procedure sp_monthly_report for entire campus
    const [results] = await db.query(`CALL sp_monthly_report(?, ?)`, [month, year]);
    const reportData = results[0] || [];

    return res.json({
      success: true,
      data: reportData,
      isDepartmentScoped: false,
      params: { month, year, department_id: null }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
