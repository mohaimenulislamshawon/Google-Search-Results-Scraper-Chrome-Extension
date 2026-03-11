// popup.js - Handles the extension popup UI

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const copyBtn = document.getElementById('copyBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const pageCountEl = document.getElementById('pageCount');
  const charCountEl = document.getElementById('charCount');
  const progressFill = document.getElementById('progressFill');
  const logContainer = document.getElementById('logContainer');
  const delayInput = document.getElementById('delayInput');
  const maxPagesInput = document.getElementById('maxPagesInput');
  const warning = document.getElementById('warning');
  const copiedToast = document.getElementById('copiedToast');

  // Load saved state on popup open
  loadState();

  // Check if we're on a Google search page
  checkCurrentPage();

  // Event Listeners
  startBtn.addEventListener('click', startScraping);
  stopBtn.addEventListener('click', stopScraping);
  copyBtn.addEventListener('click', copyData);
  clearBtn.addEventListener('click', clearData);

  // Load saved state from storage
  function loadState() {
    chrome.storage.local.get(['scraperState'], function(result) {
      if (result.scraperState) {
        const state = result.scraperState;
        updateUI(state);
      }
    });
  }

  // Check if current tab is a Google search page
  function checkCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) {
        showWarning(true);
        startBtn.disabled = true;
        return;
      }

      const isGoogleSearch = currentTab.url.includes('google.com/search');
      showWarning(!isGoogleSearch);
      startBtn.disabled = !isGoogleSearch;
    });
  }

  // Show/hide warning
  function showWarning(show) {
    warning.classList.toggle('show', show);
  }

  // Update UI based on state
  function updateUI(state) {
    // Update status
    statusEl.textContent = state.isRunning ? 'Running...' : (state.pageCount > 0 ? 'Completed' : 'Idle');
    statusEl.className = 'status-value ' + (state.isRunning ? 'running' : (state.pageCount > 0 ? 'stopped' : 'idle'));

    // Update counts
    pageCountEl.textContent = state.pageCount || 0;
    charCountEl.textContent = formatNumber(state.charCount || 0);

    // Update progress bar
    const maxPages = parseInt(maxPagesInput.value) || 10;
    const progress = Math.min((state.pageCount / maxPages) * 100, 100);
    progressFill.style.width = progress + '%';

    // Update buttons
    startBtn.disabled = state.isRunning;
    stopBtn.disabled = !state.isRunning;
    copyBtn.disabled = !state.scrapedData || state.scrapedData.length === 0;

    // Update logs
    if (state.logs && state.logs.length > 0) {
      logContainer.innerHTML = '';
      state.logs.forEach(log => {
        addLogEntry(log.message, log.type, false);
      });
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  // Format large numbers
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Add log entry to the log container
  function addLogEntry(message, type = 'normal', save = true) {
    const entry = document.createElement('div');
    entry.className = 'log-entry' + (type !== 'normal' ? ' ' + type : '');
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // Start the scraping process
  function startScraping() {
    const delay = parseInt(delayInput.value) || 2000;
    const maxPages = parseInt(maxPagesInput.value) || 10;

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      
      if (!currentTab || !currentTab.url.includes('google.com/search')) {
        showWarning(true);
        return;
      }

      // Send message to background script to start scraping
      chrome.runtime.sendMessage({
        action: 'startScraping',
        tabId: currentTab.id,
        settings: {
          delay: delay,
          maxPages: maxPages
        }
      }, function(response) {
        if (response && response.success) {
          addLogEntry('Scraping started...', 'info');
          startBtn.disabled = true;
          stopBtn.disabled = false;
          statusEl.textContent = 'Running...';
          statusEl.className = 'status-value running';
        }
      });
    });
  }

  // Stop the scraping process
  function stopScraping() {
    chrome.runtime.sendMessage({ action: 'stopScraping' }, function(response) {
      if (response && response.success) {
        addLogEntry('Scraping stopped by user', 'error');
        loadState();
      }
    });
  }

  // Copy all scraped data to clipboard
  function copyData() {
    chrome.storage.local.get(['scraperState'], function(result) {
      if (result.scraperState && result.scraperState.scrapedData) {
        const allData = result.scraperState.scrapedData.join('\n\n--- PAGE BREAK ---\n\n');
        
        navigator.clipboard.writeText(allData).then(function() {
          // Show toast
          copiedToast.classList.add('show');
          setTimeout(function() {
            copiedToast.classList.remove('show');
          }, 2000);
          addLogEntry('Data copied to clipboard!', 'info');
        }).catch(function(err) {
          addLogEntry('Failed to copy: ' + err, 'error');
        });
      }
    });
  }

  // Clear all stored data
  function clearData() {
    chrome.storage.local.set({
      scraperState: {
        isRunning: false,
        pageCount: 0,
        charCount: 0,
        scrapedData: [],
        logs: []
      }
    }, function() {
      loadState();
      logContainer.innerHTML = '<div class="log-entry info">Data cleared. Ready to scrape...</div>';
    });
  }

  // Listen for state updates from background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'stateUpdate') {
      updateUI(message.state);
    }
  });

  // Periodically refresh state while popup is open
  setInterval(loadState, 1000);
});
