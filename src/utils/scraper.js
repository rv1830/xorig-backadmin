// src/utils/scraper.js
const puppeteer = require('puppeteer');

// --- SMART PRICE PARSER (FIXED) ---
const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    
    // Step 1: Find all number patterns (e.g., "8,399", "5300")
    // This regex looks for digits that might have commas or dots
    const matches = priceStr.match(/[\d,.]+/g);
    
    if (!matches) return 0;

    // Step 2: Clean them up (remove commas/dots) and convert to Integers
    const prices = matches
        .map(m => parseInt(m.replace(/[^\d]/g, ''))) // "8,399" -> 8399
        .filter(n => !isNaN(n) && n > 0); // Remove garbage

    if (prices.length === 0) return 0;

    // Step 3: Return the LOWEST price found (Standard logic: Selling Price < MRP)
    // If text is "₹8,399 ₹5,300", we want 5300.
    return Math.min(...prices);
};

async function scrapeUrl(url) {
    if (!url) return null;

    console.log(`🕷️ Starting Scrape for: ${url}`);
    
    // Launch Browser
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });
    
    const page = await browser.newPage();
    
    // Headers setup
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
    });

    try {
        // Increased timeout to 90s just in case network is slow
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

        const title = await page.title();
        // Console log removed to keep logs clean, only errors shown
        if (title.includes("404") || title.includes("Not Found")) {
            console.error("❌ Error: Page 404 Not Found");
            await browser.close();
            return null;
        }

        let price = 0;
        let inStock = false;
        let vendor = "";

        // --- STRATEGY 1: MDComputers ---
        if (url.includes('mdcomputers.in')) {
            vendor = "mdcomputers";

            // Selector Logic
            const priceText = await page.evaluate(() => {
                // Priority 1: Special Price (New Layout)
                const el1 = document.querySelector('.price-new'); 
                // Priority 2: Product Price ID
                const el2 = document.querySelector('.product-price');
                // Priority 3: Generic Price Container (Often contains both old & new)
                const el3 = document.querySelector('.price');
                // Priority 4: Search inside right-content
                const el4 = document.querySelector('.right-content-product .price');

                if (el1) return el1.innerText;
                if (el2) return el2.innerText;
                if (el3) return el3.innerText;
                if (el4) return el4.innerText;
                
                return '0';
            });

            // Parse using the new Smart Parser
            price = parsePrice(priceText);

            // Stock Logic
            inStock = await page.evaluate(() => {
                const btn = document.querySelector('#button-cart');
                const stockStatus = document.querySelector('.stock-status');
                const isOosText = stockStatus && stockStatus.innerText.toLowerCase().includes('out of stock');
                
                return btn && !btn.disabled && btn.style.display !== 'none' && !isOosText;
            });
        }

        // --- STRATEGY 2: Vedant Computers ---
        else if (url.includes('vedantcomputers.com')) {
            vendor = "vedant";
            
            const priceText = await page.evaluate(() => {
                const el = document.querySelector('.product-price') || 
                           document.querySelector('.price-new') || 
                           document.querySelector('.price');
                return el?.innerText || '0';
            });
            
            price = parsePrice(priceText);

            inStock = await page.evaluate(() => {
                const btn = document.querySelector('#button-cart');
                return !!btn;
            });
        }

        console.log(`🏁 Scrape Result -> Price: ${price}, Stock: ${inStock}`);

        await browser.close();
        return { vendor, price, inStock };

    } catch (error) {
        console.error(`❌ CRITICAL ERROR scraping ${url}:`, error.message);
        await browser.close();
        return null;
    }
}

module.exports = { scrapeUrl };