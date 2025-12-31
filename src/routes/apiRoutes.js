const express = require('express');
const router = express.Router();
const componentController = require('../controllers/componentController');
const categoryController = require('../controllers/categoryController');
const masterController = require('../controllers/masterController');

router.get('/master-data', masterController.getInitData);
router.post('/categories', categoryController.createCategory);
router.get('/categories', categoryController.getCategories);

router.get('/components', componentController.getComponents);
router.get('/components/:id', componentController.getComponentById);
router.post('/components', componentController.createComponent);
router.patch('/components/:id', componentController.updateComponent);

router.post('/components/track-link', componentController.addTrackedLink);
router.post('/components/manual-offer', componentController.addManualOffer);
router.post('/components/fetch-specs', componentController.fetchSpecs);

module.exports = router;