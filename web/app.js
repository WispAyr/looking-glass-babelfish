document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const connectorList = document.getElementById('connector-list');
    const systemStatus = document.getElementById('system-status-placeholder');
    const alarmsBox = document.getElementById('alarms-placeholder');
    const mapBox = document.getElementById('map-placeholder');

    // --- Map ---
    let map;
    function initMap() {
        if (map) return;
        mapBox.innerHTML = '';
        map = L.map('map-placeholder').setView([54.5, -3], 6); // Center UK
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
        // Demo marker
        L.marker([51.5, -0.09]).addTo(map).bindPopup('London').openPopup();
    }

    // --- Helper: Status Badge ---
    function statusBadge(status) {
        let color = '#888';
        let text = 'unknown';
        
        // Handle different status structures
        if (typeof status === 'string') {
            text = status;
        } else if (status && typeof status === 'object') {
            // Check for status.status (standard structure)
            if (status.status) {
                text = status.status;
            }
            // Check for status.connected (boolean structure like radar)
            else if (typeof status.connected === 'boolean') {
                text = status.connected ? 'connected' : 'disconnected';
            }
            // Check for direct status object with properties
            else if (status.connected !== undefined) {
                text = status.connected ? 'connected' : 'disconnected';
            }
        }
        
        if (text === 'connected' || text === 'healthy') color = '#28a745';
        else if (text === 'disconnected' || text === 'error') color = '#dc3545';
        else if (text === 'connecting' || text === 'initializing') color = '#ffc107';
        
        return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:0.8em;margin-left:8px;">${text}</span>`;
    }

    // --- Connectors ---
    function renderConnectors(connectors) {
        connectorList.innerHTML = '';
        if (!connectors || connectors.length === 0) {
            connectorList.innerHTML = '<li>No connectors found.</li>';
            return;
        }
        
        // Sort connectors: connected first, then by name
        const sortedConnectors = connectors.sort((a, b) => {
            const aConnected = isConnectorConnected(a);
            const bConnected = isConnectorConnected(b);
            if (aConnected && !bConnected) return -1;
            if (!aConnected && bConnected) return 1;
            return (a.name || a.id).localeCompare(b.name || b.id);
        });
        
        sortedConnectors.forEach(connector => {
            try {
                const listItem = document.createElement('li');
                listItem.className = 'connector-list-item';
                let webUiButtons = '';
                
                // Prefer status.webInterface, fallback to config.webInterface
                const webInterface = connector.status && connector.status.webInterface
                    ? connector.status.webInterface
                    : connector.config && connector.config.webInterface;
                
                if (webInterface && webInterface.enabled) {
                    // Multi-UI support: check for routes
                    if (webInterface.routes && Object.keys(webInterface.routes).length > 0) {
                        Object.entries(webInterface.routes).forEach(([routeName, routeConfig]) => {
                            const host = routeConfig.host || webInterface.host || 'localhost';
                            const port = routeConfig.port || webInterface.port || 3000;
                            const url = `http://${host}:${port}${routeConfig.path || routeConfig.route || ''}`;
                            webUiButtons += `<button class="web-ui-btn" onclick="window.open('${url}', '_blank')" title="${routeName}">🌐 ${routeName}</button>`;
                        });
                    } else if (webInterface.url) {
                        webUiButtons = `<button class="web-ui-btn" onclick="window.open('${webInterface.url}', '_blank')" title="Web UI">🌐 Web UI</button>`;
                    } else {
                        const host = webInterface.host || 'localhost';
                        const port = webInterface.port || 3000;
                        const route = webInterface.route || '';
                        const url = `http://${host}:${port}${route}`;
                        webUiButtons = `<button class="web-ui-btn" onclick="window.open('${url}', '_blank')" title="Web UI">🌐 Web UI</button>`;
                    }
                }
                
                listItem.innerHTML = `
                    <span><strong>${connector.name || connector.id}</strong> <span class="connector-type">(${connector.type})</span> ${statusBadge(connector.status)}</span>
                    ${webUiButtons ? `<span class="web-ui-btns">${webUiButtons}</span>` : ''}
                `;
                connectorList.appendChild(listItem);
            } catch (error) {
                console.error('Error rendering connector:', connector.id, error);
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span><strong>${connector.name || connector.id}</strong> <span class="connector-type">(${connector.type})</span> ${statusBadge('error')}</span>`;
                connectorList.appendChild(listItem);
            }
        });
    }
    
    // Helper function to check if connector is connected
    function isConnectorConnected(connector) {
        if (!connector.status) return false;
        
        // Handle different status structures
        if (typeof connector.status === 'string') {
            return connector.status === 'connected';
        }
        
        if (connector.status.status) {
            return connector.status.status === 'connected';
        }
        
        if (typeof connector.status.connected === 'boolean') {
            return connector.status.connected;
        }
        
        // Check for connected property in custom status objects
        if (connector.status.connected !== undefined) {
            return connector.status.connected;
        }
        
        return false;
    }

    // --- System Status ---
    function renderSystemStatus(data) {
        if (!data || typeof data !== 'object') {
            systemStatus.innerHTML = '<div class="status-error">No system status data available.</div>';
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
    function renderAlarms(data) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            alarmsBox.innerHTML = '<div class="status-error">No alarms found.</div>';
            return;
        }
        alarmsBox.innerHTML = '';
        data.forEach(alarm => {
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
        initMap();
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

    // --- Live Updates with Socket.IO ---
    let socket;
    function setupLiveUpdates() {
        if (window.io) {
            socket = io();
            socket.on('connect', () => {
                console.log('Live updates enabled');
            });
            socket.on('update', (payload) => {
                if (payload.type === 'connectors') loadAll();
                if (payload.type === 'system') loadAll();
                if (payload.type === 'alarms') loadAll();
            });
            socket.on('disconnect', () => {
                console.log('Live updates disconnected, falling back to polling');
            });
        }
    }

    loadAll();
    setupLiveUpdates();
    setInterval(loadAll, 30000); // Fallback polling every 30s
});
