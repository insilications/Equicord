const connectToReloader = (retryDelay = 1000) => {
  const ws = new WebSocket('ws://localhost:8087');

  ws.onopen = () => {
    console.log('Connected to Vencord Extension Auto-Reloader');
    // Reset delay on successful connection
    retryDelay = 2000;
  };

  // Catch the async error so it doesn't cause unhandled exception warnings
  // (Note: The browser will still log a native net::ERR_CONNECTION_REFUSED warning,
  // which is unavoidable, but our code will handle it cleanly).
  ws.onerror = () => {
    console.debug('Vencord Extension Auto-Reloader server is currently unreachable.');
  };

  ws.onmessage = (event) => {
    if (event.data === 'ping') return;

    if (event.data === 'reload') {
      console.log('Reloading extension and refreshing page...');

      try {
        chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
      } catch (err) {
        // Expected if extension context was invalidated by Chrome
      }

      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  };

  ws.onclose = () => {
    // Exponential backoff: increase the delay slightly each time it fails,
    // capping out at a maximum of 5 seconds between attempts.
    const nextDelay = Math.min(retryDelay * 1.5, 5000);

    setTimeout(() => {
      connectToReloader(nextDelay);
    }, retryDelay);
  };
};

connectToReloader();
