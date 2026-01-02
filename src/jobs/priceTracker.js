// src/jobs/priceTracker.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Ensure the path to scraper is correct based on your folder structure
const { scrapeUrl } = require('../utils/scraper'); 

async function processSingleLink(link) {
    try {
        console.log(`[Job] 🔎 Processing: ${link.externalUrl}`);
        
        // 1. Scrape Data
        const data = await scrapeUrl(link.externalUrl);
        
        // Validation: If scrape failed or price is 0
        if (!data || !data.price || data.price === 0) {
            console.log(`[Job] ⚠️ Skipped (No Data/Zero Price): ${link.externalUrl}`);
            return;
        }

        const vendorName = data.vendor || "Unknown";
        
        // 2. Update DB (Offers Table)
        // Check if we already have an offer for this Component + Vendor
        const existingOffer = await prisma.offer.findFirst({
            where: {
                componentId: link.componentId,
                vendor: vendorName // ✅ FIXED: Schema uses 'vendor', not 'vendorId'
            }
        });

        if (existingOffer) {
            // Update existing offer
            await prisma.offer.update({
                where: { id: existingOffer.id },
                data: {
                    price: data.price,
                    effective_price: data.price, // Assuming free shipping or same logic
                    in_stock: data.inStock,
                    url: link.externalUrl, // Ensure URL is up to date
                    updatedAt: new Date()
                }
            });
            console.log(`[Job] ✅ Offer Updated: ₹${data.price} (${vendorName})`);
        } else {
            // Create new offer
            await prisma.offer.create({
                data: {
                    componentId: link.componentId,
                    vendor: vendorName, // ✅ FIXED: Schema uses 'vendor'
                    price: data.price,
                    effective_price: data.price,
                    in_stock: data.inStock,
                    url: link.externalUrl, // ✅ FIXED: Schema uses 'url', not 'vendor_url'
                    sourceId: "scraper-auto",
                    shipping: 0
                }
            });
            console.log(`[Job] ✅ New Offer Created: ₹${data.price} (${vendorName})`);
        }

        // 3. Update ExternalId timestamp (Heartbeat)
        await prisma.externalId.update({
            where: { id: link.id },
            data: { lastCheckedAt: new Date() }
        });

    } catch (error) {
        console.error(`[Job] ❌ Error processing link ${link.id}: ${error.message}`);
    }
}

async function runPriceTracker() {
    console.log("[Job] 🚀 Bulk Tracker Started");
    try {
        // 
        // This query fetches all active tracking links to process
        const trackedLinks = await prisma.externalId.findMany({
            where: {
                externalUrl: { 
                    not: "" // ✅ FIXED: Required strings cannot be null, check for empty string
                }, 
                isActive: true
            }
        });

        console.log(`[Job] Found ${trackedLinks.length} active links.`);

        for (const link of trackedLinks) {
            await processSingleLink(link);
            // Wait 3 seconds between requests to avoid IP blocking
            await new Promise(resolve => setTimeout(resolve, 3000)); 
        }
        console.log("[Job] 💤 Bulk Tracker Sleep");
    } catch (e) {
        console.error("[Job] 🔥 Critical Failure:", e.message);
    }
}

module.exports = { runPriceTracker, processSingleLink };