const express = require('express');
const router = express.Router();

/**
 * GET /flows
 * Visual Flow Builder Interface
 */
router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flow Builder - Babelfish Looking Glass</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1a1a1a;
            color: #ffffff;
            overflow: hidden;
        }

        .header {
            background: #2d2d2d;
            padding: 1rem;
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h1 {
            color: #00d4ff;
            font-size: 1.5rem;
        }

        .toolbar {
            display: flex;
            gap: 1rem;
        }

        .btn {
            background: #00d4ff;
            color: #000;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background 0.2s;
        }

        .btn:hover {
            background: #00b8e6;
        }

        .btn.secondary {
            background: #444;
            color: #fff;
        }

        .btn.secondary:hover {
            background: #555;
        }

        .main-container {
            display: flex;
            height: calc(100vh - 80px);
        }

        .sidebar {
            width: 300px;
            background: #2d2d2d;
            border-right: 1px solid #444;
            display: flex;
            flex-direction: column;
        }

        .sidebar-section {
            padding: 1rem;
            border-bottom: 1px solid #444;
        }

        .sidebar-section h3 {
            color: #00d4ff;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .node-palette {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.5rem;
        }

        .node-item {
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.75rem;
            cursor: grab;
            transition: all 0.2s;
            user-select: none;
        }

        .node-item:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }

        .node-item.dragging {
            opacity: 0.5;
        }

        .node-item h4 {
            color: #00d4ff;
            font-size: 0.8rem;
            margin-bottom: 0.25rem;
        }

        .node-item p {
            font-size: 0.7rem;
            color: #ccc;
        }

        .flow-canvas {
            flex: 1;
            background: #1a1a1a;
            position: relative;
            overflow: auto;
        }

        .canvas-grid {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 20px 20px;
        }

        .flow-node {
            position: absolute;
            background: #3d3d3d;
            border: 2px solid #555;
            border-radius: 8px;
            padding: 1rem;
            min-width: 150px;
            cursor: move;
            user-select: none;
            transition: all 0.2s;
        }

        .flow-node:hover {
            border-color: #00d4ff;
            box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }

        .flow-node.selected {
            border-color: #00d4ff;
            box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
        }

        .flow-node.trigger {
            border-color: #ff6b6b;
        }

        .flow-node.action {
            border-color: #4ecdc4;
        }

        .flow-node.condition {
            border-color: #ffe66d;
        }

        .node-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .node-title {
            font-weight: 600;
            font-size: 0.9rem;
            color: #fff;
        }

        .node-type {
            font-size: 0.7rem;
            color: #888;
            text-transform: uppercase;
        }

        .node-content {
            font-size: 0.8rem;
            color: #ccc;
        }

        .properties-panel {
            width: 300px;
            background: #2d2d2d;
            border-left: 1px solid #444;
            padding: 1rem;
            overflow-y: auto;
        }

        .properties-panel h3 {
            color: #00d4ff;
            margin-bottom: 1rem;
            font-size: 1rem;
        }

        .property-group {
            margin-bottom: 1rem;
        }

        .property-group label {
            display: block;
            font-size: 0.8rem;
            color: #ccc;
            margin-bottom: 0.25rem;
        }

        .property-group input,
        .property-group select,
        .property-group textarea {
            width: 100%;
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.5rem;
            color: #fff;
            font-size: 0.8rem;
        }

        .property-group input:focus,
        .property-group select:focus,
        .property-group textarea:focus {
            outline: none;
            border-color: #00d4ff;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
        }

        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 2rem;
            min-width: 400px;
        }

        .modal h2 {
            color: #00d4ff;
            margin-bottom: 1rem;
        }

        .modal-buttons {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            margin-top: 1rem;
        }

        .template-list {
            max-height: 300px;
            overflow-y: auto;
        }

        .template-item {
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 1rem;
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .template-item:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }

        .template-item h4 {
            color: #00d4ff;
            margin-bottom: 0.25rem;
        }

        .template-item p {
            font-size: 0.8rem;
            color: #ccc;
        }

        .flow-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .flow-item {
            background: #3d3d3d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .flow-item:hover {
            background: #4d4d4d;
            border-color: #00d4ff;
        }

        .flow-item h4 {
            color: #00d4ff;
            margin-bottom: 0.25rem;
        }

        .flow-item p {
            font-size: 0.7rem;
            color: #ccc;
            margin-bottom: 0.5rem;
        }

        .flow-status {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #555;
        }

        .status-indicator.enabled {
            background: #4ecdc4;
        }

        .status-indicator.executing {
            background: #ffe66d;
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔗 Flow Builder</h1>
        <div class="toolbar">
            <button class="btn" onclick="newFlow()">New Flow</button>
            <button class="btn" onclick="saveFlow()">Save Flow</button>
            <button class="btn" onclick="loadFlow()">Load Flow</button>
            <button class="btn secondary" onclick="showTemplates()">Templates</button>
            <button class="btn secondary" onclick="window.location.href='/'">Back to Dashboard</button>
        </div>
    </div>

    <div class="main-container">
        <div class="sidebar">
            <div class="sidebar-section">
                <h3>Node Palette</h3>
                <div class="node-palette">
                    <div class="node-item" draggable="true" data-type="trigger" data-node-type="smartDetectLoiterZone">
                        <h4>Loitering Trigger</h4>
                        <p>Detect loitering events</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="trigger" data-node-type="motion">
                        <h4>Motion Trigger</h4>
                        <p>Detect motion events</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="trigger" data-node-type="smartDetectZone">
                        <h4>Zone Trigger</h4>
                        <p>Detect zone events</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="action" data-action-type="connector_execute">
                        <h4>Get Snapshot</h4>
                        <p>Get camera snapshot</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="action" data-action-type="telegram_send">
                        <h4>Send Telegram</h4>
                        <p>Send message to Telegram</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="action" data-action-type="send_notification">
                        <h4>Send Notification</h4>
                        <p>Send system notification</p>
                    </div>
                    <div class="node-item" draggable="true" data-type="condition">
                        <h4>Condition</h4>
                        <p>Check conditions</p>
                    </div>
                </div>
            </div>

            <div class="sidebar-section">
                <h3>Flows</h3>
                <div class="flow-list" id="flowList">
                    <!-- Flows will be loaded here -->
                </div>
            </div>
        </div>

        <div class="flow-canvas" id="flowCanvas">
            <div class="canvas-grid"></div>
            <!-- Flow nodes will be added here -->
        </div>

        <div class="properties-panel" id="propertiesPanel">
            <h3>Properties</h3>
            <div id="propertiesContent">
                <p style="color: #888; font-size: 0.8rem;">Select a node to edit its properties</p>
            </div>
        </div>
    </div>

    <!-- Templates Modal -->
    <div class="modal" id="templatesModal">
        <div class="modal-content">
            <h2>Flow Templates</h2>
            <div class="template-list" id="templateList">
                <!-- Templates will be loaded here -->
            </div>
            <div class="modal-buttons">
                <button class="btn secondary" onclick="closeModal('templatesModal')">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Load Flow Modal -->
    <div class="modal" id="loadFlowModal">
        <div class="modal-content">
            <h2>Load Flow</h2>
            <div class="flow-list" id="loadFlowList">
                <!-- Flows will be loaded here -->
            </div>
            <div class="modal-buttons">
                <button class="btn secondary" onclick="closeModal('loadFlowModal')">Cancel</button>
            </div>
        </div>
    </div>

    <script>
        // Global variables
        let currentFlow = {
            id: null,
            name: 'New Flow',
            description: '',
            nodes: [],
            connections: [],
            config: {}
        };
        
        let selectedNode = null;

        // Initialize the flow builder
        document.addEventListener('DOMContentLoaded', function() {
            initializeFlowBuilder();
            loadFlows();
            loadTemplates();
        });

        function initializeFlowBuilder() {
            setupDragAndDrop();
            setupCanvasEvents();
        }

        function setupDragAndDrop() {
            const nodeItems = document.querySelectorAll('.node-item');
            const canvas = document.getElementById('flowCanvas');

            nodeItems.forEach(item => {
                item.addEventListener('dragstart', handleDragStart);
                item.addEventListener('dragend', handleDragEnd);
            });

            canvas.addEventListener('dragover', handleDragOver);
            canvas.addEventListener('drop', handleDrop);
        }

        function handleDragStart(e) {
            e.target.classList.add('dragging');
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
        }

        function handleDragOver(e) {
            e.preventDefault();
        }

        function handleDrop(e) {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const draggingNode = document.querySelector('.node-item.dragging');
            if (draggingNode) {
                createNode(draggingNode, x, y);
            }
        }

        function createNode(nodeElement, x, y) {
            const nodeId = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            let nodeConfig = {
                id: nodeId,
                type: nodeElement.dataset.type,
                name: nodeElement.querySelector('h4').textContent,
                position: { x, y },
                config: {}
            };

            if (nodeElement.dataset.type === 'trigger') {
                nodeConfig.config.eventType = nodeElement.dataset.nodeType;
            } else if (nodeElement.dataset.type === 'action') {
                nodeConfig.config.actionType = nodeElement.dataset.actionType;
            }

            currentFlow.nodes.push(nodeConfig);
            renderNode(nodeConfig);
        }

        function renderNode(node) {
            const canvas = document.getElementById('flowCanvas');
            const nodeElement = document.createElement('div');
            nodeElement.className = \`flow-node \${node.type}\`;
            nodeElement.id = node.id;
            nodeElement.style.left = node.position.x + 'px';
            nodeElement.style.top = node.position.y + 'px';

            nodeElement.innerHTML = \`
                <div class="node-header">
                    <div class="node-title">\${node.name}</div>
                    <div class="node-type">\${node.type}</div>
                </div>
                <div class="node-content">
                    \${getNodeContent(node)}
                </div>
            \`;

            canvas.appendChild(nodeElement);
            setupNodeEvents(nodeElement);
        }

        function getNodeContent(node) {
            if (node.type === 'trigger') {
                return \`Event: \${node.config.eventType || 'Unknown'}\`;
            } else if (node.type === 'action') {
                return \`Action: \${node.config.actionType || 'Unknown'}\`;
            } else {
                return 'Condition check';
            }
        }

        function setupNodeEvents(nodeElement) {
            nodeElement.addEventListener('click', (e) => {
                e.stopPropagation();
                selectNode(nodeElement);
            });

            nodeElement.addEventListener('mousedown', (e) => {
                startNodeDrag(nodeElement, e);
            });
        }

        function selectNode(nodeElement) {
            // Remove previous selection
            document.querySelectorAll('.flow-node').forEach(node => {
                node.classList.remove('selected');
            });

            // Select new node
            nodeElement.classList.add('selected');
            selectedNode = currentFlow.nodes.find(n => n.id === nodeElement.id);
            showNodeProperties(selectedNode);
        }

        function showNodeProperties(node) {
            const panel = document.getElementById('propertiesContent');
            
            if (!node) {
                panel.innerHTML = '<p style="color: #888; font-size: 0.8rem;">Select a node to edit its properties</p>';
                return;
            }

            let html = \`
                <div class="property-group">
                    <label>Name</label>
                    <input type="text" value="\${node.name}" onchange="updateNodeProperty('\${node.id}', 'name', this.value)">
                </div>
            \`;

            if (node.type === 'trigger') {
                html += \`
                    <div class="property-group">
                        <label>Event Type</label>
                        <select onchange="updateNodeProperty('\${node.id}', 'config.eventType', this.value)">
                            <option value="smartDetectLoiterZone" \${node.config.eventType === 'smartDetectLoiterZone' ? 'selected' : ''}>Loitering Detection</option>
                            <option value="motion" \${node.config.eventType === 'motion' ? 'selected' : ''}>Motion Detection</option>
                            <option value="smartDetectZone" \${node.config.eventType === 'smartDetectZone' ? 'selected' : ''}>Zone Detection</option>
                        </select>
                    </div>
                \`;
            } else if (node.type === 'action') {
                html += \`
                    <div class="property-group">
                        <label>Action Type</label>
                        <select onchange="updateNodeProperty('\${node.id}', 'config.actionType', this.value)">
                            <option value="connector_execute" \${node.config.actionType === 'connector_execute' ? 'selected' : ''}>Get Snapshot</option>
                            <option value="telegram_send" \${node.config.actionType === 'telegram_send' ? 'selected' : ''}>Send Telegram</option>
                            <option value="send_notification" \${node.config.actionType === 'send_notification' ? 'selected' : ''}>Send Notification</option>
                        </select>
                    </div>
                \`;
            }

            panel.innerHTML = html;
        }

        function updateNodeProperty(nodeId, property, value) {
            const node = currentFlow.nodes.find(n => n.id === nodeId);
            if (!node) return;

            if (property.includes('.')) {
                const parts = property.split('.');
                let current = node;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            } else {
                node[property] = value;
            }

            // Update node display
            const nodeElement = document.getElementById(nodeId);
            if (nodeElement) {
                const titleElement = nodeElement.querySelector('.node-title');
                const contentElement = nodeElement.querySelector('.node-content');
                
                if (titleElement) titleElement.textContent = node.name;
                if (contentElement) contentElement.textContent = getNodeContent(node);
            }
        }

        function startNodeDrag(nodeElement, e) {
            const startX = e.clientX - nodeElement.offsetLeft;
            const startY = e.clientY - nodeElement.offsetTop;

            function onMouseMove(e) {
                const newX = e.clientX - startX;
                const newY = e.clientY - startY;
                
                nodeElement.style.left = newX + 'px';
                nodeElement.style.top = newY + 'px';
                
                // Update node position in data
                const node = currentFlow.nodes.find(n => n.id === nodeElement.id);
                if (node) {
                    node.position = { x: newX, y: newY };
                }
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        function setupCanvasEvents() {
            const canvas = document.getElementById('flowCanvas');
            
            canvas.addEventListener('click', (e) => {
                if (e.target === canvas) {
                    selectedNode = null;
                    showNodeProperties(null);
                    document.querySelectorAll('.flow-node').forEach(node => {
                        node.classList.remove('selected');
                    });
                }
            });
        }

        // Flow management functions
        function newFlow() {
            currentFlow = {
                id: null,
                name: 'New Flow',
                description: '',
                nodes: [],
                connections: [],
                config: {}
            };
            
            // Clear canvas
            const canvas = document.getElementById('flowCanvas');
            canvas.innerHTML = '<div class="canvas-grid"></div>';
            
            selectedNode = null;
            showNodeProperties(null);
        }

        async function saveFlow() {
            if (!currentFlow.name) {
                alert('Please enter a flow name');
                return;
            }

            try {
                const response = await fetch('/api/flows', {
                    method: currentFlow.id ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(currentFlow)
                });

                const result = await response.json();
                
                if (result.success) {
                    currentFlow = result.data;
                    alert('Flow saved successfully!');
                    loadFlows();
                } else {
                    alert('Error saving flow: ' + result.error);
                }
            } catch (error) {
                alert('Error saving flow: ' + error.message);
            }
        }

        function loadFlow() {
            showModal('loadFlowModal');
        }

        async function loadFlowById(flowId) {
            try {
                const response = await fetch(\`/api/flows/\${flowId}\`);
                const result = await response.json();
                
                if (result.success) {
                    currentFlow = result.data;
                    
                    // Clear canvas
                    const canvas = document.getElementById('flowCanvas');
                    canvas.innerHTML = '<div class="canvas-grid"></div>';
                    
                    // Render nodes
                    currentFlow.nodes.forEach(node => renderNode(node));
                    
                    closeModal('loadFlowModal');
                } else {
                    alert('Error loading flow: ' + result.error);
                }
            } catch (error) {
                alert('Error loading flow: ' + error.message);
            }
        }

        async function loadFlows() {
            try {
                const response = await fetch('/api/flows');
                const result = await response.json();
                
                if (result.success) {
                    const flowList = document.getElementById('flowList');
                    flowList.innerHTML = '';
                    
                    result.data.forEach(flow => {
                        const flowItem = document.createElement('div');
                        flowItem.className = 'flow-item';
                        flowItem.innerHTML = \`
                            <h4>\${flow.name}</h4>
                            <p>\${flow.description || 'No description'}</p>
                            <div class="flow-status">
                                <div class="status-indicator \${flow.enabled ? 'enabled' : ''}"></div>
                                <span>\${flow.enabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        \`;
                        flowItem.onclick = () => loadFlowById(flow.id);
                        flowList.appendChild(flowItem);
                    });
                }
            } catch (error) {
                console.error('Error loading flows:', error);
            }
        }

        async function loadTemplates() {
            try {
                const response = await fetch('/api/flows/templates');
                const result = await response.json();
                
                if (result.success) {
                    const templateList = document.getElementById('templateList');
                    templateList.innerHTML = '';
                    
                    result.data.forEach(template => {
                        const templateItem = document.createElement('div');
                        templateItem.className = 'template-item';
                        templateItem.innerHTML = \`
                            <h4>\${template.name}</h4>
                            <p>\${template.description}</p>
                        \`;
                        templateItem.onclick = () => createFromTemplate(template.id);
                        templateList.appendChild(templateItem);
                    });
                }
            } catch (error) {
                console.error('Error loading templates:', error);
            }
        }

        async function createFromTemplate(templateId) {
            try {
                const response = await fetch(\`/api/flows/template/\${templateId}\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'Copy of ' + templateId,
                        description: 'Created from template'
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    currentFlow = result.data;
                    
                    // Clear canvas
                    const canvas = document.getElementById('flowCanvas');
                    canvas.innerHTML = '<div class="canvas-grid"></div>';
                    
                    // Render nodes
                    currentFlow.nodes.forEach(node => renderNode(node));
                    
                    closeModal('templatesModal');
                    loadFlows();
                } else {
                    alert('Error creating from template: ' + result.error);
                }
            } catch (error) {
                alert('Error creating from template: ' + error.message);
            }
        }

        function showTemplates() {
            showModal('templatesModal');
        }

        function showModal(modalId) {
            document.getElementById(modalId).style.display = 'block';
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        // Close modals when clicking outside
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = 'none';
            }
        }
    </script>
</body>
</html>
  `);
});

module.exports = router; 