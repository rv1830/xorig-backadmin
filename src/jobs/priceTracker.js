const prisma = require('../config/db');
const { scrapeUrl } = require('../utils/scraper');

async function processSingleLink(link) {
    try {
        const validVendors = ['mdcomputers', 'vedant', 'primeabgb', 'elitehubs'];
        const isValid = validVendors.some(v => link.externalUrl.includes(v));
        
        if (!isValid) return;

        console.log(`[Job] 🔎 Processing Link ID: ${link.id} (${link.sourceId})`);
        const data = await scrapeUrl(link.externalUrl);

        if (!data) {
            console.log(`[Job] ⚠️ Null Data returned for ${link.externalUrl}`);
            return;
        }

        if (data.price === 0) {
            console.log(`[Job] ⚠️ Zero Price Detected. Skipping DB Update.`);
            return;
        }

        let retries = 3;
        while (retries > 0) {
            try {
                const existingOffer = await prisma.offer.findFirst({
                    where: { componentId: link.componentId, vendorId: data.vendor }
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
                    console.log(`[DB] ✅ Offer Updated: ₹${data.price}`);
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
                    console.log(`[DB] ✅ New Offer Created: ₹${data.price}`);
                }
                
                await prisma.externalId.update({
                    where: { id: link.id },
                    data: { lastCheckedAt: new Date() }
                });
                break; 

            } catch (dbError) {
                console.error(`[DB] ⚠️ Connection Error (Attempt ${4 - retries}): ${dbError.message}`);
                retries--;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        return data;

    } catch (error) {
        console.error(`[Job] ❌ Process Error: ${error.message}`);
    }
    return null;
}

async function runPriceTracker() {
    console.log("[Job] 🚀 Bulk Tracker Started");
    try {
        const trackedLinks = await prisma.externalId.findMany({
            where: { externalUrl: { not: null }, isActive: true }
        });

        console.log(`[Job] Found ${trackedLinks.length} active links.`);

        for (const link of trackedLinks) {
            await processSingleLink(link);
            await new Promise(resolve => setTimeout(resolve, 3000)); 
        }
        console.log("[Job] 💤 Bulk Tracker Sleep");
    } catch (e) {
        console.error("[Job] 🔥 Critical Failure:", e.message);
    }
}

module.exports = { runPriceTracker, processSingleLink };