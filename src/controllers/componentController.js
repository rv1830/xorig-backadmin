const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { processSingleLink } = require('../jobs/priceTracker'); 
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

    // Format data to match Frontend UI expectations
    const formatted = components.map(c => {
      // Logic to find best offer
      const bestOffer = c.offers
        .filter(o => o.in_stock)
        .sort((a, b) => a.effective_price - b.effective_price)[0];

      return {
        ...c,
        component_id: c.id,
        category: c.category?.name,
        variant_name: c.variant, // Map DB 'variant' -> UI 'variant_name'
        product_page_url: c.product_page, // Map DB 'product_page' -> UI 'product_page_url'
        
        // Reconstruct Quality Object from flat DB fields
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

// --- GET SINGLE COMPONENT ---
exports.getComponentById = async (req, res) => {
  try {
    const component = await prisma.component.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        offers: true,
        externalIds: true,
        auditLogs: { orderBy: { timestamp: 'desc' } } // Schema uses auditLogs
      }
    });
    
    if(!component) return res.status(404).json({error: "Not found"});

    // Map DB structure to Frontend structure
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
        
        external_ids: component.externalIds.map(x => ({
            source_id: x.sourceId,
            external_id: x.externalId,
            external_url: x.externalUrl,
            match_method: x.matchMethod,
            match_confidence: x.confidence
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
    console.log("Create Payload:", req.body); // Debugging

    // 1. Destructure based on Frontend Payload
    const { 
        category, // Frontend sends "category" string (e.g., "CPU")
        brand, 
        model, 
        variant_name, 
        active_status,
        ean, 
        warranty_years, 
        release_date,
        specs, 
        compatibility,
        product_page_url,
        datasheet_url,
        images,
        quality // Object { completeness, needs_review, ... }
    } = req.body;

    // 2. Validate Category
    if (!category) return res.status(400).json({ error: "Category is required" });

    // 3. Find Category ID
    const categoryRecord = await prisma.category.findUnique({ 
        where: { name: category } 
    });
    
    if (!categoryRecord) {
        return res.status(400).json({ error: `Category '${category}' not found.` });
    }

    // 4. Create in DB (Mapping UI fields to DB Schema)
    const newComp = await prisma.component.create({
      data: {
        categoryId: categoryRecord.id,
        brand, 
        model, 
        variant: variant_name || "", // Map 'variant_name' -> 'variant'
        active_status: active_status || "active",
        ean, 
        warranty_years: Number(warranty_years) || 0,
        release_date,
        specs: specs || {},
        compatibility: compatibility || {},
        product_page: product_page_url,
        datasheet_url,
        images: images || [],

        // Flatten Quality Object -> Schema Columns
        completeness: Number(quality?.completeness || 0),
        needs_review: quality?.needs_review ?? true,
        review_status: quality?.review_status || "unreviewed",

        // Add Audit Log
        auditLogs: {
            create: {
                actor: "admin@xor",
                action: "create",
                field: "component",
                after: "created"
            }
        }
      },
      include: {
          category: true // Return category info for UI
      }
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
    // Assuming patch payload might be partial object OR specific field update
    // For specific field update pattern used in grid:
    const { field, value, oldValue, actor } = req.body;

    // If it's a direct object update (from Drawer Save), logic might differ, 
    // but assuming Grid/Patch logic here:

    const updateData = {};
    let auditField = field || "update";
    let auditBefore = oldValue ? String(oldValue) : "—";
    let auditAfter = value ? String(value) : "—";

    // Handle Nested JSON updates (specs/compatibility)
    if(field && (field.startsWith("specs.") || field.startsWith("compatibility."))) {
        const [root, key] = field.split('.');
        
        // Fetch current JSON
        const current = await prisma.component.findUnique({
            where: {id}, 
            select: {[root]: true}
        });
        
        const jsonObj = current[root] || {};
        
        // Update key
        if(root === 'specs') {
            jsonObj[key] = { 
                v: value, 
                source_id: 'manual', 
                confidence: 1.0, 
                updated_at: new Date() 
            };
        } else {
            jsonObj[key] = value;
        }
        updateData[root] = jsonObj;
    } 
    // Handle specific column mappings
    else if (field === 'variant_name') {
        updateData.variant = value;
    } 
    else if (field === 'product_page_url') {
        updateData.product_page = value;
    }
    // Default fallback
    else if (field) {
        updateData[field] = value;
    } 
    // Fallback: if req.body contains full object (Drawer Save)
    else {
        // ... (Logic for full object update if needed, usually passed differently)
        // For now, let's assume Grid pattern based on your previous code
    }

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

exports.addTrackedLink = async (req, res) => {
    try {
        const { componentId, url } = req.body;

        if (!componentId || !url) {
            return res.status(400).json({ error: "Component ID and URL are required" });
        }

        let sourceId = "unknown";
        if (url.includes("mdcomputers")) sourceId = "mdcomputers";
        else if (url.includes("vedant")) sourceId = "vedant";

        // 1. Link DB mein Save karo
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

        // 2. INSTANT SCRAPE TRIGGER
        // Hum await nahi laga rahe taaki UI turant success dikha de,
        // par background mein scraping chalu ho jayegi.
        console.log("⚡ Triggering instant scrape for new link...");
        processSingleLink(newLink).then(result => {
            if(result) console.log("⚡ Instant Update Complete!");
        });

        res.json({ 
            message: "Link added! Price is updating in background...", 
            data: newLink 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
