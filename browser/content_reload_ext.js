const connectToReloader = () => {
  const ws = new WebSocket('ws://localhost:8087');
  console.log('Vencord Extension Auto-Reloader');

  ws.onopen = () => {
    console.log('Connected to Vencord Extension Auto-Reloader');
  };

  ws.onmessage = (event) => {
    // Ignore the heartbeat pings from esbuild server
    if (event.data === 'ping') return;

    if (event.data === 'reload') {
      console.log('Reloading extension and refreshing page...');

      try {
        // 1. Send a message to wake up the background script and reload the extension
        chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
      } catch (err) {
        // If the extension context is already invalid, this might throw, which is fine
      }

      // 2. Reload the actual web page to inject the newly compiled content scripts
      setTimeout(() => {
        window.location.reload();
      }, 200);
    }
  };

  ws.onclose = () => {
    // Since the web page stays alive, this timeout will reliably execute
    setTimeout(connectToReloader, 1000);
  };
};

connectToReloader();
