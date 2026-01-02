const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jsonLogic = require('json-logic-js');

// 1. Create a New Rule
exports.createRule = async (req, res) => {
    try {
        const { name, severity, message, appliesTo, logic } = req.body;
        const rule = await prisma.compatibilityRule.create({
            data: { name, severity, message, appliesTo, logic }
        });
        res.json(rule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get All Rules
exports.getRules = async (req, res) => {
    try {
        const rules = await prisma.compatibilityRule.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Validate Build (Main Logic)
exports.validateBuild = async (req, res) => {
    try {
        // Frontend se selected components aayenge
        // e.g. { cpu: { socket: "AM5" }, motherboard: { socket: "LGA1700" } }
        const buildContext = req.body; 
        
        const activeRules = await prisma.compatibilityRule.findMany({
            where: { isActive: true }
        });

        const issues = [];

        for (const rule of activeRules) {
            // Check agar rule ke liye required components build mein hain ya nahi
            const requiredComponents = rule.appliesTo || [];
            const hasAllComponents = requiredComponents.every(
                key => buildContext[key.toLowerCase()]
            );

            if (!hasAllComponents) continue; // Skip rule if parts missing

            // Logic execute karo
            // Rule logic example: { "==": [{"var": "cpu.socket"}, {"var": "motherboard.socket"}] }
            // Agar result TRUE hai, matlab sab sahi hai. FALSE matlab error.
            const passed = jsonLogic.apply(rule.logic, buildContext);

            if (!passed) {
                issues.push({
                    ruleId: rule.id,
                    severity: rule.severity,
                    message: rule.message,
                    components: rule.appliesTo
                });
            }
        }

        res.json({ isValid: issues.length === 0, issues });

    } catch (error) {
        console.error("Validation Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// 4. Delete Rule
exports.deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.compatibilityRule.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};