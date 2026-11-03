const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// All logged-in users (Admin, Chairperson, Student) can access leaderboards
router.use(requireLogin);

// GET /api/leaderboards/departments - View v_department_leaderboard
router.get('/departments', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        carbon_rank,
        department_id,
        department_name,
        department_code,
        total_buildings,
        total_electricity_kwh,
        total_water_liters,
        total_waste_kg,
        total_co2_kg
      FROM v_department_leaderboard
      ORDER BY carbon_rank ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Department leaderboard error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/leaderboards/students - View v_student_leaderboard
router.get('/students', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        student_rank,
        user_id,
        full_name,
        email,
        department_name,
        department_code,
        total_points,
        approved_activities_count
      FROM v_student_leaderboard
      ORDER BY student_rank ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Student leaderboard error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/leaderboards/buildings - View v_building_co2_summary
router.get('/buildings', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        building_id,
        building_name,
        department_name,
        department_code,
        recorded_months,
        total_electricity_kwh,
        total_water_liters,
        total_waste_kg,
        total_co2_kg,
        avg_monthly_co2_kg
      FROM v_building_co2_summary
      ORDER BY total_co2_kg DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Building leaderboard error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
