const express = require('express');
const router = express.Router();
const componentController = require('../controllers/componentController');
const categoryController = require('../controllers/categoryController');
const masterController = require('../controllers/masterController');
const buildController = require('../controllers/buildController');
const ruleController = require('../controllers/ruleController');
router.get('/master-data', masterController.getInitData);
router.get('/categories', categoryController.getCategories);
router.get('/rules', ruleController.getRules);

router.get('/components', componentController.getComponents);
router.get('/components/:id', componentController.getComponentById);
router.post('/categories', categoryController.createCategory);
router.post('/components', componentController.createComponent);
router.patch('/components/:id', componentController.updateComponent);
router.delete('/components/:id', componentController.deleteComponent);

router.post('/components/manual-offer', componentController.addManualOffer);
router.post('/components/fetch-specs', componentController.fetchSpecs);
router.post('/build/generate', buildController.generatePCBuild);

router.post('/rules', ruleController.createRule);
router.delete('/rules/:id', ruleController.deleteRule);
router.post('/rules/validate', ruleController.validateBuild);

module.exports = router;