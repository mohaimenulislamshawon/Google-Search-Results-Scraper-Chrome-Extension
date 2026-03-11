# Google Search Results Scraper - Chrome Extension

A Chrome extension that automatically scrapes all Google search result pages by clicking "Next" until no more pages exist.

## Features

- 🔍 **Auto-scrape**: Automatically extracts text from all search result pages
- ⏭️ **Auto-navigate**: Clicks "Next" button automatically until no more pages
- 📊 **Progress tracking**: Shows pages scraped and total characters collected
- ⚙️ **Configurable**: Set delay between pages and maximum pages to scrape
- 📋 **One-click copy**: Copy all scraped data to clipboard
- 📝 **Live logging**: See real-time progress in the log console

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `google-scraper-extension` folder
5. The extension icon will appear in your toolbar

## Usage

1. **Navigate to Google** and perform a search
2. **Click the extension icon** in your toolbar
3. **Configure settings** (optional):
   - **Delay between pages**: Time to wait before clicking Next (default: 2000ms)
   - **Max pages to scrape**: Maximum number of pages to collect (default: 10)
4. **Click "Start Scraping"** to begin
5. **Watch the progress** in the log console
6. When complete, click **"Copy All Data"** to copy everything to your clipboard

## What Gets Scraped

For each search result page, the extension captures:
- Search query
- Page number
- For each result:
  - Title
  - URL
  - Description/snippet
- "People Also Ask" questions (if present)
- Related searches (if present)

## Settings

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| Delay between pages | Milliseconds to wait after scraping before clicking Next | 2000 | 500-10000 |
| Max pages to scrape | Maximum number of pages to collect | 10 | 1-100 |

## Tips

- **Increase delay** if pages aren't loading fast enough (slow internet)
- **Decrease delay** if you want faster scraping (be careful not to trigger rate limits)
- Google typically has ~10 results per page, so 10 pages = ~100 results
- The extension automatically stops when:
  - No "Next" button is found
  - Maximum pages reached
  - You click "Stop"

## Output Format

```
==================================================
SEARCH QUERY: your search term
PAGE: 1
==================================================

--- Result #1 ---
Title: Example Title
URL: https://example.com
Snippet: This is the description text...

--- Result #2 ---
...

--- PAGE BREAK ---

==================================================
SEARCH QUERY: your search term
PAGE: 2
==================================================
...
```

## Troubleshooting

### Extension not working?
- Make sure you're on a Google search results page (`google.com/search?q=...`)
- Try refreshing the page
- Check that the extension has permissions for google.com

### Next button not being found?
- Google occasionally changes their HTML structure
- Try increasing the delay
- Check the browser console for errors

### Data not copying?
- Make sure you've scraped at least one page
- Try clicking "Copy All Data" again
- Check browser permissions for clipboard access

## File Structure

```
google-scraper-extension/
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic
├── background.js      # Service worker (scraping logic)
├── content.js         # Content script (DOM access)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Privacy

- This extension only runs on Google search pages
- All data is stored locally in your browser
- No data is sent to any external servers
- You control when to start/stop scraping

## License

MIT License - Feel free to modify and distribute.
