-- =============================================================================
-- CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker
-- Course: CS-2104 Database Systems
-- Seed Data: DUET (Dawood University of Engineering & Technology) Sample Dataset
-- Realistic Pakistani context, 6 months usage, alert-triggering thresholds
-- =============================================================================

USE carbonlens_db;

-- -----------------------------------------------------------------------------
-- 1. DEPARTMENTS
-- -----------------------------------------------------------------------------
INSERT INTO departments (department_id, department_name, department_code) VALUES
(1, 'Computer Science', 'CS'),
(2, 'Electrical Engineering', 'EE'),
(3, 'Civil Engineering', 'CE'),
(4, 'Mechanical Engineering', 'ME'),
(5, 'Software Engineering', 'SE'),
(6, 'Administration & Campus Facilities', 'ADM');

-- -----------------------------------------------------------------------------
-- 2. BUILDINGS (12 DUET Buildings mapped to departments)
-- -----------------------------------------------------------------------------
INSERT INTO buildings (building_id, building_name, department_id) VALUES
(1, 'Main Academic Block', 1),
(2, 'CS Lab Block', 1),
(3, 'Electrical Workshop', 2),
(4, 'Civil Materials Lab', 3),
(5, 'Mechanical Workshop', 4),
(6, 'Software Engineering Block', 5),
(7, 'Admin Building', 6),
(8, 'Central Library', 6),
(9, 'Student Cafeteria', 6),
(10, 'Boys Hostel', 6),
(11, 'Girls Hostel', 6),
(12, 'Mosque Block', 6);

-- -----------------------------------------------------------------------------
-- 3. USERS (1 Admin, 6 Chairpersons, 20 Students)
-- Passwords:
-- Admin:       admin123   ($2b$10$ZNEESQHkjsAvTIYkwbFhLOBZvouMcbgTEcQGzlAhAmtNdJMdQGtSi)
-- Chairpersons: chair123  ($2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC)
-- Students:    student123 ($2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2)
-- -----------------------------------------------------------------------------
INSERT INTO users (user_id, full_name, email, password_hash, role, department_id) VALUES
-- Administrator
(1, 'Muhammad Tariq Siddiqui', 'admin@carbonlens.com', '$2b$10$ZNEESQHkjsAvTIYkwbFhLOBZvouMcbgTEcQGzlAhAmtNdJMdQGtSi', 'admin', NULL),

-- 6 Chairpersons
(2, 'Dr. Farhan Ahmed Khan', 'chair.cs@carbonlens.com', '$2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC', 'chairperson', 1),
(3, 'Engr. Saira Naseem', 'chair.ee@carbonlens.com', '$2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC', 'chairperson', 2),
(4, 'Dr. Imran Hussain Shaikh', 'chair.ce@carbonlens.com', '$2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC', 'chairperson', 3),
(5, 'Prof. Nadia Qureshi', 'chair.me@carbonlens.com', '$2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC', 'chairperson', 4),
(6, 'Dr. Kashif Mehmood', 'chair.se@carbonlens.com', '$2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC', 'chairperson', 5),
(7, 'Mr. Rashid Ali Memon', 'chair.adm@carbonlens.com', '$2b$10$H/Ij9XOKrFy1XaNElM6Yqu6KDJO3PTgi9tE/hz4pIjKoBuUEt6dzC', 'chairperson', 6),

-- 20 Students
(8,  'Ali Raza', 'ali.raza@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 1),
(9,  'Ayesha Siddiqui', 'ayesha.siddiqui@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 1),
(10, 'Hamza Sheikh', 'hamza.sheikh@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 1),
(11, 'Fatima Noor', 'fatima.noor@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 1),
(12, 'Usman Ghani', 'usman.ghani@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 2),
(13, 'Zainab Malik', 'zainab.malik@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 2),
(14, 'Bilal Ahmed', 'bilal.ahmed@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 2),
(15, 'Hira Khan', 'hira.khan@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 3),
(16, 'Daniyal Memon', 'daniyal.memon@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 3),
(17, 'Maryam Iqbal', 'maryam.iqbal@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 3),
(18, 'Saad Qureshi', 'saad.qureshi@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 4),
(19, 'Areeba Fatima', 'areeba.fatima@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 4),
(20, 'Hassan Abbasi', 'hassan.abbasi@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 4),
(21, 'Sana Javed', 'sana.javed@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 5),
(22, 'Ahsan Ali', 'ahsan.ali@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 5),
(23, 'Iqra Shahid', 'iqra.shahid@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 5),
(24, 'Talha Mirza', 'talha.mirza@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 6),
(25, 'Mahnoor Baig', 'mahnoor.baig@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 6),
(26, 'Owais Rehman', 'owais.rehman@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 1),
(27, 'Laiba Hussain', 'laiba.hussain@carbonlens.com', '$2b$10$dZ68/pazVR/18S/sHc02QOGzk9U5uRpXIZpo9Ymy9P7h7VrTuUkk2', 'student', 5);

-- -----------------------------------------------------------------------------
-- 4. EMISSION FACTORS
-- Standard scientific greenhouse gas emission equivalents:
-- Electricity: 0.45 kg CO2 per kWh (Pakistani thermal grid mix average)
-- Water: 0.0003 kg CO2 per liter (water pumping, treatment and distribution)
-- Waste: 0.50 kg CO2 per kg (municipal solid waste breakdown)
-- -----------------------------------------------------------------------------
INSERT INTO emission_factors (factor_id, resource_type, unit, kg_co2_per_unit) VALUES
(1, 'electricity', 'kWh', 0.4500),
(2, 'water', 'Liters', 0.0003),
(3, 'waste', 'kg', 0.5000);

-- -----------------------------------------------------------------------------
-- 5. USAGE LIMITS
-- Thresholds above which automated alert triggers fire:
-- -----------------------------------------------------------------------------
INSERT INTO usage_limits (limit_id, resource_type, max_monthly_value) VALUES
(1, 'electricity', 15000.00),
(2, 'water', 80000.00),
(3, 'waste', 2500.00);

-- -----------------------------------------------------------------------------
-- 6. MONTHLY USAGE (6 Months: May 2026 to Oct 2026 for all 12 Buildings)
-- Note: total_co2_kg is omitted/0.00 so trg_usage_calc_co2_insert calculates it.
-- Several records intentionally exceed limits to trigger alerts:
--   - Bldg 1 (Main Academic) in June: electricity 16850 kWh > 15000 limit
--   - Bldg 10 (Boys Hostel) in July: water 92500 L > 80000 limit
--   - Bldg 9 (Cafeteria) in August: waste 2850 kg > 2500 limit
--   - Bldg 11 (Girls Hostel) in July: water 84000 L > 80000 limit
-- -----------------------------------------------------------------------------
INSERT INTO monthly_usage (building_id, month, year, electricity_kwh, water_liters, waste_kg) VALUES
-- MAY 2026 (Month 5)
(1,  5, 2026, 11200.00, 32000.00, 1100.00),
(2,  5, 2026, 9400.00,  18000.00, 650.00),
(3,  5, 2026, 8100.00,  14000.00, 780.00),
(4,  5, 2026, 7500.00,  16000.00, 890.00),
(5,  5, 2026, 9200.00,  15000.00, 950.00),
(6,  5, 2026, 8800.00,  17000.00, 600.00),
(7,  5, 2026, 6800.00,  21000.00, 520.00),
(8,  5, 2026, 5900.00,  13000.00, 410.00),
(9,  5, 2026, 7200.00,  45000.00, 2100.00),
(10, 5, 2026, 12500.00, 72000.00, 1800.00),
(11, 5, 2026, 11800.00, 68000.00, 1600.00),
(12, 5, 2026, 2100.00,  28000.00, 210.00),

-- JUNE 2026 (Month 6 - Peak Karachi Summer)
-- [ALERT TARGET] Building 1 electricity = 16850.00 > 15000.00 limit
(1,  6, 2026, 16850.00, 35000.00, 1250.00),
(2,  6, 2026, 13400.00, 19500.00, 700.00),
(3,  6, 2026, 9900.00,  15000.00, 810.00),
(4,  6, 2026, 8800.00,  17500.00, 920.00),
(5,  6, 2026, 11200.00, 16000.00, 990.00),
(6,  6, 2026, 12100.00, 18500.00, 640.00),
(7,  6, 2026, 8900.00,  23000.00, 560.00),
(8,  6, 2026, 8200.00,  14500.00, 440.00),
(9,  6, 2026, 8500.00,  48000.00, 2350.00),
(10, 6, 2026, 14200.00, 78500.00, 1950.00),
(11, 6, 2026, 13600.00, 75000.00, 1750.00),
(12, 6, 2026, 2800.00,  31000.00, 230.00),

-- JULY 2026 (Month 7 - Monsoon & Peak Heat)
-- [ALERT TARGET] Building 10 water = 92500.00 > 80000.00 limit
-- [ALERT TARGET] Building 11 water = 84000.00 > 80000.00 limit
(1,  7, 2026, 15800.00, 38000.00, 1180.00),
(2,  7, 2026, 12900.00, 21000.00, 680.00),
(3,  7, 2026, 9400.00,  15500.00, 790.00),
(4,  7, 2026, 8500.00,  18000.00, 900.00),
(5,  7, 2026, 10800.00, 16500.00, 960.00),
(6,  7, 2026, 11500.00, 19000.00, 620.00),
(7,  7, 2026, 8400.00,  24000.00, 540.00),
(8,  7, 2026, 7800.00,  15000.00, 430.00),
(9,  7, 2026, 8100.00,  49500.00, 2400.00),
(10, 7, 2026, 14800.00, 92500.00, 1900.00),
(11, 7, 2026, 13900.00, 84000.00, 1700.00),
(12, 7, 2026, 2600.00,  32000.00, 220.00),

-- AUGUST 2026 (Month 8 - Independence Day Events & Campus Sessions)
-- [ALERT TARGET] Building 9 waste = 2850.00 > 2500.00 limit
(1,  8, 2026, 14900.00, 36000.00, 1300.00),
(2,  8, 2026, 11800.00, 20000.00, 710.00),
(3,  8, 2026, 8900.00,  14800.00, 820.00),
(4,  8, 2026, 8100.00,  17000.00, 910.00),
(5,  8, 2026, 10200.00, 15800.00, 970.00),
(6,  8, 2026, 10900.00, 18200.00, 630.00),
(7,  8, 2026, 7900.00,  22500.00, 530.00),
(8,  8, 2026, 7100.00,  14200.00, 420.00),
(9,  8, 2026, 8900.00,  52000.00, 2850.00),
(10, 8, 2026, 13800.00, 79000.00, 1850.00),
(11, 8, 2026, 13100.00, 76000.00, 1680.00),
(12, 8, 2026, 2400.00,  29000.00, 215.00),

-- SEPTEMBER 2026 (Month 9 - Regular Semester Classes)
(1,  9, 2026, 12500.00, 33000.00, 1150.00),
(2,  9, 2026, 10200.00, 18500.00, 660.00),
(3,  9, 2026, 8300.00,  14200.00, 790.00),
(4,  9, 2026, 7800.00,  16400.00, 890.00),
(5,  9, 2026, 9500.00,  15200.00, 940.00),
(6,  9, 2026, 9800.00,  17500.00, 610.00),
(7,  9, 2026, 7100.00,  21500.00, 510.00),
(8,  9, 2026, 6400.00,  13500.00, 410.00),
(9,  9, 2026, 7600.00,  46000.00, 2180.00),
(10, 9, 2026, 12900.00, 73500.00, 1810.00),
(11, 9, 2026, 12200.00, 69500.00, 1620.00),
(12, 9, 2026, 2200.00,  28500.00, 205.00),

-- OCTOBER 2026 (Month 10 - Mild Weather, Autumn)
(1,  10, 2026, 9800.00,  30000.00, 1050.00),
(2,  10, 2026, 8500.00,  17000.00, 620.00),
(3,  10, 2026, 7200.00,  13500.00, 750.00),
(4,  10, 2026, 6900.00,  15500.00, 850.00),
(5,  10, 2026, 8400.00,  14500.00, 910.00),
(6,  10, 2026, 8100.00,  16200.00, 580.00),
(7,  10, 2026, 6200.00,  20000.00, 480.00),
(8,  10, 2026, 5400.00,  12800.00, 390.00),
(9,  10, 2026, 6800.00,  43000.00, 1980.00),
(10, 10, 2026, 11400.00, 68000.00, 1720.00),
(11, 10, 2026, 10800.00, 64000.00, 1550.00),
(12, 10, 2026, 1900.00,  27000.00, 190.00);

-- -----------------------------------------------------------------------------
-- 7. ECO ACTIVITY TYPES
-- -----------------------------------------------------------------------------
INSERT INTO eco_activity_types (activity_type_id, activity_name, points) VALUES
(1, 'Plant a tree', 20),
(2, 'Cycle or walk to campus', 10),
(3, 'Carpool to university', 10),
(4, 'Recycling drive participation', 15),
(5, 'Switch off lights/ACs campaign', 15),
(6, 'Reusable bottle/bag use', 5),
(7, 'Waste segregation volunteer', 15);

-- -----------------------------------------------------------------------------
-- 8. STUDENT ACTIVITIES (Sample logs with mixed statuses)
-- Evaluated against eco_activity_types and reviewed by chairpersons / admin
-- -----------------------------------------------------------------------------
INSERT INTO student_activities (student_id, activity_type_id, activity_date, description, status, reviewed_by, reviewed_at) VALUES
-- Student 8: Ali Raza (CS) - Active Green Champion
(8, 1, '2026-05-12', 'Planted Neem tree sapling outside DUET CS Lab Block', 'approved', 2, '2026-05-13 10:00:00'),
(8, 2, '2026-06-04', 'Cycled to university from Gulshan-e-Iqbal', 'approved', 2, '2026-06-05 11:30:00'),
(8, 4, '2026-08-18', 'Organized e-waste collection booth at CS block', 'approved', 2, '2026-08-19 14:00:00'),
(8, 5, '2026-09-22', 'Monitored lab computers and switched off 30 idle systems', 'approved', 2, '2026-09-23 09:15:00'),
(8, 7, '2026-10-15', 'Helped cafeteria staff set up organic waste bins', 'pending', NULL, NULL),

-- Student 9: Ayesha Siddiqui (CS)
(9, 1, '2026-05-15', 'Planted bougainvillea near academic courtyard', 'approved', 2, '2026-05-16 12:00:00'),
(9, 6, '2026-07-02', 'Carried reusable water bottle and cloth lunch bag for 2 weeks', 'approved', 2, '2026-07-03 15:40:00'),
(9, 3, '2026-08-25', 'Carpool with 3 fellow CS classmates from North Nazimabad', 'approved', 2, '2026-08-26 10:20:00'),
(9, 5, '2026-10-08', 'Audited floor 2 lights in CS building during daylight hours', 'approved', 2, '2026-10-09 11:00:00'),

-- Student 10: Hamza Sheikh (CS)
(10, 2, '2026-06-11', 'Walked from university bus stop to main gate instead of rickshaw', 'approved', 2, '2026-06-12 16:10:00'),
(10, 4, '2026-09-05', 'Submitted 15 used plastic bottles for recycling drive', 'approved', 2, '2026-09-06 09:45:00'),
(10, 1, '2026-10-20', 'Planting rose bushes behind CS lab', 'pending', NULL, NULL),

-- Student 11: Fatima Noor (CS)
(11, 3, '2026-05-20', 'Van-pooling arrangement with 5 students from PECHS', 'approved', 2, '2026-05-21 14:15:00'),
(11, 7, '2026-07-14', 'Segregated paper waste in CS faculty office', 'approved', 2, '2026-07-15 13:30:00'),
(11, 6, '2026-09-19', 'Used steel straw and lunch flask consistently', 'rejected', 2, '2026-09-20 10:00:00'),

-- Student 12: Usman Ghani (EE)
(12, 1, '2026-05-18', 'Planted Gulmohar tree beside Electrical workshop', 'approved', 3, '2026-05-19 11:00:00'),
(12, 5, '2026-06-25', 'Switched off transformer test bench standby loads', 'approved', 3, '2026-06-26 12:20:00'),
(12, 4, '2026-08-10', 'Collected scrap copper and steel wires for university recycler', 'approved', 3, '2026-08-11 15:00:00'),
(12, 2, '2026-10-12', 'Cycled from Bahadurabad to campus', 'pending', NULL, NULL),

-- Student 13: Zainab Malik (EE)
(13, 6, '2026-06-18', 'Advocated paperless lab reports in circuit analysis course', 'approved', 3, '2026-06-19 14:00:00'),
(13, 3, '2026-08-05', 'Shared hybrid car ride with EE batchmates', 'approved', 3, '2026-08-06 10:15:00'),
(13, 5, '2026-09-28', 'Put up stickers reminding students to switch off workshop fans', 'approved', 3, '2026-09-29 16:30:00'),

-- Student 14: Bilal Ahmed (EE)
(14, 2, '2026-07-19', 'Rode bicycle to campus', 'approved', 3, '2026-07-20 11:45:00'),
(14, 7, '2026-09-12', 'Assisted in battery disposal protocol for electronics lab', 'approved', 3, '2026-09-13 13:20:00'),

-- Student 15: Hira Khan (CE)
(15, 1, '2026-05-22', 'Planted Ficus tree in Civil engineering lawn', 'approved', 4, '2026-05-23 10:50:00'),
(15, 4, '2026-07-08', 'Collected crushed concrete samples for eco-aggregate research', 'approved', 4, '2026-07-09 15:10:00'),
(15, 7, '2026-09-15', 'Volunteered for campus clean-up around Civil materials lab', 'approved', 4, '2026-09-16 11:30:00'),
(15, 6, '2026-10-14', 'Carried reusable water canteen', 'pending', NULL, NULL),

-- Student 16: Daniyal Memon (CE)
(16, 3, '2026-06-15', 'Shared ride from Malir Cantt to university', 'approved', 4, '2026-06-16 12:40:00'),
(16, 5, '2026-08-20', 'Installed daylight reflectors in materials testing lab', 'approved', 4, '2026-08-21 16:00:00'),
(16, 2, '2026-10-02', 'Walked 3 km to campus', 'approved', 4, '2026-10-03 10:10:00'),

-- Student 17: Maryam Iqbal (CE)
(17, 1, '2026-06-29', 'Planted 2 aloe vera plants in Civil garden', 'approved', 4, '2026-06-30 09:30:00'),
(17, 4, '2026-08-12', 'Participated in rainwater harvesting awareness drive', 'approved', 4, '2026-08-13 14:20:00'),

-- Student 18: Saad Qureshi (ME)
(18, 5, '2026-05-27', 'Calibrated pneumatic air lines to eliminate compressor air leaks', 'approved', 5, '2026-05-28 15:45:00'),
(18, 2, '2026-07-16', 'Cycled to university campus', 'approved', 5, '2026-07-17 11:20:00'),
(18, 1, '2026-09-08', 'Planted Peepal tree in workshop quadrangle', 'approved', 5, '2026-09-09 10:00:00'),

-- Student 19: Areeba Fatima (ME)
(19, 7, '2026-06-22', 'Collected and separated metal lathe turnings from workshop', 'approved', 5, '2026-06-23 13:15:00'),
(19, 6, '2026-08-19', 'Used eco-friendly cloth tote bag for workshop blueprints', 'approved', 5, '2026-08-20 12:00:00'),
(19, 4, '2026-10-18', 'Participated in engineering plastics recycling drive', 'pending', NULL, NULL),

-- Student 20: Hassan Abbasi (ME)
(20, 3, '2026-07-25', 'Arranged 4-person carpool from Federal B Area', 'approved', 5, '2026-07-26 14:50:00'),
(20, 5, '2026-09-14', 'Turned off CNC machine exhaust fans after practicals', 'approved', 5, '2026-09-15 16:10:00'),

-- Student 21: Sana Javed (SE) - Top Scorer
(21, 1, '2026-05-10', 'Planted Moringa tree sapling outside Software block', 'approved', 6, '2026-05-11 09:30:00'),
(21, 5, '2026-06-14', 'Created desktop wallpaper reminder for standby energy savings', 'approved', 6, '2026-06-15 11:00:00'),
(21, 4, '2026-07-28', 'Donated 10 outdated textbook sets to department library', 'approved', 6, '2026-07-29 13:40:00'),
(21, 2, '2026-09-02', 'Cycled to DUET every day during Green Week', 'approved', 6, '2026-09-03 10:15:00'),
(21, 7, '2026-10-05', 'Volunteered to sort carton boxes at server room delivery', 'approved', 6, '2026-10-06 15:30:00'),

-- Student 22: Ahsan Ali (SE)
(22, 2, '2026-06-03', 'Walked to campus from university gate', 'approved', 6, '2026-06-04 12:10:00'),
(22, 6, '2026-08-14', 'Switched from plastic disposable cups to personal mug', 'approved', 6, '2026-08-15 14:00:00'),
(22, 1, '2026-09-20', 'Planted decorative hedge plants near department stairs', 'approved', 6, '2026-09-21 11:30:00'),

-- Student 23: Iqra Shahid (SE)
(23, 3, '2026-07-09', 'Carpool with batchmates from Clifton', 'approved', 6, '2026-07-10 10:45:00'),
(23, 5, '2026-09-16', 'Conducted 10-minute briefing on screen brightness energy savings', 'approved', 6, '2026-09-17 12:00:00'),
(23, 4, '2026-10-22', 'Organized e-waste drive at SE Block', 'pending', NULL, NULL),

-- Student 24: Talha Mirza (ADM)
(24, 7, '2026-05-30', 'Assisted in cafeteria food waste composting collection', 'approved', 7, '2026-05-31 16:00:00'),
(24, 1, '2026-07-12', 'Planted shade tree near DUET Central Mosque', 'approved', 7, '2026-07-13 11:15:00'),
(24, 2, '2026-09-24', 'Walked to university from nearby student residence', 'approved', 7, '2026-09-25 09:40:00'),

-- Student 25: Mahnoor Baig (ADM)
(25, 6, '2026-06-20', 'Implemented reusable plate policy in student council meeting', 'approved', 7, '2026-06-21 14:20:00'),
(25, 4, '2026-08-28', 'Donated 50 reusable canvas bags to girls hostel residents', 'approved', 7, '2026-08-29 15:30:00'),
(25, 5, '2026-10-19', 'Hostel room electricity conservation challenge coordinator', 'pending', NULL, NULL),

-- Student 26: Owais Rehman (CS)
(26, 2, '2026-06-18', 'Cycled to university campus', 'approved', 2, '2026-06-19 10:30:00'),
(26, 6, '2026-08-02', 'Brought stainless steel lunchbox to lab sessions', 'approved', 2, '2026-08-03 12:15:00'),
(26, 1, '2026-09-11', 'Tree plantation campaign volunteer', 'rejected', 2, '2026-09-12 14:00:00'),

-- Student 27: Laiba Hussain (SE)
(27, 3, '2026-07-17', 'Carpool from Gulshan-e-Maymar to DUET', 'approved', 6, '2026-07-18 11:50:00'),
(27, 7, '2026-09-29', 'Volunteered in sorting paper recyclables in SE library corner', 'approved', 6, '2026-09-30 15:00:00'),
(27, 5, '2026-10-25', 'Turned off corridor lighting in SE block during bright sunny midday', 'pending', NULL, NULL);
