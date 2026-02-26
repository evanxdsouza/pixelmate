// Background service worker for PixelMate Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('PixelMate extension installed');
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getPageInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          title: tabs[0].title,
          url: tabs[0].url,
          id: tabs[0].id
        });
      }
    });
    return true;
  }
  
  if (request.type === 'executeScript') {
    chrome.scripting.executeScript({
      target: { tabId: request.tabId },
      func: request.script
    }, (results) => {
      sendResponse(results);
    });
    return true;
  }
});
