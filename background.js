// background.js - Service Worker for managing scraping process

let scrapingState = {
  isRunning: false,
  pageCount: 0,
  charCount: 0,
  scrapedData: [],
  logs: [],
  currentTabId: null,
  settings: {
    delay: 2000,
    maxPages: 10
  }
};

// Initialize state from storage on startup
chrome.storage.local.get(['scraperState'], function(result) {
  if (result.scraperState) {
    scrapingState = { ...scrapingState, ...result.scraperState };
    // Reset running state on startup (in case browser was closed while running)
    scrapingState.isRunning = false;
    saveState();
  }
});

// Save state to storage
function saveState() {
  chrome.storage.local.set({ scraperState: scrapingState });
  // Notify popup of state change
  chrome.runtime.sendMessage({ action: 'stateUpdate', state: scrapingState }).catch(() => {
    // Popup might be closed, ignore error
  });
}

// Add log entry
function addLog(message, type = 'normal') {
  const log = { message, type, timestamp: Date.now() };
  scrapingState.logs.push(log);
  // Keep only last 50 logs
  if (scrapingState.logs.length > 50) {
    scrapingState.logs.shift();
  }
  saveState();
  console.log(`[Scraper] ${message}`);
}

// Message listener
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.action) {
    case 'startScraping':
      startScraping(message.tabId, message.settings);
      sendResponse({ success: true });
      break;
    
    case 'stopScraping':
      stopScraping();
      sendResponse({ success: true });
      break;
    
    case 'pageScraped':
      handlePageScraped(message.data);
      sendResponse({ success: true });
      break;
    
    case 'nextClicked':
      addLog(`Navigating to page ${scrapingState.pageCount + 1}...`, 'info');
      sendResponse({ success: true });
      break;
    
    case 'noNextButton':
      handleNoNextButton();
      sendResponse({ success: true });
      break;
    
    case 'scrapingError':
      addLog(`Error: ${message.error}`, 'error');
      sendResponse({ success: true });
      break;
    
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep the message channel open for async response
});

// Start the scraping process
function startScraping(tabId, settings) {
  scrapingState.isRunning = true;
  scrapingState.pageCount = 0;
  scrapingState.charCount = 0;
  scrapingState.scrapedData = [];
  scrapingState.logs = [];
  scrapingState.currentTabId = tabId;
  scrapingState.settings = settings;
  
  addLog('Starting scraping process...', 'info');
  saveState();
  
  // Inject content script and start scraping
  executeScrapingOnTab(tabId);
}

// Execute scraping on the current tab
function executeScrapingOnTab(tabId) {
  if (!scrapingState.isRunning) {
    return;
  }
  
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: scrapeAndClickNext,
    args: [scrapingState.settings]
  }).catch(error => {
    addLog(`Failed to execute script: ${error.message}`, 'error');
    stopScraping();
  });
}

// This function runs in the page context
function scrapeAndClickNext(settings) {
  // Function to extract visible text from the page
  function extractPageText() {
    const searchResults = document.querySelectorAll('#search .g, #rso .g, .MjjYud');
    let texts = [];
    
    // Get the search query
    const searchInput = document.querySelector('input[name="q"], textarea[name="q"]');
    const query = searchInput ? searchInput.value : 'Unknown Query';
    
    // Get current page number
    const currentPage = document.querySelector('td.YyVfkd')?.textContent || '1';
    
    texts.push(`=== Search Query: ${query} ===`);
    texts.push(`=== Page ${currentPage} ===\n`);
    
    // Extract from search results
    if (searchResults.length > 0) {
      searchResults.forEach((result, index) => {
        // Get title
        const titleEl = result.querySelector('h3');
        const title = titleEl ? titleEl.textContent.trim() : '';
        
        // Get URL
        const linkEl = result.querySelector('a[href^="http"]');
        const url = linkEl ? linkEl.href : '';
        
        // Get snippet/description
        const snippetEl = result.querySelector('.VwiC3b, .IsZvec, [data-sncf], .s3v9rd');
        const snippet = snippetEl ? snippetEl.textContent.trim() : '';
        
        if (title || snippet) {
          texts.push(`[Result ${index + 1}]`);
          if (title) texts.push(`Title: ${title}`);
          if (url) texts.push(`URL: ${url}`);
          if (snippet) texts.push(`Description: ${snippet}`);
          texts.push('');
        }
      });
    }
    
    // If no structured results found, get all visible text
    if (texts.length <= 2) {
      const mainContent = document.querySelector('#main, #center_col, #search');
      if (mainContent) {
        texts.push(mainContent.innerText);
      }
    }
    
    return texts.join('\n');
  }
  
  // Function to find and click the Next button
  function findNextButton() {
    // Multiple selectors for the Next button based on the screenshot
    const selectors = [
      'a#pnnext',                           // Standard Next button ID
      'a[aria-label="Next page"]',          // Aria label
      'a[aria-label="Next"]',               // Shortened aria label
      'span.SJajHc.NVbCr ~ span',           // Near the Google logo pagination
      'a:has(span:contains("Next"))',       // Link containing Next text
      'td a[href*="start="]',               // Pagination links
      '.d6cvqb a#pnnext',                   // Next in pagination container
      'a.fl[href*="start="]',               // Pagination footer links
    ];
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          // Verify it's actually a "Next" button
          const text = element.textContent.toLowerCase();
          const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
          if (text.includes('next') || ariaLabel.includes('next') || element.id === 'pnnext') {
            return element;
          }
        }
      } catch (e) {
        // Some selectors might not be valid, continue
      }
    }
    
    // Last resort: find by text content
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      const text = link.textContent.trim().toLowerCase();
      if (text === 'next' || text === 'next ›' || text === '›') {
        // Make sure it's in the pagination area
        const isInPagination = link.closest('table') || 
                              link.closest('.AaVjTc') || 
                              link.closest('#foot') ||
                              link.closest('nav');
        if (isInPagination || link.id === 'pnnext') {
          return link;
        }
      }
    }
    
    // Check for the span with "Next" text shown in screenshot
    const nextSpan = document.querySelector('span.oeN89d');
    if (nextSpan && nextSpan.textContent.includes('Next')) {
      const parentLink = nextSpan.closest('a');
      if (parentLink) {
        return parentLink;
      }
    }
    
    return null;
  }
  
  // Main execution
  const pageText = extractPageText();
  
  // Send scraped data to background
  chrome.runtime.sendMessage({
    action: 'pageScraped',
    data: pageText
  });
  
  // Wait for the specified delay before clicking next
  setTimeout(() => {
    const nextButton = findNextButton();
    
    if (nextButton) {
      chrome.runtime.sendMessage({ action: 'nextClicked' });
      nextButton.click();
    } else {
      chrome.runtime.sendMessage({ action: 'noNextButton' });
    }
  }, settings.delay);
}

// Handle scraped page data
function handlePageScraped(data) {
  if (!scrapingState.isRunning) {
    return;
  }
  
  scrapingState.pageCount++;
  scrapingState.charCount += data.length;
  scrapingState.scrapedData.push(data);
  
  addLog(`Page ${scrapingState.pageCount} scraped (${data.length} chars)`, 'info');
  saveState();
  
  // Check if we've reached max pages
  if (scrapingState.pageCount >= scrapingState.settings.maxPages) {
    addLog(`Reached maximum pages (${scrapingState.settings.maxPages})`, 'info');
    stopScraping();
  }
}

// Handle when no Next button is found
function handleNoNextButton() {
  addLog('No more pages found - scraping complete!', 'info');
  stopScraping();
}

// Stop the scraping process
function stopScraping() {
  scrapingState.isRunning = false;
  scrapingState.currentTabId = null;
  addLog(`Scraping finished. Total: ${scrapingState.pageCount} pages, ${scrapingState.charCount} characters`, 'info');
  saveState();
}

// Listen for tab updates to continue scraping after navigation
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (scrapingState.isRunning && 
      tabId === scrapingState.currentTabId && 
      changeInfo.status === 'complete' &&
      tab.url && tab.url.includes('google.com/search')) {
    
    // Wait a bit for the page to fully render
    setTimeout(() => {
      if (scrapingState.isRunning) {
        executeScrapingOnTab(tabId);
      }
    }, 500);
  }
});
