const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = [
    {
      name: "CPU",
      slug: "cpu",
      specDefs: [
        { id: "core_count", label: "Cores", type: "int", unit: "" },
        { id: "thread_count", label: "Threads", type: "int", unit: "" },
        { id: "base_clock", label: "Base Clock", type: "float", unit: "GHz" },
        { id: "boost_clock", label: "Boost Clock", type: "float", unit: "GHz" },
        { id: "tdp", label: "TDP", type: "int", unit: "W" },
        { id: "igpu", label: "iGPU", type: "bool", unit: "" },
      ],
      compatKeys: ["socket"]
    },
    {
      name: "Motherboard",
      slug: "motherboard",
      specDefs: [
        { id: "vrm_phases", label: "VRM Phases", type: "string", unit: "" },
        { id: "m2_slots", label: "M.2 Slots", type: "int", unit: "" },
        { id: "wifi", label: "Wi‑Fi", type: "bool", unit: "" },
      ],
      compatKeys: ["socket", "chipset", "memory_type", "form_factor"]
    },
    {
      name: "GPU",
      slug: "gpu",
      specDefs: [
        { id: "vram", label: "VRAM", type: "int", unit: "GB" },
        { id: "length_mm", label: "Length", type: "int", unit: "mm" },
      ],
      compatKeys: ["pcie_generation"]
    },
    {
      name: "RAM",
      slug: "ram",
      specDefs: [
        { id: "capacity_gb", label: "Capacity", type: "int", unit: "GB" },
        { id: "speed_mhz", label: "Speed", type: "int", unit: "MHz" },
        { id: "cl", label: "CAS Latency", type: "int", unit: "CL" },
      ],
      compatKeys: ["memory_type"]
    },
    {
      name: "PSU",
      slug: "psu",
      specDefs: [
        { id: "wattage", label: "Wattage", type: "int", unit: "W" },
        { id: "rating", label: "80+ Rating", type: "string", unit: "" },
      ],
      compatKeys: ["form_factor"]
    },
    {
      name: "Case",
      slug: "case",
      specDefs: [
        { id: "max_gpu_mm", label: "Max GPU Length", type: "int", unit: "mm" },
      ],
      compatKeys: ["form_factor"]
    }
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        specDefs: cat.specDefs,
        compatKeys: cat.compatKeys
      }
    });
  }
  console.log("Categories seeded!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });