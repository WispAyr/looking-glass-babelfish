document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const connectorList = document.getElementById('connector-list');
    const systemStatus = document.getElementById('system-status-placeholder');
    const alarmsBox = document.getElementById('alarms-placeholder');
    const mapBox = document.getElementById('map-placeholder');

    // --- Helper: Status Badge ---
    function statusBadge(status) {
        let color = '#888';
        if (status === 'connected' || status === 'healthy') color = '#28a745';
        else if (status === 'disconnected' || status === 'error') color = '#dc3545';
        else if (status === 'degraded' || status === 'warning') color = '#ffc107';
        return `<span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:0.9em;background:${color};color:#fff;margin-left:8px;">${status || 'unknown'}</span>`;
    }

    // --- Connectors ---
    function renderConnectors(connectors) {
        connectorList.innerHTML = '';
        if (!connectors || connectors.length === 0) {
            connectorList.innerHTML = '<li>No connectors found.</li>';
            return;
        }
        connectors.forEach(connector => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <strong>${connector.name || connector.id}</strong>
                <span style="color:#bb86fc;">(${connector.type})</span>
                ${statusBadge(connector.status)}
                <div style="font-size:0.9em;color:#aaa;">${connector.description || ''}</div>
            `;
            connectorList.appendChild(listItem);
        });
    }

    // --- System Status ---
    function renderSystemStatus(data) {
        if (!data) {
            systemStatus.innerHTML = '<div>Unable to load system status.</div>';
            return;
        }
        const sys = data.system || {};
        const perf = data.performance || {};
        const connectors = data.connectors || {};
        systemStatus.innerHTML = `
            <div><strong>Status:</strong> ${statusBadge(sys.status || 'unknown')}</div>
            <div><strong>Uptime:</strong> ${sys.uptime || 'N/A'}</div>
            <div><strong>Memory:</strong> ${sys.memory ? JSON.stringify(sys.memory) : 'N/A'}</div>
            <div><strong>Connectors:</strong> Active: ${connectors.active || 0} / Total: ${connectors.total || 0}</div>
            <div><strong>Health:</strong> ${statusBadge(connectors.health || 'unknown')}</div>
            <div><strong>Events/sec:</strong> ${data.events?.perSecond || 0}</div>
            <div><strong>Error Rate:</strong> ${perf.errorRate || '0%'}</div>
        `;
    }

    // --- Alarms ---
    function renderAlarms(alarms) {
        alarmsBox.innerHTML = '';
        if (!alarms || alarms.length === 0) {
            alarmsBox.innerHTML = '<div>No active alarms.</div>';
            return;
        }
        alarms.forEach(alarm => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            div.innerHTML = `
                <strong>${alarm.title || alarm.type}</strong> ${statusBadge(alarm.status)}<br>
                <span style="font-size:0.9em;color:#aaa;">${alarm.message || ''}</span>
            `;
            alarmsBox.appendChild(div);
        });
    }

    // --- Map Placeholder ---
    function renderMapPlaceholder() {
        mapBox.innerHTML = '<div style="color:#888;text-align:center;padding:40px 0;">Map integration coming soon.<br>Contact admin to enable real-time map overlays.</div>';
    }

    // --- Fetch and Render All ---
    function loadAll() {
        // Connectors
        connectorList.innerHTML = '<li>Loading connectors...</li>';
        fetch('/api/connectors')
            .then(r => r.json())
            .then(data => renderConnectors(data.data || []))
            .catch(() => connectorList.innerHTML = '<li>Error loading connectors.</li>');

        // System Status
        systemStatus.innerHTML = 'Loading system status...';
        fetch('/api/overwatch/status')
            .then(r => r.json())
            .then(data => renderSystemStatus(data))
            .catch(() => systemStatus.innerHTML = 'Error loading system status.');

        // Alarms
        alarmsBox.innerHTML = 'Loading alarms...';
        fetch('/api/alarms')
            .then(r => r.json())
            .then(data => renderAlarms(data.alarms || data.data || []))
            .catch(() => alarmsBox.innerHTML = 'Error loading alarms.');

        // Map
        renderMapPlaceholder();
    }

    loadAll();
    setInterval(loadAll, 30000); // Refresh every 30s
});
