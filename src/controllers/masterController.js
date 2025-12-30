const prisma = require('../config/db');

const DIMENSIONS = {
  sockets: [
    { id: "AM4", label: "AM4" },
    { id: "AM5", label: "AM5" },
    { id: "LGA1700", label: "LGA1700" },
  ],
  memoryTypes: [
    { id: "DDR4", label: "DDR4" },
    { id: "DDR5", label: "DDR5" },
  ],
  formFactors: [
    { id: "ATX", label: "ATX" },
    { id: "mATX", label: "mATX" },
    { id: "ITX", label: "ITX" },
  ],
  chipsets: [
    { id: "B650", label: "B650" },
    { id: "X670E", label: "X670E" },
    { id: "Z790", label: "Z790" },
  ],
  pcie: [
    { id: "3", label: "PCIe 3.0" },
    { id: "4", label: "PCIe 4.0" },
    { id: "5", label: "PCIe 5.0" },
  ],
};

const VENDORS = [
  { id: "md", name: "MDComputers", trust: 86 },
  { id: "prime", name: "PrimeABGB", trust: 82 },
  { id: "ved", name: "Vedant Computers", trust: 78 },
];

const SOURCES = [
  { id: "pcpt", name: "PCPriceTracker", type: "aggregator", baseUrl: "https://pcpricetracker.in" },
  { id: "md", name: "MDComputers", type: "vendor", baseUrl: "https://mdcomputers.in" },
  { id: "prime", name: "PrimeABGB", type: "vendor", baseUrl: "https://primeabgb.com" },
  { id: "manual", name: "XO Rig Manual", type: "manual", baseUrl: "" },
];

exports.getInitData = async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    const rules = await prisma.compatibilityRule.findMany({
      where: { enabled: true }
    });

    const specDefs = {};
    const categoryKeys = {};
    
    categories.forEach(cat => {
      specDefs[cat.name] = cat.specDefs;
      categoryKeys[cat.name] = cat.compatKeys;
    });

    res.json({
      dimensions: DIMENSIONS,
      vendors: VENDORS,
      sources: SOURCES,
      specDefs: specDefs,
      categoryKeys: categoryKeys,
      rules: rules,
      categoriesList: categories.map(c => c.name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};