const puppeteer = require('puppeteer');

const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    const matches = priceStr.match(/[\d,.]+/g);
    if (!matches) return 0;
    const prices = matches
        .map(m => parseInt(m.replace(/[^\d]/g, '')))
        .filter(n => !isNaN(n) && n > 0);
    if (prices.length === 0) return 0;
    return Math.min(...prices);
};

const launchOptions = {
    headless: "new",
    args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
};

async function scrapeUrl(url) {
    if (!url) return null;
    const start = Date.now();
    console.log(`[Scraper] 🕷️ Initiating: ${url}`);
    
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        const title = await page.title();
        console.log(`[Scraper] 📄 Page Title: "${title}"`);

        if (title.includes("404") || title.includes("Not Found")) {
            console.error("[Scraper] ❌ 404 Error: Page not found.");
            await browser.close();
            return null;
        }

        let price = 0;
        let inStock = false;
        let vendor = "";
        let rawPriceText = "";

        if (url.includes('mdcomputers.in')) {
            vendor = "mdcomputers";
            rawPriceText = await page.evaluate(() => {
                const el = document.querySelector('.price-new') || 
                           document.querySelector('.product-price') || 
                           document.querySelector('.price') || 
                           document.querySelector('.right-content-product .price');
                return el?.innerText || '0';
            });
            
            inStock = await page.evaluate(() => {
                const btn = document.querySelector('#button-cart');
                const stockStatus = document.querySelector('.stock-status');
                const isOos = stockStatus && stockStatus.innerText.toLowerCase().includes('out of stock');
                return btn && !btn.disabled && btn.style.display !== 'none' && !isOos;
            });
        }
        else if (url.includes('vedantcomputers.com')) {
            vendor = "vedant";
            rawPriceText = await page.evaluate(() => {
                const el = document.querySelector('.product-price') || 
                           document.querySelector('.price-new') || 
                           document.querySelector('.price');
                return el?.innerText || '0';
            });
            inStock = await page.evaluate(() => {
                const btn = document.querySelector('#button-cart');
                return !!btn;
            });
        }
        else if (url.includes('primeabgb.com')) {
            vendor = "primeabgb";
            rawPriceText = await page.evaluate(() => {
                const el = document.querySelector('ins .woocommerce-Price-amount') || 
                           document.querySelector('.price');
                return el?.innerText || '0';
            });
            inStock = await page.evaluate(() => {
                const stockEl = document.querySelector('.stock');
                if (stockEl && stockEl.innerText.toLowerCase().includes('out of stock')) return false;
                return !!document.querySelector('.single_add_to_cart_button');
            });
        }
        else if (url.includes('elitehubs.com')) {
            vendor = "elitehubs";
            rawPriceText = await page.evaluate(() => {
                const el = document.querySelector('.price .woocommerce-Price-amount') || 
                           document.querySelector('.price');
                return el?.innerText || '0';
            });
            inStock = await page.evaluate(() => {
                const stockEl = document.querySelector('.stock');
                if (stockEl && stockEl.innerText.toLowerCase().includes('out of stock')) return false;
                return !!document.querySelector('.single_add_to_cart_button');
            });
        }

        price = parsePrice(rawPriceText);
        console.log(`[Scraper] 💰 Parsed: ₹${price} (Stock: ${inStock}) | Time: ${(Date.now() - start)/1000}s`);

        await browser.close();
        return { vendor, price, inStock };

    } catch (error) {
        console.error(`[Scraper] ❌ Critical Failure: ${error.message}`);
        await browser.close();
        return null;
    }
}

async function scrapeSpecs(url) {
    if (!url) return {};
    console.log(`[Scraper] 📑 Fetching Specs: ${url}`);
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const extractedSpecs = await page.evaluate(() => {
            const specs = {};
            const rows = document.querySelectorAll('tr');
            rows.forEach(row => {
                const cols = row.querySelectorAll('td, th');
                if (cols.length === 2) {
                    const key = cols[0].innerText.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const val = cols[1].innerText.trim();
                    if (key && val && key.length < 30) specs[key] = val;
                }
            });
            return specs;
        });
        await browser.close();
        return extractedSpecs;
    } catch (error) {
        console.error(`[Scraper] ❌ Spec Fetch Error: ${error.message}`);
        await browser.close();
        return {};
    }
}

module.exports = { scrapeUrl, scrapeSpecs };