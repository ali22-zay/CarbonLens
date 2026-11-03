/**
 * Admin Dashboard Interactivity & AJAX Handlers
 * CarbonLens (CS-2104 Database Systems)
 */

let co2ChartInstance = null;
let resourceChartInstance = null;
let departmentsList = [];
let buildingsList = [];
let currentUsageData = [];
let currentReportData = [];

// Tab switching logic
function switchTab(tabId, clickedEl) {
  document.querySelectorAll('.tab-pane-custom').forEach(tab => tab.classList.add('d-none'));
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.remove('d-none');

  document.querySelectorAll('.nav-link-custom').forEach(link => link.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  // Trigger data reload for specific tabs
  if (tabId === 'tab-overview') loadAdminStats();
  if (tabId === 'tab-usage') loadUsageTable();
  if (tabId === 'tab-sp-report') runMonthlyReportSP();
  if (tabId === 'tab-departments') loadDepartmentsTable();
  if (tabId === 'tab-buildings') loadBuildingsTable();
  if (tabId === 'tab-users') loadUsersTable();
  if (tabId === 'tab-activities') loadActivitiesTable();
  if (tabId === 'tab-alerts') loadAlertsTable();
  if (tabId === 'tab-settings') loadSettings();
  if (tabId === 'tab-leaderboards') loadLeaderboards();
}

// =============================================================================
// GLOBAL FILTERS (Requirement 4)
// =============================================================================
function applyGlobalFilters() {
  const deptSelect = document.getElementById('global-filter-dept');
  const monthSelect = document.getElementById('global-filter-month');
  const yearSelect = document.getElementById('global-filter-year');

  const deptId = deptSelect.value;
  const month = monthSelect.value;
  const year = yearSelect.value;

  const deptText = deptSelect.options[deptSelect.selectedIndex]?.text || 'All Departments';
  const monthText = monthSelect.options[monthSelect.selectedIndex]?.text || 'All Months';
  const yearText = yearSelect.options[yearSelect.selectedIndex]?.text || 'All Years';

  const chip = document.getElementById('active-filter-chip');
  if (chip) {
    chip.innerHTML = `<i class="bi bi-funnel-fill text-success"></i> ${deptText} • ${monthText} • ${yearText}`;
  }

  const chartFilterTag = document.getElementById('chart-filter-tag');
  if (chartFilterTag) {
    chartFilterTag.textContent = `${deptText} (${yearText})`;
  }

  // Also sync the filters in usage tab if present
  const usageDept = document.getElementById('filter-usage-dept');
  const usageMonth = document.getElementById('filter-usage-month');
  const usageYear = document.getElementById('filter-usage-year');
  if (usageDept) usageDept.value = deptId === 'all' ? '' : deptId;
  if (usageMonth) usageMonth.value = month === 'all' ? '' : month;
  if (usageYear) usageYear.value = year === 'all' ? '' : year;

  // Sync with reports tab
  const spDept = document.getElementById('sp-report-dept');
  if (spDept && deptId) spDept.value = deptId;
  const spMonth = document.getElementById('sp-report-month');
  if (spMonth && month !== 'all') spMonth.value = month;

  loadAdminStats();
  loadUsageTable();
  loadAlertsTable();
}

function resetGlobalFilters() {
  document.getElementById('global-filter-dept').value = 'all';
  document.getElementById('global-filter-month').value = 'all';
  document.getElementById('global-filter-year').value = '2026';
  applyGlobalFilters();
}

// =============================================================================
// STATS & CHARTS (Requirement 2: Compact Numbers + Full Comma Tooltips)
// =============================================================================
async function loadAdminStats() {
  const deptSelect = document.getElementById('global-filter-dept');
  const monthSelect = document.getElementById('global-filter-month');
  const yearSelect = document.getElementById('global-filter-year');

  const deptId = deptSelect ? deptSelect.value : 'all';
  const month = monthSelect ? monthSelect.value : 'all';
  const year = yearSelect ? yearSelect.value : '2026';

  let url = `/api/admin/stats?department_id=${deptId}&month=${month}&year=${year}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    if (!result.success) return;

    const { totals, alerts, pendingActivities, monthlyTrends } = result.data;

    // Use formatCompact for values, full formatted with unit in title tooltip
    const elCo2 = document.getElementById('stat-total-co2');
    elCo2.textContent = formatCompact(totals.total_co2_kg);
    elCo2.title = `${formatNumber(totals.total_co2_kg)} kg CO₂`;

    const elElec = document.getElementById('stat-total-elec');
    elElec.textContent = formatCompact(totals.total_electricity_kwh);
    elElec.title = `${formatNumber(totals.total_electricity_kwh)} kWh`;

    const elWater = document.getElementById('stat-total-water');
    elWater.textContent = formatCompact(totals.total_water_liters);
    elWater.title = `${formatNumber(totals.total_water_liters)} Liters`;

    const elWaste = document.getElementById('stat-total-waste');
    elWaste.textContent = formatCompact(totals.total_waste_kg);
    elWaste.title = `${formatNumber(totals.total_waste_kg)} kg`;

    const elAlerts = document.getElementById('stat-active-alerts');
    elAlerts.textContent = formatInt(alerts.unread_alerts || 0);
    elAlerts.title = `${alerts.unread_alerts || 0} unread alerts (${alerts.total_alerts || 0} total)`;

    const elPending = document.getElementById('stat-pending-activities');
    elPending.textContent = formatInt(pendingActivities);
    elPending.title = `${pendingActivities} pending student eco activities`;

    // Badges in sidebar
    const alertNav = document.getElementById('badge-alerts-nav');
    if (alerts.unread_alerts > 0) {
      alertNav.textContent = alerts.unread_alerts;
      alertNav.classList.remove('d-none');
    } else {
      alertNav.classList.add('d-none');
    }

    const pendingNav = document.getElementById('badge-pending-nav');
    if (pendingActivities > 0) {
      pendingNav.textContent = pendingActivities;
      pendingNav.classList.remove('d-none');
    } else {
      pendingNav.classList.add('d-none');
    }

    // Render Charts
    renderCharts(monthlyTrends, totals);
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

function renderCharts(monthlyData, totals) {
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = monthlyData.map(d => `${monthNames[d.month]} ${d.year}`);
  const co2Data = monthlyData.map(d => d.co2);

  // 1. Line Chart: CO2 Trend
  const ctxCo2 = document.getElementById('co2TrendChart');
  if (ctxCo2) {
    if (co2ChartInstance) co2ChartInstance.destroy();
    co2ChartInstance = new Chart(ctxCo2, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          label: 'Total CO₂ Emitted (kg)',
          data: co2Data.length ? co2Data : [0],
          borderColor: '#4e9f5b',
          backgroundColor: 'rgba(78, 159, 91, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#2f6b39',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => `CO₂: ${formatNumber(ctx.raw)} kg`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: '#edf5ee' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // 2. Resource Breakdown Doughnut Chart
  const ctxRes = document.getElementById('resourceShareChart');
  if (ctxRes) {
    if (resourceChartInstance) resourceChartInstance.destroy();

    const elecCo2 = totals.total_electricity_kwh * 0.45;
    const waterCo2 = totals.total_water_liters * 0.0003;
    const wasteCo2 = totals.total_waste_kg * 0.50;
    const hasData = (elecCo2 + waterCo2 + wasteCo2) > 0;

    resourceChartInstance = new Chart(ctxRes, {
      type: 'doughnut',
      data: {
        labels: ['Electricity Grid', 'Water Supply', 'Solid Waste'],
        datasets: [{
          data: hasData ? [elecCo2.toFixed(1), waterCo2.toFixed(1), wasteCo2.toFixed(1)] : [1, 1, 1],
          backgroundColor: hasData ? ['#f57f17', '#0288d1', '#d84315'] : ['#e0e0e0', '#e0e0e0', '#e0e0e0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => hasData ? `${ctx.label}: ${formatNumber(ctx.raw)} kg CO₂` : 'No data recorded'
            }
          }
        }
      }
    });
  }
}

// =============================================================================
// MONTHLY USAGE (DATA ENTRY & CSV EXPORT)
// =============================================================================
async function loadUsageTable() {
  const buildingId = document.getElementById('filter-usage-building').value;
  const deptId = document.getElementById('filter-usage-dept').value;
  const month = document.getElementById('filter-usage-month').value;
  const year = document.getElementById('filter-usage-year').value;

  let url = `/api/admin/usage?1=1`;
  if (year) url += `&year=${year}`;
  if (buildingId) url += `&building_id=${buildingId}`;
  if (deptId) url += `&department_id=${deptId}`;
  if (month) url += `&month=${month}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    const tbody = document.getElementById('tbody-usage');
    currentUsageData = result.data || [];

    if (!result.success || !currentUsageData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="empty-state-box">
              <div class="empty-state-icon">🌿</div>
              <h6 class="fw-semibold">No records found for this selection</h6>
              <p class="small text-muted mb-0">Try adjusting your department or date filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    tbody.innerHTML = currentUsageData.map(r => `
      <tr>
        <td class="text-muted small">${r.usage_id}</td>
        <td class="fw-semibold">${r.building_name}</td>
        <td><span class="badge bg-light text-dark border">${r.department_name} (${r.department_code})</span></td>
        <td>${monthNames[r.month]} ${r.year}</td>
        <td>${formatNumber(r.electricity_kwh)}</td>
        <td>${formatNumber(r.water_liters)}</td>
        <td>${formatNumber(r.waste_kg)}</td>
        <td class="fw-bold text-success">${formatNumber(r.total_co2_kg)}</td>
        <td>
          ${r.alerts_count > 0 
            ? `<span class="badge-soft-danger"><i class="bi bi-exclamation-circle-fill me-1"></i>${r.alerts_count} Alert</span>` 
            : `<span class="badge-soft-success">Normal</span>`}
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="openEditUsageModal(${r.usage_id}, ${r.electricity_kwh}, ${r.water_liters}, ${r.waste_kg}, '${r.building_name}', '${monthNames[r.month]} ${r.year}')" title="Edit Usage">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="deleteUsage(${r.usage_id})" title="Delete Record">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load usage table:', err);
  }
}

function exportUsageCSV() {
  if (!currentUsageData || !currentUsageData.length) {
    showToast('No records found to export', 'warning');
    return;
  }
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const headers = ['Record ID', 'Building Name', 'Department', 'Department Code', 'Month', 'Year', 'Electricity (kWh)', 'Water (Liters)', 'Waste (kg)', 'Total CO2 (kg)', 'Alerts Count'];
  const rows = currentUsageData.map(r => [
    r.usage_id,
    r.building_name,
    r.department_name,
    r.department_code,
    monthNames[r.month] || r.month,
    r.year,
    r.electricity_kwh,
    r.water_liters,
    r.waste_kg,
    r.total_co2_kg,
    r.alerts_count
  ]);
  exportToCSV(`CarbonLens_Usage_Export_${Date.now()}.csv`, headers, rows);
  showToast('Usage data exported to CSV successfully!', 'success');
}

function resetUsageFilters() {
  document.getElementById('filter-usage-building').value = '';
  document.getElementById('filter-usage-dept').value = '';
  document.getElementById('filter-usage-month').value = '';
  document.getElementById('filter-usage-year').value = '2026';
  loadUsageTable();
}

function openAddUsageModal() {
  document.getElementById('modalUsageTitle').textContent = 'Record Monthly Usage';
  document.getElementById('usage-id').value = '';
  document.getElementById('usage-elec').value = '';
  document.getElementById('usage-water').value = '';
  document.getElementById('usage-waste').value = '';
  document.getElementById('group-usage-building').classList.remove('d-none');
  document.getElementById('group-usage-period').classList.remove('d-none');
  new bootstrap.Modal(document.getElementById('modalUsage')).show();
}

function openEditUsageModal(id, elec, water, waste, bldgName, period) {
  document.getElementById('modalUsageTitle').textContent = `Edit Usage: ${bldgName} (${period})`;
  document.getElementById('usage-id').value = id;
  document.getElementById('usage-elec').value = elec;
  document.getElementById('usage-water').value = water;
  document.getElementById('usage-waste').value = waste;
  document.getElementById('group-usage-building').classList.add('d-none');
  document.getElementById('group-usage-period').classList.add('d-none');
  new bootstrap.Modal(document.getElementById('modalUsage')).show();
}

document.getElementById('form-usage').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('usage-id').value;
  const building_id = document.getElementById('usage-building-id').value;
  const month = document.getElementById('usage-month').value;
  const year = document.getElementById('usage-year').value;
  const electricity_kwh = document.getElementById('usage-elec').value;
  const water_liters = document.getElementById('usage-water').value;
  const waste_kg = document.getElementById('usage-waste').value;

  try {
    let res;
    if (id) {
      res = await fetch(`/api/admin/usage/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ electricity_kwh, water_liters, waste_kg })
      });
    } else {
      res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_id, month, year, electricity_kwh, water_liters, waste_kg })
      });
    }

    const data = await res.json();
    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById('modalUsage')).hide();
      showToast(data.message || 'Usage saved successfully!', 'success');
      loadUsageTable();
      loadAdminStats();
    } else {
      showToast(data.error || 'Failed to save usage record', 'danger');
    }
  } catch (err) {
    showToast('Network error while saving usage', 'danger');
  }
});

async function deleteUsage(id) {
  if (!confirm(`Are you sure you want to delete monthly usage record #${id}?`)) return;
  try {
    const res = await fetch(`/api/admin/usage/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Usage record deleted.', 'success');
      loadUsageTable();
      loadAdminStats();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to delete usage', 'danger');
  }
}

// =============================================================================
// PERFORMANCE REPORTS (CAMPUS / DEPARTMENT BREAKDOWN)
// =============================================================================
async function runMonthlyReportSP() {
  const month = document.getElementById('sp-report-month').value;
  const year = document.getElementById('sp-report-year').value;
  const deptSelect = document.getElementById('sp-report-dept');
  const deptId = deptSelect ? deptSelect.value : 'all';

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const titleEl = document.getElementById('sp-report-title');
  const thead = document.getElementById('thead-sp-report');
  const tbody = document.getElementById('tbody-sp-report');

  try {
    let url = `/api/admin/reports/monthly?month=${month}&year=${year}`;
    if (deptId && deptId !== 'all') url += `&department_id=${deptId}`;

    const res = await fetch(url);
    const result = await res.json();
    currentReportData = result.data || [];

    if (!result.success || !currentReportData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state-box">
              <div class="empty-state-icon">📋</div>
              <h6 class="fw-semibold">No report records found for this period</h6>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    if (result.isDepartmentScoped) {
      // Department building-wise breakdown
      const deptName = deptSelect.options[deptSelect.selectedIndex]?.text || 'Department';
      titleEl.textContent = `${deptName} Building Breakdown: ${monthNames[month]} ${year}`;
      thead.innerHTML = `
        <tr>
          <th>Building ID</th>
          <th>Building Name</th>
          <th>Parent Department</th>
          <th>Electricity (kWh)</th>
          <th>Water (Liters)</th>
          <th>Waste (kg)</th>
          <th>Total CO₂ (kg)</th>
          <th>Status</th>
        </tr>
      `;
      tbody.innerHTML = currentReportData.map(r => `
        <tr>
          <td class="text-muted small">${r.building_id}</td>
          <td class="fw-semibold">${r.building_name}</td>
          <td>${r.department_name}</td>
          <td>${formatNumber(r.electricity_kwh)}</td>
          <td>${formatNumber(r.water_liters)}</td>
          <td>${formatNumber(r.waste_kg)}</td>
          <td class="fw-bold text-success">${formatNumber(r.total_co2_kg)}</td>
          <td>
            ${r.alerts_count > 0 ? `<span class="badge-soft-danger">${r.alerts_count} Alert(s)</span>` : `<span class="badge-soft-success">Normal</span>`}
          </td>
        </tr>
      `).join('');
    } else {
      // Campus-wide department summary
      titleEl.textContent = `Campus-Wide Department Audit: ${monthNames[month]} ${year}`;
      thead.innerHTML = `
        <tr>
          <th>ID</th>
          <th>Department Name</th>
          <th>Code</th>
          <th>Active Buildings</th>
          <th>Total Electricity (kWh)</th>
          <th>Total Water (L)</th>
          <th>Total Waste (kg)</th>
          <th>Total CO₂ (kg)</th>
          <th>Alert Incidents</th>
        </tr>
      `;
      tbody.innerHTML = currentReportData.map(r => `
        <tr>
          <td class="text-muted small">${r.department_id}</td>
          <td class="fw-semibold">${r.department_name}</td>
          <td><span class="badge bg-light text-dark border">${r.department_code}</span></td>
          <td><span class="badge bg-secondary-subtle text-dark">${r.total_buildings} bldgs</span></td>
          <td>${formatNumber(r.total_electricity_kwh)}</td>
          <td>${formatNumber(r.total_water_liters)}</td>
          <td>${formatNumber(r.total_waste_kg)}</td>
          <td class="fw-bold text-success">${formatNumber(r.total_co2_kg)}</td>
          <td>
            ${r.total_alerts > 0 ? `<span class="badge-soft-danger">${r.total_alerts} High Alerts</span>` : `<span class="badge-soft-success">0</span>`}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to execute report:', err);
  }
}

function exportReportCSV() {
  if (!currentReportData || !currentReportData.length) {
    showToast('No report data to export', 'warning');
    return;
  }
  const headers = Object.keys(currentReportData[0]);
  const rows = currentReportData.map(obj => headers.map(k => obj[k]));
  exportToCSV(`CarbonLens_Report_Export_${Date.now()}.csv`, headers, rows);
  showToast('Performance report exported to CSV successfully!', 'success');
}

// =============================================================================
// DEPARTMENTS CRUD
// =============================================================================
async function loadDepartmentsTable() {
  try {
    const res = await fetch('/api/admin/departments');
    const result = await res.json();
    if (!result.success) return;
    departmentsList = result.data;

    // Populate dropdowns across app
    populateDepartmentDropdowns();

    const tbody = document.getElementById('tbody-departments');
    tbody.innerHTML = result.data.map(d => `
      <tr>
        <td class="text-muted small">${d.department_id}</td>
        <td class="fw-semibold">${d.department_name}</td>
        <td><span class="badge bg-light text-dark border">${d.department_code}</span></td>
        <td>${d.building_count} Assigned</td>
        <td class="fw-bold text-success">${formatNumber(d.total_co2_kg)} kg</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="openEditDeptModal(${d.department_id}, '${d.department_name}', '${d.department_code}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="deleteDept(${d.department_id}, '${d.department_name}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load departments:', err);
  }
}

function openAddDeptModal() {
  document.getElementById('modalDeptTitle').textContent = 'Add New Department';
  document.getElementById('dept-id').value = '';
  document.getElementById('dept-name').value = '';
  document.getElementById('dept-code').value = '';
  new bootstrap.Modal(document.getElementById('modalDept')).show();
}

function openEditDeptModal(id, name, code) {
  document.getElementById('modalDeptTitle').textContent = 'Edit Department';
  document.getElementById('dept-id').value = id;
  document.getElementById('dept-name').value = name;
  document.getElementById('dept-code').value = code;
  new bootstrap.Modal(document.getElementById('modalDept')).show();
}

document.getElementById('form-dept').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('dept-id').value;
  const department_name = document.getElementById('dept-name').value;
  const department_code = document.getElementById('dept-code').value;

  try {
    const url = id ? `/api/admin/departments/${id}` : '/api/admin/departments';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department_name, department_code })
    });
    const data = await res.json();
    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById('modalDept')).hide();
      showToast(data.message, 'success');
      loadDepartmentsTable();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to save department', 'danger');
  }
});

async function deleteDept(id, name) {
  if (!confirm(`Are you sure you want to delete department '${name}'? This will delete its assigned buildings and usage records.`)) return;
  try {
    const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Department deleted.', 'success');
      loadDepartmentsTable();
      loadAdminStats();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to delete department', 'danger');
  }
}

// =============================================================================
// BUILDINGS CRUD
// =============================================================================
async function loadBuildingsTable() {
  try {
    const res = await fetch('/api/admin/buildings');
    const result = await res.json();
    if (!result.success) return;
    buildingsList = result.data;

    populateBuildingDropdowns();

    const tbody = document.getElementById('tbody-buildings');
    tbody.innerHTML = result.data.map(b => `
      <tr>
        <td class="text-muted small">${b.building_id}</td>
        <td class="fw-semibold">${b.building_name}</td>
        <td>${b.department_name}</td>
        <td><span class="badge bg-light text-dark border">${b.department_code}</span></td>
        <td>${b.record_count} Months</td>
        <td class="fw-bold text-success">${formatNumber(b.total_co2_kg)} kg</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="openEditBuildingModal(${b.building_id}, '${b.building_name}', ${b.department_id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="deleteBuilding(${b.building_id}, '${b.building_name}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load buildings:', err);
  }
}

function openAddBuildingModal() {
  document.getElementById('modalBuildingTitle').textContent = 'Add Campus Building';
  document.getElementById('building-id').value = '';
  document.getElementById('building-name').value = '';
  new bootstrap.Modal(document.getElementById('modalBuilding')).show();
}

function openEditBuildingModal(id, name, deptId) {
  document.getElementById('modalBuildingTitle').textContent = 'Edit Campus Building';
  document.getElementById('building-id').value = id;
  document.getElementById('building-name').value = name;
  document.getElementById('building-dept-id').value = deptId;
  new bootstrap.Modal(document.getElementById('modalBuilding')).show();
}

document.getElementById('form-building').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('building-id').value;
  const building_name = document.getElementById('building-name').value;
  const department_id = document.getElementById('building-dept-id').value;

  try {
    const url = id ? `/api/admin/buildings/${id}` : '/api/admin/buildings';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ building_name, department_id })
    });
    const data = await res.json();
    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById('modalBuilding')).hide();
      showToast(data.message, 'success');
      loadBuildingsTable();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to save building', 'danger');
  }
});

async function deleteBuilding(id, name) {
  if (!confirm(`Are you sure you want to delete building '${name}'? This will delete all its monthly usage records.`)) return;
  try {
    const res = await fetch(`/api/admin/buildings/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Building deleted.', 'success');
      loadBuildingsTable();
      loadAdminStats();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to delete building', 'danger');
  }
}

// =============================================================================
// USERS CRUD
// =============================================================================
async function loadUsersTable() {
  try {
    const res = await fetch('/api/admin/users');
    const result = await res.json();
    if (!result.success) return;

    const tbody = document.getElementById('tbody-users');
    tbody.innerHTML = result.data.map(u => `
      <tr>
        <td class="text-muted small">${u.user_id}</td>
        <td class="fw-semibold">${u.full_name}</td>
        <td>${u.email}</td>
        <td>
          <span class="user-role-badge ${u.role === 'admin' ? 'bg-danger text-white' : u.role === 'chairperson' ? 'bg-primary text-white' : 'bg-success text-white'}">
            ${u.role}
          </span>
        </td>
        <td>${u.department_name || '<em class="text-muted">None (Global Admin)</em>'}</td>
        <td class="small text-muted">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteUser(${u.user_id}, '${u.full_name}')" title="Delete User">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function openAddUserModal() {
  document.getElementById('modalUserTitle').textContent = 'Create Campus User';
  document.getElementById('user-id').value = '';
  document.getElementById('user-fullname').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-password').required = true;
  document.getElementById('user-role').value = 'student';
  toggleUserDeptRequirement();
  new bootstrap.Modal(document.getElementById('modalUser')).show();
}

function toggleUserDeptRequirement() {
  const role = document.getElementById('user-role').value;
  const deptGroup = document.getElementById('group-user-dept');
  if (role === 'admin') {
    deptGroup.classList.add('d-none');
  } else {
    deptGroup.classList.remove('d-none');
  }
}

document.getElementById('form-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('user-id').value;
  const full_name = document.getElementById('user-fullname').value;
  const email = document.getElementById('user-email').value;
  const password = document.getElementById('user-password').value;
  const role = document.getElementById('user-role').value;
  const department_id = document.getElementById('user-dept-id').value;

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, password, role, department_id })
    });
    const data = await res.json();
    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById('modalUser')).hide();
      showToast(data.message, 'success');
      loadUsersTable();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to create user', 'danger');
  }
});

async function deleteUser(id, name) {
  if (!confirm(`Are you sure you want to delete user account '${name}'?`)) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('User deleted successfully.', 'success');
      loadUsersTable();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to delete user', 'danger');
  }
}

// =============================================================================
// STUDENT ECO APPROVALS
// =============================================================================
let currentActivityStatusFilter = 'all';

function filterActivities(status, btn) {
  currentActivityStatusFilter = status;
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadActivitiesTable();
}

async function loadActivitiesTable() {
  try {
    const res = await fetch(`/api/admin/activities?status=${currentActivityStatusFilter}`);
    const result = await res.json();
    const tbody = document.getElementById('tbody-activities');
    if (!result.success || !result.data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="empty-state-box">
              <div class="empty-state-icon">🌱</div>
              <h6 class="fw-semibold">No student activities found in this category</h6>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = result.data.map(a => `
      <tr>
        <td class="text-muted small">${a.log_id}</td>
        <td class="fw-semibold">${a.student_name}</td>
        <td><span class="badge bg-light text-dark border">${a.department_code || 'N/A'}</span></td>
        <td>${a.activity_name}</td>
        <td><span class="badge bg-success-subtle text-success fw-bold">+${a.points} pts</span></td>
        <td class="small">${a.activity_date}</td>
        <td class="small text-muted" style="max-width: 250px;">${a.description || ''}</td>
        <td>
          <span class="${a.status === 'approved' ? 'badge-soft-success' : a.status === 'rejected' ? 'badge-soft-danger' : 'badge-soft-warning'}">
            ${a.status.toUpperCase()}
          </span>
        </td>
        <td class="small text-muted">${a.reviewer_name || '—'}</td>
        <td class="text-end">
          ${a.status === 'pending' ? `
            <button class="btn btn-sm btn-outline-success py-0 px-2" onclick="setActivityStatus(${a.log_id}, 'approved')" title="Approve">
              <i class="bi bi-check-lg"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="setActivityStatus(${a.log_id}, 'rejected')" title="Reject">
              <i class="bi bi-x-lg"></i>
            </button>
          ` : `
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="setActivityStatus(${a.log_id}, 'pending')" title="Revert to Pending">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load activities:', err);
  }
}

async function setActivityStatus(logId, status) {
  try {
    const res = await fetch(`/api/admin/activities/${logId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadActivitiesTable();
      loadAdminStats();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to update status', 'danger');
  }
}

// =============================================================================
// ALERTS (Filtered by global selections)
// =============================================================================
async function loadAlertsTable() {
  const deptSelect = document.getElementById('global-filter-dept');
  const monthSelect = document.getElementById('global-filter-month');
  const yearSelect = document.getElementById('global-filter-year');

  const deptId = deptSelect ? deptSelect.value : 'all';
  const month = monthSelect ? monthSelect.value : 'all';
  const year = yearSelect ? yearSelect.value : '2026';

  let url = `/api/admin/alerts?1=1`;
  if (deptId && deptId !== 'all') url += `&department_id=${deptId}`;
  if (month && month !== 'all') url += `&month=${month}`;
  if (year && year !== 'all') url += `&year=${year}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    const tbody = document.getElementById('tbody-alerts');
    if (!result.success || !result.data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state-box">
              <div class="empty-state-icon">🔔</div>
              <h6 class="fw-semibold">No environmental alerts logged for this selection</h6>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = result.data.map(a => `
      <tr class="${!a.is_read ? 'table-warning' : ''}">
        <td class="text-muted small">#${a.alert_id}</td>
        <td>
          <span class="badge ${a.resource_type === 'electricity' ? 'bg-warning text-dark' : a.resource_type === 'water' ? 'bg-info text-white' : 'bg-danger text-white'}">
            ${a.resource_type.toUpperCase()}
          </span>
        </td>
        <td class="fw-semibold">${a.building_name} (${a.department_code})</td>
        <td class="small">${a.message}</td>
        <td class="small text-muted">${new Date(a.created_at).toLocaleString()}</td>
        <td>
          ${a.is_read ? '<span class="badge bg-light text-muted border">Acknowledged</span>' : '<span class="badge bg-danger">Unread Incident</span>'}
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="toggleAlertRead(${a.alert_id})">
            ${a.is_read ? '<i class="bi bi-envelope"></i> Unread' : '<i class="bi bi-check2-all"></i> Mark Read'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load alerts:', err);
  }
}

async function toggleAlertRead(id) {
  try {
    const res = await fetch(`/api/admin/alerts/${id}/read`, { method: 'PATCH' });
    const data = await res.json();
    if (data.success) {
      loadAlertsTable();
      loadAdminStats();
    }
  } catch (err) {
    showToast('Failed to toggle alert status', 'danger');
  }
}

// =============================================================================
// SETTINGS (FACTORS & LIMITS)
// =============================================================================
async function loadSettings() {
  try {
    const resLimits = await fetch('/api/admin/usage-limits');
    const dataLimits = await resLimits.json();
    if (dataLimits.success) {
      document.getElementById('tbody-limits').innerHTML = dataLimits.data.map(l => `
        <tr>
          <td class="text-capitalize fw-semibold">${l.resource_type}</td>
          <td>
            <input type="number" step="0.01" class="form-control form-control-sm" id="limit-input-${l.limit_id}" value="${l.max_monthly_value}">
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-leaf py-0 px-2" onclick="updateLimit(${l.limit_id})">Save</button>
          </td>
        </tr>
      `).join('');
    }

    const resFactors = await fetch('/api/admin/emission-factors');
    const dataFactors = await resFactors.json();
    if (dataFactors.success) {
      document.getElementById('tbody-factors').innerHTML = dataFactors.data.map(f => `
        <tr>
          <td class="text-capitalize fw-semibold">${f.resource_type}</td>
          <td><span class="badge bg-light text-dark border">${f.unit}</span></td>
          <td>
            <input type="number" step="0.0001" class="form-control form-control-sm" id="factor-input-${f.factor_id}" value="${f.kg_co2_per_unit}">
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-leaf py-0 px-2" onclick="updateFactor(${f.factor_id})">Save</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function updateLimit(id) {
  const max_monthly_value = document.getElementById(`limit-input-${id}`).value;
  try {
    const res = await fetch(`/api/admin/usage-limits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_monthly_value })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadSettings();
    }
  } catch (err) {
    showToast('Failed to update limit', 'danger');
  }
}

async function updateFactor(id) {
  const kg_co2_per_unit = document.getElementById(`factor-input-${id}`).value;
  try {
    const res = await fetch(`/api/admin/emission-factors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kg_co2_per_unit })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadSettings();
    }
  } catch (err) {
    showToast('Failed to update factor', 'danger');
  }
}

// =============================================================================
// LEADERBOARDS (VIEWS)
// =============================================================================
async function loadLeaderboards() {
  try {
    const resDept = await fetch('/api/leaderboards/departments');
    const dataDept = await resDept.json();
    if (dataDept.success) {
      document.getElementById('tbody-leaderboard-dept').innerHTML = dataDept.data.map(d => `
        <tr>
          <td><span class="badge ${d.carbon_rank === 1 ? 'bg-success' : 'bg-light text-dark border'}">#${d.carbon_rank}</span></td>
          <td class="fw-semibold">${d.department_name}</td>
          <td><span class="badge bg-light text-dark border">${d.department_code}</span></td>
          <td class="fw-bold text-success">${formatNumber(d.total_co2_kg)} kg</td>
        </tr>
      `).join('');
    }

    const resStudent = await fetch('/api/leaderboards/students');
    const dataStudent = await resStudent.json();
    if (dataStudent.success) {
      document.getElementById('tbody-leaderboard-student').innerHTML = dataStudent.data.slice(0, 10).map(s => `
        <tr>
          <td><span class="badge ${s.student_rank === 1 ? 'bg-warning text-dark' : 'bg-light text-dark border'}">#${s.student_rank}</span></td>
          <td class="fw-semibold">${s.full_name}</td>
          <td><span class="badge bg-light text-dark border">${s.department_code || 'N/A'}</span></td>
          <td><span class="badge bg-success-subtle text-success fw-bold">${s.total_points} pts</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load leaderboards:', err);
  }
}

// Helpers to populate select elements
function populateDepartmentDropdowns() {
  const options = departmentsList.map(d => `<option value="${d.department_id}">${d.department_name} (${d.department_code})</option>`).join('');
  
  // Global filter
  const globalFilterEl = document.getElementById('global-filter-dept');
  if (globalFilterEl) globalFilterEl.innerHTML = '<option value="all">All Departments (Campus-wide)</option>' + options;

  // Usage tab filter
  const filterEl = document.getElementById('filter-usage-dept');
  if (filterEl) filterEl.innerHTML = '<option value="">All Departments</option>' + options;

  // Report tab filter
  const reportFilterEl = document.getElementById('sp-report-dept');
  if (reportFilterEl) reportFilterEl.innerHTML = '<option value="all">All Departments (Campus Overview)</option>' + options;

  const bldgDeptEl = document.getElementById('building-dept-id');
  if (bldgDeptEl) bldgDeptEl.innerHTML = options;
  const userDeptEl = document.getElementById('user-dept-id');
  if (userDeptEl) userDeptEl.innerHTML = options;
}

function populateBuildingDropdowns() {
  const options = buildingsList.map(b => `<option value="${b.building_id}">${b.building_name} (${b.department_code})</option>`).join('');
  const filterEl = document.getElementById('filter-usage-building');
  if (filterEl) filterEl.innerHTML = '<option value="">All Buildings</option>' + options;
  const modalUsageBldg = document.getElementById('usage-building-id');
  if (modalUsageBldg) modalUsageBldg.innerHTML = options;
}

// Initial Boot
document.addEventListener('DOMContentLoaded', async () => {
  await loadDepartmentsTable();
  await loadBuildingsTable();
  loadAdminStats();
  loadUsageTable();
});
