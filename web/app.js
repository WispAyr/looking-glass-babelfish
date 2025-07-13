document.addEventListener('DOMContentLoaded', () => {
    const connectorList = document.getElementById('connector-list');

    // Fetch connector data from the API
    fetch('/api/connectors')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const connectors = data.data;
                connectors.forEach(connector => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${connector.name} (${connector.type}) - ${connector.status}`;
                    connectorList.appendChild(listItem);
                });
            }
        });
});
