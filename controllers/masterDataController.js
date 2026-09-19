const Store = require('../models/Store');
const Material = require('../models/Material');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');

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

exports.updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, minStockAlert, sku, category, baseUnit } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (minStockAlert !== undefined) updateData.minStockAlert = minStockAlert;
    if (sku !== undefined) updateData.sku = sku;
    if (category !== undefined) updateData.category = category;
    if (baseUnit !== undefined) updateData.baseUnit = baseUnit;

    const material = await Material.findByIdAndUpdate(id, updateData, { new: true });
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });
    res.status(200).json({ success: true, data: material });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findByIdAndDelete(id);
    if (!material) return res.status(404).json({ success: false, message: 'Material not found' });
    await Inventory.deleteMany({ material: id });
    res.status(200).json({ success: true, message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
