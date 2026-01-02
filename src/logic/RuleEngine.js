// 2. logic/RuleEngine.js

class RuleEngine {
    
    // Main function jo poore build ko check karega
    checkCompatibility(build) {
        const errors = [];
        const warnings = [];

        // 1. CPU aur Motherboard ka Socket Check
        if (build.cpu && build.motherboard) {
            if (build.cpu.socket !== build.motherboard.socket) {
                errors.push(`❌ Socket Mismatch: CPU needs ${build.cpu.socket}, Board supports ${build.motherboard.socket}`);
            }
        }

        // 2. RAM aur Motherboard ka Type Check (DDR4 vs DDR5)
        if (build.ram && build.motherboard) {
            if (build.ram.memory_type !== build.motherboard.memory_type) {
                errors.push(`❌ RAM Mismatch: Board needs ${build.motherboard.memory_type}, RAM is ${build.ram.memory_type}`);
            }
        }

        // 3. Cabinet aur Motherboard Size Check
        if (build.cabinet && build.motherboard) {
            // supported_forms array hai, e.g., ["ATX", "mATX"]
            if (!build.cabinet.supported_forms.includes(build.motherboard.form_factor)) {
                errors.push(`❌ Case Size Mismatch: Case supports ${build.cabinet.supported_forms.join(',')}, Board is ${build.motherboard.form_factor}`);
            }
        }

        // 4. GPU aur Cabinet ki Length Check
        if (build.gpu && build.cabinet) {
            if (build.gpu.length_mm > build.cabinet.max_gpu_len_mm) {
                errors.push(`❌ GPU Too Long: GPU is ${build.gpu.length_mm}mm, Case max is ${build.cabinet.max_gpu_len_mm}mm`);
            }
        }

        // 5. Power Supply (PSU) Calculation
        if (build.psu) {
            const cpuPower = build.cpu ? build.cpu.tdp_watts : 0;
            const gpuPower = build.gpu ? build.gpu.tdp_watts : 0;
            const otherParts = 100; // Motherboard, Fans, SSDs buffer
            
            const totalNeeded = cpuPower + gpuPower + otherParts;

            if (build.psu.wattage < totalNeeded) {
                errors.push(`❌ Weak PSU: System needs ~${totalNeeded}W, PSU is only ${build.psu.wattage}W`);
            } else if (build.psu.wattage < totalNeeded * 1.2) {
                warnings.push(`⚠️ Low Headroom: PSU load is high. Recommended: ${Math.round(totalNeeded * 1.2)}W+`);
            }
        }

        return { 
            valid: errors.length === 0, 
            errors, 
            warnings 
        };
    }
}

module.exports = new RuleEngine();