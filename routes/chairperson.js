const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Protect all chairperson routes
router.use(requireRole('chairperson'));

// =============================================================================
// CHAIRPERSON OVERVIEW & DEPARTMENT STATS (Scoped to Own Department Only)
// =============================================================================
router.get('/stats', async (req, res) => {
  try {
    // Strictly enforce chairperson's own department from session (ignore any client-provided department_id)
    const deptId = req.session.user.departmentId;
    const { month, year } = req.query;
    const m = month && month !== 'all' ? parseInt(month, 10) : null;
    const y = year && year !== 'all' ? parseInt(year, 10) : null;

    if (!deptId) {
      return res.status(400).json({ success: false, error: 'No department assigned to this chairperson account.' });
    }

    // 1. Department Information & Totals
    const [[deptTotals]] = await db.query(`
      SELECT 
        d.department_id,
        d.department_name,
        d.department_code,
        COUNT(DISTINCT b.building_id) AS total_buildings,
        COALESCE(SUM(mu.electricity_kwh), 0) AS total_electricity_kwh,
        COALESCE(SUM(mu.water_liters), 0) AS total_water_liters,
        COALESCE(SUM(mu.waste_kg), 0) AS total_waste_kg,
        COALESCE(SUM(mu.total_co2_kg), 0) AS total_co2_kg
      FROM departments d
      LEFT JOIN buildings b ON d.department_id = b.department_id
      LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
        AND (? IS NULL OR mu.month = ?)
        AND (? IS NULL OR mu.year = ?)
      WHERE d.department_id = ?
      GROUP BY d.department_id, d.department_name, d.department_code
    `, [m, m, y, y, deptId]);

    // 2. Department Alerts Count
    const [[alertStats]] = await db.query(`
      SELECT 
        COUNT(a.alert_id) AS total_alerts,
        SUM(CASE WHEN a.is_read = 0 THEN 1 ELSE 0 END) AS unread_alerts
      FROM alerts a
      INNER JOIN monthly_usage mu ON a.usage_id = mu.usage_id
      INNER JOIN buildings b ON mu.building_id = b.building_id
      WHERE b.department_id = ?
        AND (? IS NULL OR mu.month = ?)
        AND (? IS NULL OR mu.year = ?)
    `, [deptId, m, m, y, y]);

    // 3. Department Pending Activities
    const [[pendingStats]] = await db.query(`
      SELECT COUNT(sa.log_id) AS pending_activities
      FROM student_activities sa
      INNER JOIN users u ON sa.student_id = u.user_id
      WHERE u.department_id = ? AND sa.status = 'pending'
    `, [deptId]);

    // 4. Department Monthly Trends for Chart.js
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
      WHERE b.department_id = ?
    `;
    const trendParams = [deptId];
    if (y) {
      trendQuery += ` AND mu.year = ?`;
      trendParams.push(y);
    }
    trendQuery += ` GROUP BY mu.year, mu.month ORDER BY mu.year ASC, mu.month ASC`;

    const [monthlyTrends] = await db.query(trendQuery, trendParams);

    return res.json({
      success: true,
      data: {
        department: deptTotals || {
          department_id: deptId,
          department_name: req.session.user.departmentName,
          total_buildings: 0,
          total_electricity_kwh: 0,
          total_water_liters: 0,
          total_waste_kg: 0,
          total_co2_kg: 0
        },
        alerts: alertStats,
        pendingActivities: pendingStats.pending_activities || 0,
        monthlyTrends,
        filter: { department_id: deptId, month: m, year: y }
      }
    });
  } catch (error) {
    console.error('Chairperson stats error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// DEPARTMENT MONTHLY USAGE (Read-only for own department)
// =============================================================================
router.get('/usage', async (req, res) => {
  try {
    const deptId = req.session.user.departmentId;
    const { month, year, building_id } = req.query;

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
      WHERE d.department_id = ?
    `;
    const params = [deptId];

    if (month && month !== 'all') {
      query += ` AND mu.month = ?`;
      params.push(month);
    }
    if (year && year !== 'all') {
      query += ` AND mu.year = ?`;
      params.push(year);
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

// =============================================================================
// DEPARTMENT BUILDINGS & USAGE (Read-only)
// =============================================================================
router.get('/buildings', async (req, res) => {
  try {
    const deptId = req.session.user.departmentId;
    const [rows] = await db.query(`
      SELECT 
        b.building_id,
        b.building_name,
        d.department_name,
        COUNT(mu.usage_id) AS total_records,
        COALESCE(SUM(mu.electricity_kwh), 0) AS total_electricity_kwh,
        COALESCE(SUM(mu.water_liters), 0) AS total_water_liters,
        COALESCE(SUM(mu.waste_kg), 0) AS total_waste_kg,
        COALESCE(SUM(mu.total_co2_kg), 0) AS total_co2_kg
      FROM buildings b
      INNER JOIN departments d ON b.department_id = d.department_id
      LEFT JOIN monthly_usage mu ON b.building_id = mu.building_id
      WHERE b.department_id = ?
      GROUP BY b.building_id, b.building_name, d.department_name
      ORDER BY b.building_name ASC
    `, [deptId]);

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// DEPARTMENT ALERTS (Read-only for own department)
// =============================================================================
router.get('/alerts', async (req, res) => {
  try {
    const deptId = req.session.user.departmentId;
    const { month, year } = req.query;
    let query = `
      SELECT 
        a.alert_id,
        a.usage_id,
        a.resource_type,
        a.message,
        a.is_read,
        a.created_at,
        b.building_name,
        mu.month,
        mu.year,
        mu.electricity_kwh,
        mu.water_liters,
        mu.waste_kg,
        mu.total_co2_kg
      FROM alerts a
      INNER JOIN monthly_usage mu ON a.usage_id = mu.usage_id
      INNER JOIN buildings b ON mu.building_id = b.building_id
      WHERE b.department_id = ?
    `;
    const params = [deptId];
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

// =============================================================================
// STORED PROCEDURE: Department Building-wise Report (sp_department_report)
// =============================================================================
router.get('/report', async (req, res) => {
  try {
    const deptId = req.session.user.departmentId;
    const month = parseInt(req.query.month || '6', 10);
    const year = parseInt(req.query.year || '2026', 10);

    // Call stored procedure sp_department_report securely for this department
    const [results] = await db.query(`CALL sp_department_report(?, ?, ?)`, [deptId, month, year]);
    const reportData = results[0] || [];

    return res.json({
      success: true,
      data: reportData,
      params: { departmentId: deptId, month, year }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// MODERATE STUDENT ACTIVITIES (Own department students only)
// =============================================================================
router.get('/activities', async (req, res) => {
  try {
    const deptId = req.session.user.departmentId;
    const { status } = req.query;

    let query = `
      SELECT 
        sa.log_id,
        sa.student_id,
        u.full_name AS student_name,
        u.email AS student_email,
        eat.activity_name,
        eat.points,
        sa.activity_date,
        sa.description,
        sa.status,
        sa.reviewed_at,
        reviewer.full_name AS reviewer_name
      FROM student_activities sa
      INNER JOIN users u ON sa.student_id = u.user_id
      INNER JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
      LEFT JOIN users reviewer ON sa.reviewed_by = reviewer.user_id
      WHERE u.department_id = ?
    `;
    const params = [deptId];

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
    const deptId = req.session.user.departmentId;
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status provided.' });
    }

    // Verify student belongs to this chairperson's department
    const [[activityRecord]] = await db.query(`
      SELECT sa.log_id, u.department_id
      FROM student_activities sa
      INNER JOIN users u ON sa.student_id = u.user_id
      WHERE sa.log_id = ?
    `, [id]);

    if (!activityRecord) {
      return res.status(404).json({ success: false, error: 'Activity not found.' });
    }

    if (activityRecord.department_id !== deptId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only approve/reject activities for students in your department.'
      });
    }

    await db.query(
      `UPDATE student_activities 
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP 
       WHERE log_id = ?`,
      [status, req.session.user.id, id]
    );

    return res.json({ success: true, message: `Activity status updated to ${status}.` });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
