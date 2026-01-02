// 4. controllers/buildController.js

const builderService = require('../logic/BuilderService');

exports.generatePCBuild = async (req, res) => {
    try {
        const { budget, intent } = req.body;

        if (!budget || budget < 30000) {
            return res.status(400).json({ error: "Budget must be at least ₹30,000" });
        }

        console.log(`Generating build for ₹${budget} - ${intent}`);
        
        // Builder Service ko call karo
        const result = await builderService.generateBuild(Number(budget), intent);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("Build Error:", error);
        res.status(500).json({ error: "Failed to generate build", details: error.message });
    }
};