const Store = require('../models/Store');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');

exports.getStores = async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true });
    res.status(200).json({ success: true, data: stores });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.createStore = async (req, res) => {
  try {
    const { name, code, address, capacity, manager, isActive, image } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const newStore = new Store({ name, code, address, capacity, manager, isActive, image });
    await newStore.save();
    res.status(201).json({ success: true, data: newStore });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByIdAndUpdate(id, req.body, { new: true });
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findByIdAndDelete(id);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.status(200).json({ success: true, message: 'Store deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.getMaterials = async (req, res) => {
  try {
    const materials = await Material.find();
    res.status(200).json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.createMaterial = async (req, res) => {
  try {
    const { name, sku, category, baseUnit, minStockAlert } = req.body;
    if (!name || !sku || !baseUnit) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const newMaterial = new Material({
      name,
      sku,
      category,
      baseUnit,
      minStockAlert: minStockAlert || 0
    });
    await newMaterial.save();
    res.status(201).json({ success: true, data: newMaterial });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'SKU already exists' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
