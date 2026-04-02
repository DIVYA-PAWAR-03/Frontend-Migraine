/**
 * Migraine Trigger Tracker - Frontend Application
 * 
 * Handles:
 * - API communication with FastAPI backend
 * - Form handling and validation
 * - Dashboard updates and risk display
 * - Chart rendering with Chart.js
 * - Toast notifications
 */

// Configuration
const CONFIG = {
    API_BASE_URL:
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:8000/api/v1'
            : `${window.location.origin}/api/v1`,
    USER_ID: 'default_user'
};

// State management
const state = {
    currentPrediction: null,
    historyData: null,
    charts: {}
};

// ================================
// API Service
// ================================

const api = {
    async predict(data) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, user_id: CONFIG.USER_ID })
        });
        if (!response.ok) throw new Error('Prediction failed');
        return response.json();
    },

    async logData(data) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/log-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, user_id: CONFIG.USER_ID })
        });
        if (!response.ok) throw new Error('Failed to log data');
        return response.json();
    },

    async getHistory(days = 30) {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}/history?user_id=${CONFIG.USER_ID}&days=${days}`
        );
        if (!response.ok) throw new Error('Failed to fetch history');
        return response.json();
    },

    async getAISuggestions(data) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/ai-suggestion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to get suggestions');
        return response.json();
    },

    async getHealth() {
        const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
        return response.json();
    }
};

// ================================
// UI Utilities
// ================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
}

function getAQILabel(value) {
    if (value <= 50) return { text: 'Good', class: 'good' };
    if (value <= 100) return { text: 'Moderate', class: 'moderate' };
    return { text: 'Unhealthy', class: 'unhealthy' };
}

function getTriggerIcon(trigger) {
    const text = trigger.toLowerCase();
    if (text.includes('stress')) return '😰';
    if (text.includes('sleep')) return '😴';
    if (text.includes('heart')) return '❤️';
    if (text.includes('activity')) return '🏃';
    if (text.includes('pressure')) return '🌤️';
    if (text.includes('air') || text.includes('aqi')) return '💨';
    return '⚡';
}

// ================================
// Navigation
// ================================

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;
            
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `section-${targetSection}`) {
                    section.classList.add('active');
                    if (targetSection === 'history') loadHistory();
                }
            });
        });
    });
}

// ================================
// Dashboard
// ================================

function updateRiskDisplay(prediction) {
    if (!prediction) return;
    
    const percentage = Math.round(prediction.probability * 100);
    const riskLevel = prediction.risk_level.toLowerCase();
    
    // Update percentage
    document.getElementById('risk-percentage').textContent = `${percentage}%`;
    document.getElementById('risk-label').textContent = prediction.risk_level;
    
    // Update circle progress
    const progressFill = document.getElementById('risk-progress-fill');
    const circumference = 283;
    const offset = circumference - (percentage / 100) * circumference;
    
    progressFill.style.strokeDashoffset = offset;
    progressFill.className = `risk-fill ${riskLevel}`;
    
    // Update confidence
    document.getElementById('confidence-value').textContent = 
        `${Math.round(prediction.confidence * 100)}%`;
    
    // Update time
    document.getElementById('prediction-time').textContent = 
        `Updated ${new Date().toLocaleTimeString()}`;
    
    state.currentPrediction = prediction;
}

function updateTriggersDisplay(triggers) {
    const container = document.getElementById('triggers-list');
    const countEl = document.getElementById('trigger-count');
    
    if (!triggers || triggers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎯</span>
                <p>No triggers detected</p>
                <small>Your current metrics look good!</small>
            </div>
        `;
        countEl.textContent = '0 triggers';
        return;
    }
    
    countEl.textContent = `${triggers.length} trigger${triggers.length > 1 ? 's' : ''}`;
    
    container.innerHTML = triggers.map((trigger, i) => {
        const isHigh = trigger.toLowerCase().includes('very') || 
                       trigger.toLowerCase().includes('poor');
        return `
            <div class="trigger-item ${isHigh ? 'high' : ''}" style="animation-delay: ${i * 0.1}s">
                <span class="trigger-icon">${getTriggerIcon(trigger)}</span>
                <span class="trigger-text">${trigger}</span>
            </div>
        `;
    }).join('');
}

async function loadAISuggestions(data) {
    const content = document.getElementById('suggestions-content');
    const loading = document.getElementById('suggestions-loading');
    
    content.classList.add('hidden');
    loading.classList.remove('hidden');
    
    try {
        const response = await api.getAISuggestions(data);
        
        document.getElementById('suggestion-summary').innerHTML = 
            `<p>${response.summary}</p>`;
        
        const listEl = document.getElementById('suggestions-list');
        listEl.innerHTML = response.suggestions.map((s, i) => 
            `<li class="suggestion-item" style="animation-delay: ${i * 0.1}s">${s}</li>`
        ).join('');
        
        content.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading suggestions:', error);
        content.classList.remove('hidden');
        document.getElementById('suggestion-summary').innerHTML = 
            '<p>Unable to load suggestions. Please check your connection.</p>';
    } finally {
        loading.classList.add('hidden');
    }
}

function updateStats(historyData) {
    if (!historyData) return;
    
    document.getElementById('stat-total-logs').textContent = historyData.total_records || 0;
    document.getElementById('stat-avg-risk').textContent = 
        `${Math.round((historyData.average_risk || 0) * 100)}%`;
    document.getElementById('stat-migraines').textContent = historyData.migraine_count || 0;
    
    // Calculate streak (simplified - consecutive days with logs)
    const records = historyData.records || [];
    let streak = records.length > 0 ? 1 : 0;
    document.getElementById('stat-streak').textContent = streak;
}

// ================================
// Form Handling
// ================================

function initFormHandlers() {
    // Slider value displays
    const stressSlider = document.getElementById('stress-level');
    const stressValue = document.getElementById('stress-value');
    stressSlider.addEventListener('input', (e) => {
        stressValue.textContent = e.target.value;
    });
    
    const activitySlider = document.getElementById('activity-level');
    const activityValue = document.getElementById('activity-value');
    activitySlider.addEventListener('input', (e) => {
        activityValue.textContent = e.target.value;
    });
    
    // AQI label update
    const aqiInput = document.getElementById('aqi');
    const aqiLabel = document.getElementById('aqi-label');
    aqiInput.addEventListener('input', (e) => {
        const info = getAQILabel(parseInt(e.target.value) || 0);
        aqiLabel.textContent = info.text;
        aqiLabel.className = `input-suffix aqi-label ${info.class}`;
    });
    
    // Migraine toggle
    const migraineNo = document.getElementById('migraine-no');
    const migraineYes = document.getElementById('migraine-yes');
    const migraineHidden = document.getElementById('had-migraine');
    
    migraineNo.addEventListener('click', () => {
        migraineNo.classList.add('active');
        migraineYes.classList.remove('active');
        migraineHidden.value = 'false';
    });
    
    migraineYes.addEventListener('click', () => {
        migraineYes.classList.add('active');
        migraineNo.classList.remove('active');
        migraineHidden.value = 'true';
    });
    
    // Predict only button
    document.getElementById('predict-only').addEventListener('click', async () => {
        const formData = getFormData();
        try {
            const prediction = await api.predict(formData);
            updateRiskDisplay(prediction);
            updateTriggersDisplay(prediction.triggers);
            showQuickResult(prediction);
            showToast('Prediction complete!', 'success');
        } catch (error) {
            console.error('Prediction error:', error);
            showToast('Failed to get prediction. Is the server running?', 'error');
        }
    });
    
    // Form submit (log + predict)
    document.getElementById('health-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = getFormData();
        
        try {
            const response = await api.logData(formData);
            
            if (response.prediction) {
                updateRiskDisplay({
                    risk_level: response.prediction.risk_level,
                    probability: response.prediction.probability,
                    confidence: 0.8,
                    triggers: response.prediction.triggers
                });
                updateTriggersDisplay(response.prediction.triggers);
                showQuickResult({
                    risk_level: response.prediction.risk_level,
                    probability: response.prediction.probability,
                    triggers: response.prediction.triggers
                });
                
                // Load AI suggestions
                loadAISuggestions({
                    triggers: response.prediction.triggers,
                    risk_level: response.prediction.risk_level,
                    ...formData
                });
            }
            
            showToast('Health data logged successfully!', 'success');
            loadHistory();
        } catch (error) {
            console.error('Log error:', error);
            showToast('Failed to log data. Is the server running?', 'error');
        }
    });
    
    // Close result button
    document.getElementById('close-result').addEventListener('click', () => {
        document.getElementById('quick-result').classList.add('hidden');
    });
    
    // Refresh suggestions
    document.getElementById('refresh-suggestions').addEventListener('click', () => {
        if (state.currentPrediction) {
            const formData = getFormData();
            loadAISuggestions({
                triggers: state.currentPrediction.triggers,
                risk_level: state.currentPrediction.risk_level,
                ...formData
            });
        } else {
            showToast('Make a prediction first to get suggestions', 'warning');
        }
    });
}

function getFormData() {
    const hadMigraine = document.getElementById('had-migraine').value;
    return {
        stress_level: parseInt(document.getElementById('stress-level').value),
        sleep_hours: parseFloat(document.getElementById('sleep-hours').value),
        heart_rate: parseInt(document.getElementById('heart-rate').value),
        activity_level: parseInt(document.getElementById('activity-level').value),
        weather_pressure: parseFloat(document.getElementById('weather-pressure').value),
        aqi: parseInt(document.getElementById('aqi').value),
        had_migraine: hadMigraine === 'true' ? true : hadMigraine === 'false' ? false : null,
        notes: document.getElementById('notes').value || null
    };
}

function showQuickResult(prediction) {
    const resultEl = document.getElementById('quick-result');
    const levelEl = resultEl.querySelector('.result-level');
    const probEl = resultEl.querySelector('.result-probability');
    const triggersEl = document.getElementById('result-triggers');
    
    levelEl.textContent = prediction.risk_level;
    levelEl.className = `result-level ${prediction.risk_level.toLowerCase()}`;
    probEl.textContent = `${Math.round(prediction.probability * 100)}% probability`;
    
    triggersEl.innerHTML = prediction.triggers?.length > 0 
        ? prediction.triggers.map(t => 
            `<div class="trigger-item">
                <span class="trigger-icon">${getTriggerIcon(t)}</span>
                <span class="trigger-text">${t}</span>
            </div>`
        ).join('')
        : '<p class="text-muted">No triggers detected</p>';
    
    resultEl.classList.remove('hidden');
}

// ================================
// History & Charts
// ================================

async function loadHistory(days = 30) {
    try {
        const history = await api.getHistory(days);
        state.historyData = history;
        
        updateStats(history);
        updateLogsTable(history.records);
        updateCharts(history);
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function updateLogsTable(records) {
    const tbody = document.getElementById('logs-body');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    No logs yet. Start tracking to see your history.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = records.slice(0, 20).map(record => {
        const riskLevel = record.prediction?.risk_level || 'N/A';
        const riskClass = riskLevel.toLowerCase();
        const hadMigraine = record.had_migraine === true ? '😣 Yes' 
            : record.had_migraine === false ? '😊 No' : '--';
        
        return `
            <tr>
                <td>${formatDate(record.created_at)}</td>
                <td><span class="risk-badge ${riskClass}">${riskLevel}</span></td>
                <td>${record.stress_level}/10</td>
                <td>${record.sleep_hours}h</td>
                <td>${record.heart_rate} bpm</td>
                <td>${hadMigraine}</td>
            </tr>
        `;
    }).join('');
}

function updateCharts(history) {
    if (!history.trends || !history.trends.dates) return;
    
    const trends = history.trends;
    
    // Risk Trend Chart
    if (state.charts.risk) state.charts.risk.destroy();
    
    const riskCtx = document.getElementById('risk-chart');
    if (riskCtx) {
        state.charts.risk = new Chart(riskCtx, {
            type: 'line',
            data: {
                labels: trends.dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Risk Level',
                    data: trends.avg_risk.map(r => r * 100),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        min: 0, max: 100,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
    
    // Trigger Frequency Chart
    if (state.charts.trigger) state.charts.trigger.destroy();
    
    const triggerCtx = document.getElementById('trigger-chart');
    if (triggerCtx && history.trigger_frequency) {
        const triggerData = Object.entries(history.trigger_frequency);
        state.charts.trigger = new Chart(triggerCtx, {
            type: 'doughnut',
            data: {
                labels: triggerData.map(([k]) => k),
                datasets: [{
                    data: triggerData.map(([, v]) => v),
                    backgroundColor: [
                        '#6366f1', '#06b6d4', '#f472b6', 
                        '#10b981', '#f59e0b', '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right',
                        labels: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
    
    // Metrics Chart
    if (state.charts.metrics) state.charts.metrics.destroy();
    
    const metricsCtx = document.getElementById('metrics-chart');
    if (metricsCtx) {
        state.charts.metrics = new Chart(metricsCtx, {
            type: 'line',
            data: {
                labels: trends.dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        label: 'Stress',
                        data: trends.avg_stress,
                        borderColor: '#ef4444',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Sleep (hrs)',
                        data: trends.avg_sleep,
                        borderColor: '#10b981',
                        tension: 0.4,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    y: {
                        min: 0, max: 10,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

function initHistoryFilters() {
    const filterBtns = document.querySelectorAll('.time-filter .filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadHistory(parseInt(btn.dataset.days));
        });
    });
    
    document.getElementById('refresh-history')?.addEventListener('click', () => {
        const activeFilter = document.querySelector('.time-filter .filter-btn.active');
        const days = activeFilter ? parseInt(activeFilter.dataset.days) : 30;
        loadHistory(days);
        showToast('History refreshed', 'info');
    });
}

// ================================
// Initialization
// ================================

async function checkServerHealth() {
    try {
        const health = await api.getHealth();
        console.log('Server health:', health);
        
        if (!health.ml_model_loaded) {
            showToast('ML model not loaded. Train the model first.', 'warning');
        }
        if (!health.database_connected) {
            showToast('Database not connected. History may not work.', 'warning');
        }
    } catch (error) {
        console.error('Server not reachable:', error);
        showToast('Cannot connect to server. Start the backend first.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🧠 Migraine Trigger Tracker initialized');
    
    initNavigation();
    initFormHandlers();
    initHistoryFilters();
    
    // Check server health
    checkServerHealth();
    
    // Load initial data
    loadHistory();
});
