const connectToReloader = () => {
  const ws = new WebSocket('ws://localhost:8087');

  console.log('Vencord Extension Auto-Reloader');

  ws.onopen = () => console.log('Connected to Vencord Extension Auto-Reloader');

  ws.onmessage = (event) => {
    if (event.data === 'reload') {
      console.log('Reload signal received. Reloading extension...');
      chrome.runtime.reload();
    }
  };

  // Reconnect if the connection drops (e.g., if build script restarts)
  ws.onclose = () => {
    setTimeout(connectToReloader, 1000);
  };
};

connectToReloader();
