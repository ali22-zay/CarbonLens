/**
 * Chairperson Dashboard Interactivity & Handlers
 * CarbonLens (CS-2104 Database Systems)
 */

let chairChartInstance = null;
let currentChairActivityFilter = 'all';
let chairUsageData = [];
let chairReportData = [];

function switchChairTab(tabId, clickedEl) {
  document.querySelectorAll('.tab-pane-chair').forEach(t => t.classList.add('d-none'));
  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.remove('d-none');

  document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));
  if (clickedEl) clickedEl.classList.add('active');

  if (tabId === 'tab-chair-overview') loadChairStats();
  if (tabId === 'tab-chair-usage') loadChairUsage();
  if (tabId === 'tab-chair-buildings') loadChairBuildings();
  if (tabId === 'tab-chair-report') runDeptReportSP();
  if (tabId === 'tab-chair-approvals') loadChairActivities();
  if (tabId === 'tab-chair-alerts') loadChairAlerts();
  if (tabId === 'tab-chair-leaderboards') loadChairLeaderboards();
}

// =============================================================================
// FILTERS (Department is Locked/Disabled; Month & Year can be selected)
// =============================================================================
function applyChairFilters() {
  const monthSelect = document.getElementById('chair-filter-month');
  const yearSelect = document.getElementById('chair-filter-year');

  const month = monthSelect ? monthSelect.value : 'all';
  const year = yearSelect ? yearSelect.value : '2026';

  const monthText = monthSelect ? monthSelect.options[monthSelect.selectedIndex]?.text : 'All Months';
  const yearText = yearSelect ? yearSelect.options[yearSelect.selectedIndex]?.text : 'All Years';
  const deptName = document.getElementById('chair-dept-name-heading')?.textContent || 'My Department';

  const chip = document.getElementById('chair-active-filter-chip');
  if (chip) {
    chip.innerHTML = `<i class="bi bi-check2-circle text-success"></i> ${deptName} • ${monthText} • ${yearText}`;
  }

  loadChairStats();
  loadChairUsage();
  loadChairAlerts();
}

function resetChairFilters() {
  const m = document.getElementById('chair-filter-month');
  const y = document.getElementById('chair-filter-year');
  if (m) m.value = 'all';
  if (y) y.value = '2026';
  applyChairFilters();
}

// =============================================================================
// STATS & CHARTS (Compact Formats + Full Tooltips)
// =============================================================================
async function loadChairStats() {
  const monthSelect = document.getElementById('chair-filter-month');
  const yearSelect = document.getElementById('chair-filter-year');
  const month = monthSelect ? monthSelect.value : 'all';
  const year = yearSelect ? yearSelect.value : '2026';

  let url = `/api/chairperson/stats?month=${month}&year=${year}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    if (!result.success) return;

    const { department, alerts, pendingActivities, monthlyTrends } = result.data;

    // Update department name references
    const deptHeading = document.getElementById('chair-dept-name-heading');
    if (deptHeading) deptHeading.textContent = department.department_name;
    const lockedOption = document.getElementById('chair-locked-dept-option');
    if (lockedOption) lockedOption.textContent = department.department_name;
    const chipDept = document.getElementById('chair-chip-dept-name');
    if (chipDept) chipDept.textContent = department.department_name;

    // Compact stat values with full exact numbers in tooltips
    const elCo2 = document.getElementById('chair-stat-co2');
    elCo2.textContent = formatCompact(department.total_co2_kg);
    elCo2.title = `${formatNumber(department.total_co2_kg)} kg CO₂`;

    const elElec = document.getElementById('chair-stat-elec');
    elElec.textContent = formatCompact(department.total_electricity_kwh);
    elElec.title = `${formatNumber(department.total_electricity_kwh)} kWh`;

    const elWater = document.getElementById('chair-stat-water');
    elWater.textContent = formatCompact(department.total_water_liters);
    elWater.title = `${formatNumber(department.total_water_liters)} Liters`;

    const elWaste = document.getElementById('chair-stat-waste');
    elWaste.textContent = formatCompact(department.total_waste_kg);
    elWaste.title = `${formatNumber(department.total_waste_kg)} kg`;

    const elAlerts = document.getElementById('chair-stat-alerts');
    elAlerts.textContent = formatInt(alerts.total_alerts || 0);
    elAlerts.title = `${alerts.unread_alerts || 0} unread alerts (${alerts.total_alerts || 0} total)`;

    // Badges in sidebar
    const badgePending = document.getElementById('badge-chair-pending');
    if (pendingActivities > 0) {
      badgePending.textContent = pendingActivities;
      badgePending.classList.remove('d-none');
    } else {
      badgePending.classList.add('d-none');
    }

    const badgeAlerts = document.getElementById('badge-chair-alerts');
    if (alerts.unread_alerts > 0) {
      badgeAlerts.textContent = alerts.unread_alerts;
      badgeAlerts.classList.remove('d-none');
    } else {
      badgeAlerts.classList.add('d-none');
    }

    // Render department monthly trend chart
    renderChairChart(monthlyTrends);
  } catch (err) {
    console.error('Failed to load chairperson stats:', err);
  }
}

function renderChairChart(monthlyData) {
  const ctx = document.getElementById('chairTrendChart');
  if (!ctx) return;

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = monthlyData.map(d => `${monthNames[d.month]} ${d.year}`);
  const co2Data = monthlyData.map(d => d.co2);

  if (chairChartInstance) chairChartInstance.destroy();
  chairChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No Data'],
      datasets: [{
        label: 'Monthly Department CO₂ (kg)',
        data: co2Data.length ? co2Data : [0],
        backgroundColor: '#7bc47f',
        hoverBackgroundColor: '#4e9f5b',
        borderRadius: 8
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
          beginAtZero: true,
          grid: { color: '#edf5ee' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// =============================================================================
// DEPARTMENT USAGE LOG (Read-only + CSV Export)
// =============================================================================
async function loadChairUsage() {
  const monthSelect = document.getElementById('chair-filter-month');
  const yearSelect = document.getElementById('chair-filter-year');
  const month = monthSelect ? monthSelect.value : 'all';
  const year = yearSelect ? yearSelect.value : '2026';

  let url = `/api/chairperson/usage?1=1`;
  if (month && month !== 'all') url += `&month=${month}`;
  if (year && year !== 'all') url += `&year=${year}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    const tbody = document.getElementById('tbody-chair-usage');
    chairUsageData = result.data || [];

    if (!result.success || !chairUsageData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state-box">
              <div class="empty-state-icon">🌿</div>
              <h6 class="fw-semibold">No records found for this selection</h6>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    tbody.innerHTML = chairUsageData.map(r => `
      <tr>
        <td class="text-muted small">${r.usage_id}</td>
        <td class="fw-semibold">${r.building_name}</td>
        <td><span class="badge bg-light text-dark border">${r.department_name}</span></td>
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
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load chair usage:', err);
  }
}

function exportChairUsageCSV() {
  if (!chairUsageData || !chairUsageData.length) {
    showToast('No records available to export', 'warning');
    return;
  }
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const headers = ['Record ID', 'Building Name', 'Department', 'Month', 'Year', 'Electricity (kWh)', 'Water (Liters)', 'Waste (kg)', 'Total CO2 (kg)', 'Alerts'];
  const rows = chairUsageData.map(r => [
    r.usage_id,
    r.building_name,
    r.department_name,
    monthNames[r.month] || r.month,
    r.year,
    r.electricity_kwh,
    r.water_liters,
    r.waste_kg,
    r.total_co2_kg,
    r.alerts_count
  ]);
  exportToCSV(`Department_Usage_${Date.now()}.csv`, headers, rows);
  showToast('Department usage records exported to CSV!', 'success');
}

// =============================================================================
// DEPARTMENT BUILDINGS
// =============================================================================
async function loadChairBuildings() {
  try {
    const res = await fetch('/api/chairperson/buildings');
    const result = await res.json();
    const tbody = document.getElementById('tbody-chair-buildings');
    if (!result.success || !result.data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state-box">
              <div class="empty-state-icon">🏢</div>
              <h6 class="fw-semibold">No buildings assigned to this department</h6>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = result.data.map(b => `
      <tr>
        <td class="text-muted small">${b.building_id}</td>
        <td class="fw-semibold">${b.building_name}</td>
        <td>${b.department_name}</td>
        <td>${b.total_records} Months</td>
        <td>${formatNumber(b.total_electricity_kwh)}</td>
        <td>${formatNumber(b.total_water_liters)}</td>
        <td>${formatNumber(b.total_waste_kg)}</td>
        <td class="fw-bold text-success">${formatNumber(b.total_co2_kg)} kg</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load chair buildings:', err);
  }
}

// =============================================================================
// PERFORMANCE REPORT
// =============================================================================
async function runDeptReportSP() {
  const month = document.getElementById('chair-report-month').value;
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('chair-report-heading').textContent = `Building Breakdown: ${monthNames[month]} 2026`;

  try {
    const res = await fetch(`/api/chairperson/report?month=${month}&year=2026`);
    const result = await res.json();
    const tbody = document.getElementById('tbody-chair-report');
    chairReportData = result.data || [];

    if (!result.success || !chairReportData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state-box">
              <div class="empty-state-icon">📋</div>
              <h6 class="fw-semibold">No records for selected month</h6>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = chairReportData.map(r => `
      <tr>
        <td class="text-muted small">${r.building_id}</td>
        <td class="fw-semibold">${r.building_name}</td>
        <td>${formatNumber(r.electricity_kwh)}</td>
        <td>${formatNumber(r.water_liters)}</td>
        <td>${formatNumber(r.waste_kg)}</td>
        <td class="fw-bold text-success">${formatNumber(r.total_co2_kg)}</td>
        <td>
          ${r.alerts_count > 0 ? `<span class="badge-soft-danger">${r.alerts_count} Alert(s)</span>` : `<span class="badge-soft-success">Normal</span>`}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to execute report:', err);
  }
}

function exportChairReportCSV() {
  if (!chairReportData || !chairReportData.length) {
    showToast('No report data available to export', 'warning');
    return;
  }
  const headers = Object.keys(chairReportData[0]);
  const rows = chairReportData.map(obj => headers.map(k => obj[k]));
  exportToCSV(`Department_Report_${Date.now()}.csv`, headers, rows);
  showToast('Department performance report exported to CSV!', 'success');
}

// =============================================================================
// ECO APPROVALS
// =============================================================================
function filterChairActivities(status, btn) {
  currentChairActivityFilter = status;
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadChairActivities();
}

async function loadChairActivities() {
  try {
    const res = await fetch(`/api/chairperson/activities?status=${currentChairActivityFilter}`);
    const result = await res.json();
    const tbody = document.getElementById('tbody-chair-activities');
    if (!result.success || !result.data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="empty-state-box">
              <div class="empty-state-icon">🌱</div>
              <h6 class="fw-semibold">No student activities found for your department</h6>
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
        <td class="small text-muted">${a.student_email}</td>
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
            <button class="btn btn-sm btn-outline-success py-0 px-2" onclick="setChairActivityStatus(${a.log_id}, 'approved')" title="Approve">
              <i class="bi bi-check-lg"></i> Approve
            </button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="setChairActivityStatus(${a.log_id}, 'rejected')" title="Reject">
              <i class="bi bi-x-lg"></i> Reject
            </button>
          ` : `
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="setChairActivityStatus(${a.log_id}, 'pending')" title="Revert to Pending">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load chair activities:', err);
  }
}

async function setChairActivityStatus(id, status) {
  try {
    const res = await fetch(`/api/chairperson/activities/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadChairActivities();
      loadChairStats();
    } else {
      showToast(data.error, 'danger');
    }
  } catch (err) {
    showToast('Failed to update activity status', 'danger');
  }
}

// =============================================================================
// ALERTS
// =============================================================================
async function loadChairAlerts() {
  const monthSelect = document.getElementById('chair-filter-month');
  const yearSelect = document.getElementById('chair-filter-year');
  const month = monthSelect ? monthSelect.value : 'all';
  const year = yearSelect ? yearSelect.value : '2026';

  let url = `/api/chairperson/alerts?1=1`;
  if (month && month !== 'all') url += `&month=${month}`;
  if (year && year !== 'all') url += `&year=${year}`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    const tbody = document.getElementById('tbody-chair-alerts');
    if (!result.success || !result.data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state-box">
              <div class="empty-state-icon">🔔</div>
              <h6 class="fw-semibold">No alerts logged for this selection</h6>
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
        <td class="fw-semibold">${a.building_name}</td>
        <td>${a.month}/${a.year}</td>
        <td class="small">${a.message}</td>
        <td>
          ${a.is_read ? '<span class="badge bg-light text-muted border">Acknowledged</span>' : '<span class="badge bg-danger">Unread Incident</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load chair alerts:', err);
  }
}

// =============================================================================
// LEADERBOARDS
// =============================================================================
async function loadChairLeaderboards() {
  try {
    const resDept = await fetch('/api/leaderboards/departments');
    const dataDept = await resDept.json();
    if (dataDept.success) {
      document.getElementById('tbody-chair-leaderboard-dept').innerHTML = dataDept.data.map(d => `
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
      document.getElementById('tbody-chair-leaderboard-student').innerHTML = dataStudent.data.slice(0, 10).map(s => `
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

document.addEventListener('DOMContentLoaded', () => {
  loadChairStats();
  loadChairUsage();
});
