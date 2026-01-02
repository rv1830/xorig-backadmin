// 3. logic/BuilderService.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ruleEngine = require('./RuleEngine');

class BuilderService {

    // Main Function: Budget aur Intent ke hisaab se PC banao
    async generateBuild(budget, intent = "GAMING") {
        
        // 1. Budget Split (Total paisa kaise baantna hai)
        const allocation = this.getAllocation(budget, intent);
        
        const build = {};

        // --- STEP 1: GPU SELECT KARO (Sabse Mehenga Part) ---
        const gpuData = await prisma.component.findFirst({
            where: { 
                type: 'GPU',
                price_current: { lte: allocation.gpu, gt: 0 } 
            },
            orderBy: { price_current: 'desc' }, 
            include: { gpu: true }
        });
        build.gpu = gpuData ? gpuData.gpu : null;
        // Hum component ka main data (price, brand) bhi store karenge calculation ke liye
        build.gpu_meta = gpuData; 


        // --- STEP 2: CPU SELECT KARO ---
        const cpuData = await prisma.component.findFirst({
            where: { 
                type: 'CPU',
                price_current: { lte: allocation.cpu, gt: 0 }
            },
            orderBy: { price_current: 'desc' },
            include: { cpu: true }
        });
        build.cpu = cpuData ? cpuData.cpu : null;
        build.cpu_meta = cpuData;


        // --- STEP 3: MOTHERBOARD ---
        if (build.cpu) {
            const moboData = await prisma.component.findFirst({
                where: {
                    type: 'MOTHERBOARD',
                    price_current: { lte: allocation.motherboard },
                    motherboard: {
                        socket: build.cpu.socket // ✅ HARD CONSTRAINT
                    }
                },
                orderBy: { price_current: 'desc' }, 
                include: { motherboard: true }
            });
            build.motherboard = moboData ? moboData.motherboard : null;
            build.motherboard_meta = moboData;
        }


        // --- STEP 4: RAM ---
        if (build.motherboard) {
            const ramData = await prisma.component.findFirst({
                where: {
                    type: 'RAM',
                    price_current: { lte: allocation.ram },
                    ram: {
                        memory_type: build.motherboard.memory_type // ✅ HARD CONSTRAINT
                    }
                },
                orderBy: { price_current: 'desc' },
                include: { ram: true }
            });
            build.ram = ramData ? ramData.ram : null;
            build.ram_meta = ramData;
        }

        // --- STEP 5: CABINET ---
        if (build.motherboard && build.gpu) {
            const caseData = await prisma.component.findFirst({
                where: {
                    type: 'CABINET',
                    price_current: { lte: allocation.cabinet },
                    cabinet: {
                        max_gpu_len_mm: { gte: build.gpu.length_mm }, 
                        supported_forms: { has: build.motherboard.form_factor } 
                    }
                },
                orderBy: { price_current: 'asc' }, 
                include: { cabinet: true }
            });
            build.cabinet = caseData ? caseData.cabinet : null;
            build.cabinet_meta = caseData;
        }

        // --- STEP 6: PSU ---
        if (build.cpu && build.gpu) {
            const totalTdp = build.cpu.tdp_watts + build.gpu.tdp_watts + 100;
            
            const psuData = await prisma.component.findFirst({
                where: {
                    type: 'PSU',
                    price_current: { lte: allocation.psu },
                    psu: {
                        wattage: { gte: totalTdp } 
                    }
                },
                orderBy: { price_current: 'asc' }, 
                include: { psu: true }
            });
            build.psu = psuData ? psuData.psu : null;
            build.psu_meta = psuData;
        }

        // --- STEP 7: STORAGE ---
        const storageData = await prisma.component.findFirst({
            where: { type: 'STORAGE', price_current: { lte: allocation.storage } },
            orderBy: { price_current: 'desc' },
            include: { storage: true }
        });
        build.storage = storageData ? storageData.storage : null;
        build.storage_meta = storageData;

        // --- FINAL CHECK ---
        const compatibility = ruleEngine.checkCompatibility(build);

        return {
            parts: {
                cpu: build.cpu_meta,
                gpu: build.gpu_meta,
                motherboard: build.motherboard_meta,
                ram: build.ram_meta,
                storage: build.storage_meta,
                psu: build.psu_meta,
                cabinet: build.cabinet_meta
            },
            total_estimated: this.calculateTotal(build), // ✅ Fixed function call
            compatibility_status: compatibility
        };
    }

    // Helper: Percentage logic
    getAllocation(totalBudget, intent) {
        if (intent === "GAMING") {
            return {
                gpu: totalBudget * 0.40,
                cpu: totalBudget * 0.20,
                motherboard: totalBudget * 0.12,
                ram: totalBudget * 0.08,
                storage: totalBudget * 0.08,
                psu: totalBudget * 0.07,
                cabinet: totalBudget * 0.05
            };
        } else {
            return {
                gpu: totalBudget * 0.20,
                cpu: totalBudget * 0.35,
                motherboard: totalBudget * 0.15,
                ram: totalBudget * 0.10,
                storage: totalBudget * 0.10,
                psu: totalBudget * 0.05,
                cabinet: totalBudget * 0.05
            };
        }
    }

    // ✅ FIXED: Real Calculation Logic
    calculateTotal(build) {
        let total = 0;
        if (build.cpu_meta?.price_current) total += build.cpu_meta.price_current;
        if (build.gpu_meta?.price_current) total += build.gpu_meta.price_current;
        if (build.motherboard_meta?.price_current) total += build.motherboard_meta.price_current;
        if (build.ram_meta?.price_current) total += build.ram_meta.price_current;
        if (build.storage_meta?.price_current) total += build.storage_meta.price_current;
        if (build.psu_meta?.price_current) total += build.psu_meta.price_current;
        if (build.cabinet_meta?.price_current) total += build.cabinet_meta.price_current;
        return total;
    }
}

module.exports = new BuilderService();