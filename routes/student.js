const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Protect all student routes
router.use(requireRole('student'));

// =============================================================================
// STUDENT PROFILE & GREEN POINTS (Calls sp_student_points)
// =============================================================================
router.get('/profile', async (req, res) => {
  try {
    const studentId = req.session.user.id;

    // Call stored procedure sp_student_points
    const [results] = await db.query(`CALL sp_student_points(?)`, [studentId]);
    const studentData = results[0]?.[0] || {
      user_id: studentId,
      full_name: req.session.user.name,
      email: req.session.user.email,
      department_name: req.session.user.departmentName,
      total_green_points: 0,
      approved_count: 0,
      pending_count: 0,
      rejected_count: 0
    };

    // Calculate student rank from view v_student_leaderboard
    const [[rankRow]] = await db.query(
      `SELECT student_rank FROM v_student_leaderboard WHERE user_id = ?`,
      [studentId]
    );

    return res.json({
      success: true,
      data: {
        ...studentData,
        rank: rankRow ? rankRow.student_rank : 'N/A'
      }
    });
  } catch (error) {
    console.error('Student profile error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ECO ACTIVITY TYPES CATALOG (For dropdown options)
// =============================================================================
router.get('/activity-types', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT activity_type_id, activity_name, points FROM eco_activity_types ORDER BY points DESC, activity_name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// LOG NEW ECO-FRIENDLY ACTIVITY (Initial status is 'pending')
// =============================================================================
router.post('/activities', async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const { activity_type_id, activity_date, description } = req.body;

    if (!activity_type_id || !activity_date) {
      return res.status(400).json({
        success: false,
        error: 'Activity type and activity date are required.'
      });
    }

    const [result] = await db.query(
      `INSERT INTO student_activities (student_id, activity_type_id, activity_date, description, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [studentId, activity_type_id, activity_date, (description || '').trim()]
    );

    return res.json({
      success: true,
      message: 'Activity logged successfully! It is pending review by your department chairperson.',
      log_id: result.insertId
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =============================================================================
// STUDENT PERSONAL ACTIVITY HISTORY
// =============================================================================
router.get('/activities', async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const [rows] = await db.query(`
      SELECT 
        sa.log_id,
        eat.activity_name,
        eat.points,
        sa.activity_date,
        sa.description,
        sa.status,
        sa.reviewed_at,
        reviewer.full_name AS reviewer_name
      FROM student_activities sa
      INNER JOIN eco_activity_types eat ON sa.activity_type_id = eat.activity_type_id
      LEFT JOIN users reviewer ON sa.reviewed_by = reviewer.user_id
      WHERE sa.student_id = ?
      ORDER BY sa.activity_date DESC, sa.log_id DESC
    `, [studentId]);

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
