// src/jobs/priceTracker.js
const { PrismaClient } = require('@prisma/client');
const { scrapeUrl } = require('../utils/scraper');
const prisma = require('../config/db'); // Use shared instance

async function processSingleLink(link) {
    try {
        if (!link.externalUrl.includes('mdcomputers') && !link.externalUrl.includes('vedant')) {
            return;
        }

        console.log(`🔎 Processing: ${link.externalUrl}`);
        const data = await scrapeUrl(link.externalUrl);

        // --- NEW LOGIC START ---
        if (!data) {
            console.log("⚠️ Scraper returned NULL (Bot Blocked or Network Error)");
            // Optional: Mark link as failing in DB
            return;
        }

        if (data.price === 0) {
            console.log("⚠️ Price is 0. Selector failed or Item is free?");
            return;
        }
        // --- NEW LOGIC END ---

        console.log(`✅ SUCCESS: ${data.vendor.toUpperCase()} - ₹${data.price}`);

        // Update/Create Offer
        const existingOffer = await prisma.offer.findFirst({
            where: {
                componentId: link.componentId,
                vendorId: data.vendor
            }
        });

        if (existingOffer) {
            await prisma.offer.update({
                where: { id: existingOffer.id },
                data: {
                    price: data.price,
                    effective_price: data.price,
                    in_stock: data.inStock,
                    last_updated: new Date()
                }
            });
        } else {
            await prisma.offer.create({
                data: {
                    componentId: link.componentId,
                    vendorId: data.vendor,
                    sourceId: "scraper-auto",
                    vendor_url: link.externalUrl,
                    price: data.price,
                    effective_price: data.price,
                    in_stock: data.inStock,
                    shipping: 0
                }
            });
        }

        // Update Last Checked Time
        await prisma.externalId.update({
            where: { id: link.id },
            data: { lastCheckedAt: new Date() }
        });

        return data;

    } catch (error) {
        console.error(`❌ Job Error for ${link.externalUrl}:`, error.message);
    }
    return null;
}

// Bulk Runner
async function runPriceTracker() {
    console.log("🚀 Running Bulk Tracker...");
    // Sirf Active links uthao
    const trackedLinks = await prisma.externalId.findMany({
        where: { 
            externalUrl: { not: null },
            isActive: true 
        }
    });

    console.log(`Found ${trackedLinks.length} links.`);

    for (const link of trackedLinks) {
        await processSingleLink(link);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sec delay
    }
    console.log("💤 Job Sleeping...");
}

module.exports = { runPriceTracker, processSingleLink };