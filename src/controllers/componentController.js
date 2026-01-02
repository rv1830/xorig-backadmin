const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { scrapeSpecs } = require('../utils/scraper');

// --- Helper to prevent NaN Crashes ---
const parseNum = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

// --- Helper to parse Float ---
const parseFloatNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0.0 : n;
};

exports.getComponents = async (req, res) => {
  try {
    const { type, search } = req.query;
    const where = {};

    if (type && type !== 'All') {
      where.type = type;
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
      select: {
        id: true,
        type: true,
        brand: true,
        model: true,
        variant: true,
        image_url: true,
        price_current: true,
        updatedAt: true,
        product_page: true,
        specs: true, // ✅ Return dynamic specs
        offers: {
          where: { in_stock: true },
          orderBy: { price: 'asc' },
          take: 1,
          select: { price: true, vendor: true, url: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const formatted = components.map(c => ({
      id: c.id,
      type: c.type,
      name: `${c.brand} ${c.model} ${c.variant || ''}`.trim(),
      brand: c.brand,
      model: c.model,
      variant: c.variant,
      image: c.image_url,
      best_price: c.offers[0] ? c.offers[0].price : c.price_current,
      vendor: c.offers[0] ? c.offers[0].vendor : 'N/A',
      url: c.offers[0] ? c.offers[0].url : c.product_page,
      updatedAt: c.updatedAt,
      // Pass raw data for editing
      specs: c.specs, 
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch components" });
  }
};

exports.getComponentById = async (req, res) => {
  try {
    const { id } = req.params;

    const base = await prisma.component.findUnique({
        where: { id },
        include: { offers: true, externalIds: true }
    });

    if (!base) return res.status(404).json({ error: "Not found" });

    // Fetch strict compatibility data
    let strictData = null;
    switch (base.type) {
        case 'CPU': strictData = await prisma.cpu.findUnique({ where: { componentId: id } }); break;
        case 'GPU': strictData = await prisma.gpu.findUnique({ where: { componentId: id } }); break;
        case 'MOTHERBOARD': strictData = await prisma.motherboard.findUnique({ where: { componentId: id } }); break;
        case 'RAM': strictData = await prisma.ram.findUnique({ where: { componentId: id } }); break;
        case 'STORAGE': strictData = await prisma.storage.findUnique({ where: { componentId: id } }); break;
        case 'PSU': strictData = await prisma.psu.findUnique({ where: { componentId: id } }); break;
        case 'CABINET': strictData = await prisma.cabinet.findUnique({ where: { componentId: id } }); break;
        case 'COOLER': strictData = await prisma.cooler.findUnique({ where: { componentId: id } }); break;
    }

    // Return combined data:
    // 1. Base info (brand, model)
    // 2. specs: Dynamic JSON (Admin defined)
    // 3. cpu/gpu/...: Strict data (for compatibility)
    res.json({ 
        ...base, 
        [base.type.toLowerCase()]: strictData // e.g. "cpu": { cores: 6 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createComponent = async (req, res) => {
  try {
    const { 
        type, brand, model, variant, 
        price, image_url, product_page, 
        
        // Two types of data from Frontend:
        specs,        // 1. Dynamic JSON (Custom fields)
        compat_specs  // 2. Strict Fields (Socket, Cores etc.)
    } = req.body;

    if (!type || !brand || !model) {
        return res.status(400).json({ error: "Type, Brand and Model are required" });
    }

    // Ensure compat_specs object exists to prevent "cannot read property of undefined"
    const cs = compat_specs || {}; 

    const result = await prisma.$transaction(async (tx) => {
        // 1. Create Component (Store Dynamic JSON here)
        const comp = await tx.component.create({
            data: {
                type,
                brand,
                model,
                variant: variant || "",
                image_url: image_url || "",
                product_page: product_page || "",
                price_current: parseNum(price),
                
                // ✅ Store Custom Specs JSON
                specs: specs || {},

                offers: price ? {
                    create: {
                        vendor: "Manual Entry",
                        price: parseNum(price),
                        url: product_page || "",
                        in_stock: true
                    }
                } : undefined
            }
        });

        // 2. Create Strict Data (With Fallbacks for Safety)
        if (type === 'CPU') {
            await tx.cpu.create({
                data: {
                    componentId: comp.id,
                    socket: cs.socket || "Unknown",
                    cores: parseNum(cs.cores),
                    threads: parseNum(cs.threads),
                    base_clock: parseFloatNum(cs.base_clock),
                    boost_clock: parseFloatNum(cs.boost_clock),
                    tdp_watts: parseNum(cs.tdp_watts),
                    integrated_gpu: cs.integrated_gpu === 'true' || cs.integrated_gpu === true,
                    includes_cooler: cs.includes_cooler === 'true' || cs.includes_cooler === true
                }
            });
        } 
        else if (type === 'GPU') {
            await tx.gpu.create({
                data: {
                    componentId: comp.id,
                    chipset: cs.chipset || "Unknown",
                    vram_gb: parseNum(cs.vram_gb),
                    length_mm: parseNum(cs.length_mm),
                    tdp_watts: parseNum(cs.tdp_watts),
                    recommended_psu: parseNum(cs.recommended_psu)
                }
            });
        }
        else if (type === 'MOTHERBOARD') {
            await tx.motherboard.create({
                data: {
                    componentId: comp.id,
                    socket: cs.socket || "Unknown",
                    form_factor: cs.form_factor || "ATX",
                    memory_type: cs.memory_type || "DDR4",
                    memory_slots: parseNum(cs.memory_slots),
                    max_memory_gb: parseNum(cs.max_memory_gb),
                    m2_slots: parseNum(cs.m2_slots),
                    wifi: cs.wifi === 'true' || cs.wifi === true
                }
            });
        }
        else if (type === 'RAM') {
            await tx.ram.create({
                data: {
                    componentId: comp.id,
                    memory_type: cs.memory_type || "DDR4",
                    capacity_gb: parseNum(cs.capacity_gb),
                    modules: parseNum(cs.modules),
                    speed_mhz: parseNum(cs.speed_mhz),
                    cas_latency: cs.cas_latency ? parseNum(cs.cas_latency) : null
                }
            });
        }
        else if (type === 'STORAGE') {
            await tx.storage.create({
                data: {
                    componentId: comp.id,
                    type: cs.type || "SSD",
                    capacity_gb: parseNum(cs.capacity_gb),
                    gen: cs.gen || "Gen3"
                }
            });
        }
        else if (type === 'PSU') {
            await tx.psu.create({
                data: {
                    componentId: comp.id,
                    wattage: parseNum(cs.wattage),
                    efficiency: cs.efficiency || "Bronze",
                    modular: cs.modular || "No"
                }
            });
        }
        else if (type === 'CABINET') {
            await tx.cabinet.create({
                data: {
                    componentId: comp.id,
                    supported_forms: Array.isArray(cs.supported_forms) ? cs.supported_forms : [],
                    max_gpu_len_mm: parseNum(cs.max_gpu_len_mm),
                    max_cpu_height: parseNum(cs.max_cpu_height)
                }
            });
        }
        else if (type === 'COOLER') {
            await tx.cooler.create({
                data: {
                    componentId: comp.id,
                    type: cs.type || "Air",
                    sockets: Array.isArray(cs.sockets) ? cs.sockets : [],
                    height_mm: cs.height_mm ? parseNum(cs.height_mm) : null,
                    radiator_size: cs.radiator_size ? parseNum(cs.radiator_size) : null
                }
            });
        }

        return comp;
    });

    res.json({ success: true, data: result });

  } catch (error) {
    console.error("Create Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateComponent = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, specs, compat_specs, ...coreUpdates } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            let updatedComp = null;
            
            // 1. Update Core + Dynamic Specs
            const updateData = { ...coreUpdates };
            if (specs) updateData.specs = specs; // Update JSON if provided

            if (Object.keys(updateData).length > 0) {
                updatedComp = await tx.component.update({
                    where: { id },
                    data: updateData
                });
            }

            // 2. Update Strict Compatibility Data
            if (compat_specs && type) {
                const cs = compat_specs;
                if (type === 'CPU') await tx.cpu.update({ where: { componentId: id }, data: cs });
                else if (type === 'GPU') await tx.gpu.update({ where: { componentId: id }, data: cs });
                else if (type === 'MOTHERBOARD') await tx.motherboard.update({ where: { componentId: id }, data: cs });
                else if (type === 'RAM') await tx.ram.update({ where: { componentId: id }, data: cs });
                else if (type === 'STORAGE') await tx.storage.update({ where: { componentId: id }, data: cs });
                else if (type === 'PSU') await tx.psu.update({ where: { componentId: id }, data: cs });
                else if (type === 'CABINET') await tx.cabinet.update({ where: { componentId: id }, data: cs });
                else if (type === 'COOLER') await tx.cooler.update({ where: { componentId: id }, data: cs });
            }

            return updatedComp || { id, message: "Specs updated" };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addManualOffer = async (req, res) => {
    try {
        const { componentId, price, vendorName, inStock, url } = req.body;
        
        const offer = await prisma.offer.create({
            data: {
                componentId,
                vendor: vendorName || "Manual Entry",
                price: Number(price),
                in_stock: inStock ?? true,
                url: url || "",
            }
        });
        res.json(offer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteComponent = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.component.delete({ where: { id } });
        res.json({ success: true, message: "Component deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

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