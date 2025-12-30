const prisma = require('../config/db');

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
        { id: { contains: search, mode: 'insensitive' } }
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
      const bestOffer = c.offers
        .filter(o => o.in_stock)
        .sort((a, b) => a.effective_price - b.effective_price)[0];

      return {
        component_id: c.id,
        category: c.category.name,
        brand: c.brand,
        model: c.model,
        variant_name: c.variant,
        active_status: c.active_status,
        ean: c.ean,
        release_date: c.release_date,
        warranty_years: c.warranty_years,
        images: c.images,
        product_page_url: c.product_page,
        datasheet_url: c.datasheet_url,
        quality: { 
          completeness: c.completeness, 
          needs_review: c.needs_review,
          review_status: c.review_status 
        },
        specs: c.specs,
        compatibility: c.compatibility,
        offers: c.offers,
        _best_price: bestOffer ? bestOffer.effective_price : null,
        _in_stock: bestOffer ? true : false,
        _updated_at: bestOffer ? bestOffer.last_updated : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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
        product_page_url: component.product_page,
        variant_name: component.variant,
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

exports.createComponent = async (req, res) => {
  try {
    const { 
        categoryName, brand, model, variant, 
        specs, compatibility, active_status,
        ean, warranty_years, release_date
    } = req.body;

    const category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) return res.status(400).json({ error: "Invalid Category" });

    const newComp = await prisma.component.create({
      data: {
        categoryId: category.id,
        brand, model, variant,
        active_status: active_status || "active",
        ean, 
        warranty_years: Number(warranty_years) || 0,
        release_date,
        specs: specs || {},
        compatibility: compatibility || {},
        auditLogs: {
            create: {
                actor: "admin@xor",
                action: "create",
                field: "component",
                after: "created"
            }
        }
      }
    });
    res.json(newComp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateComponent = async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, oldValue, actor } = req.body;

    const updateData = {};
    
    if(field.startsWith("specs.") || field.startsWith("compatibility.") || field.startsWith("quality.")) {
        const [root, key] = field.split('.');
        
        const current = await prisma.component.findUnique({
            where: {id}, 
            select: {[root]: true}
        });
        
        const jsonObj = current[root] || {};
        
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
    } else {
        updateData[field] = value;
    }

    const updated = await prisma.component.update({
      where: { id },
      data: {
        ...updateData,
        auditLogs: {
          create: {
            actor: actor || "admin@xor",
            action: "update",
            field: field,
            before: String(oldValue),
            after: String(value)
          }
        }
      },
      include: { auditLogs: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};