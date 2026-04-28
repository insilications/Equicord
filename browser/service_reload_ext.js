// This listener forces the Service Worker to wake up when a message is received
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'RELOAD_EXTENSION') {
    console.log('Reload signal received. Reloading...');
    chrome.runtime.reload();
  }
});
