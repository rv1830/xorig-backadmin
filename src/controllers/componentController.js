const prisma = require('../config/db');
const { processSingleLink } = require('../jobs/priceTracker');
const { scrapeSpecs } = require('../utils/scraper');

// --- GET ALL COMPONENTS ---
exports.getComponents = async (req, res) => {
  try {
    const { category, search } = req.query;
    const where = {};

    if (category && category !== 'All') {
      where.category = { name: category };
    }

    if (search) {
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { variant: { contains: search, mode: 'insensitive' } },
      ];
    }

    const components = await prisma.component.findMany({
      where,
      include: {
        category: { select: { name: true } },
        offers: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formatted = components.map(c => {
      // Logic to find best offer (Only In Stock)
      const bestOffer = c.offers
        .filter(o => o.in_stock)
        .sort((a, b) => a.effective_price - b.effective_price)[0];

      return {
        ...c,
        component_id: c.id,
        category: c.category?.name,
        variant_name: c.variant,
        product_page_url: c.product_page,
        
        quality: { 
          completeness: c.completeness, 
          needs_review: c.needs_review,
          review_status: c.review_status 
        },
        
        // Flattened Offer Data for Grid
        _best_price: bestOffer ? bestOffer.effective_price : null,
        _in_stock: bestOffer ? true : false,
        _updated_at: bestOffer ? bestOffer.last_updated : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Get Error:", error);
    res.status(500).json({ error: "Failed to fetch components" });
  }
};

// --- GET SINGLE COMPONENT (FIXED MAPPING HERE) ---
exports.getComponentById = async (req, res) => {
  try {
    const component = await prisma.component.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        offers: true,
        externalIds: true,
        auditLogs: { orderBy: { timestamp: 'desc' } }
      }
    });
    
    if(!component) return res.status(404).json({error: "Not found"});

    const result = {
        ...component,
        component_id: component.id,
        category: component.category.name,
        variant_name: component.variant,
        product_page_url: component.product_page,
        
        quality: {
            completeness: component.completeness,
            needs_review: component.needs_review,
            review_status: component.review_status
        },
        
        // --- FIX: Using camelCase to match Frontend Expectations ---
        external_ids: component.externalIds.map(x => ({
            id: x.id,
            sourceId: x.sourceId,        // Frontend uses 'sourceId'
            externalId: x.externalId,
            externalUrl: x.externalUrl,  // Frontend uses 'externalUrl'
            matchMethod: x.matchMethod,
            confidence: x.confidence
        })),
        
        audit: component.auditLogs.map(l => ({
            at: l.timestamp,
            actor: l.actor,
            action: l.action,
            field: l.field,
            before: l.before,
            after: l.after
        }))
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- CREATE COMPONENT ---
exports.createComponent = async (req, res) => {
  try {
    const { 
        category, brand, model, variant_name, active_status,
        ean, warranty_years, release_date, specs, compatibility,
        product_page_url, datasheet_url, images, quality 
    } = req.body;

    if (!category) return res.status(400).json({ error: "Category is required" });

    const categoryRecord = await prisma.category.findUnique({ 
        where: { name: category } 
    });
    
    if (!categoryRecord) {
        return res.status(400).json({ error: `Category '${category}' not found.` });
    }

    const newComp = await prisma.component.create({
      data: {
        categoryId: categoryRecord.id,
        brand, model, 
        variant: variant_name || "",
        active_status: active_status || "active",
        ean, warranty_years: Number(warranty_years) || 0,
        release_date, specs: specs || {}, compatibility: compatibility || {},
        product_page: product_page_url, datasheet_url, images: images || [],
        completeness: Number(quality?.completeness || 0),
        needs_review: quality?.needs_review ?? true,
        review_status: quality?.review_status || "unreviewed",
        auditLogs: {
            create: {
                actor: "admin@xor",
                action: "create",
                field: "component",
                after: "created"
            }
        }
      },
      include: { category: true }
    });

    res.json(newComp);
  } catch (error) {
    console.error("Create Error:", error);
    if (error.code === 'P2002') {
        return res.status(409).json({ error: "Component with this Brand/Model/Variant already exists." });
    }
    res.status(500).json({ error: error.message });
  }
};

// --- UPDATE COMPONENT ---
exports.updateComponent = async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, oldValue, actor } = req.body;

    const updateData = {};
    let auditField = field || "update";
    let auditBefore = oldValue ? String(oldValue) : "—";
    let auditAfter = value ? String(value) : "—";

    if(field && (field.startsWith("specs.") || field.startsWith("compatibility."))) {
        const [root, key] = field.split('.');
        const current = await prisma.component.findUnique({
            where: {id}, select: {[root]: true}
        });
        const jsonObj = current[root] || {};
        
        if(root === 'specs') {
            jsonObj[key] = { 
                v: value, source_id: 'manual', confidence: 1.0, updated_at: new Date() 
            };
        } else {
            jsonObj[key] = value;
        }
        updateData[root] = jsonObj;
    } 
    else if (field === 'variant_name') updateData.variant = value;
    else if (field === 'product_page_url') updateData.product_page = value;
    else if (field) updateData[field] = value;

    const updated = await prisma.component.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
        auditLogs: {
          create: {
            actor: actor || "admin@xor",
            action: "update",
            field: auditField,
            before: auditBefore,
            after: auditAfter
          }
        }
      },
      include: { auditLogs: true }
    });

    res.json(updated);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// --- ADD TRACKED LINK ---
exports.addTrackedLink = async (req, res) => {
    try {
        const { componentId, url } = req.body;

        if (!componentId || !url) {
            return res.status(400).json({ error: "Component ID and URL are required" });
        }

        let sourceId = "unknown";
        if (url.includes("mdcomputers")) sourceId = "mdcomputers";
        else if (url.includes("vedant")) sourceId = "vedant";
        else if (url.includes("primeabgb")) sourceId = "primeabgb";
        else if (url.includes("elitehubs")) sourceId = "elitehubs";

        const newLink = await prisma.externalId.create({
            data: {
                componentId,
                externalUrl: url,
                sourceId: sourceId,
                externalId: "manual-link",
                matchMethod: "manual",
                confidence: 1.0,
                isActive: true
            }
        });

        console.log("⚡ Triggering instant scrape for new link...");
        processSingleLink(newLink).then(result => {
            if(result) console.log("⚡ Instant Update Complete!");
        });

        // Returning the raw Prisma object (newLink) ensures frontend gets camelCase keys
        res.json({ 
            message: "Link added! Price is updating in background...", 
            data: newLink 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// --- ADD MANUAL OFFER ---
exports.addManualOffer = async (req, res) => {
    try {
        const { componentId, price, vendorName, inStock } = req.body;
        console.log(`[API] Manual Offer: ${vendorName} - ₹${price}`);
        
        const offer = await prisma.offer.create({
            data: {
                componentId,
                vendorId: vendorName || "Manual Entry",
                sourceId: "manual",
                price: Number(price),
                effective_price: Number(price),
                in_stock: inStock ?? true,
                vendor_url: "",
                shipping: 0,
                last_updated: new Date()
            }
        });
        res.json(offer);
    } catch (error) {
        console.error("[API] Manual Offer Error:", error.message);
        res.status(500).json({ error: error.message });
    }
};

// --- FETCH SPECS FROM URL ---
exports.fetchSpecs = async (req, res) => {
    try {
        const { url } = req.body;
        if(!url) return res.status(400).json({error: "URL required"});
        
        const specs = await scrapeSpecs(url);
        res.json(specs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};