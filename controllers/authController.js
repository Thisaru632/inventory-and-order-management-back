const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    let isMatch = false;
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Fallback for unhashed legacy password & auto-hash
      if (password === user.password) {
        isMatch = true;
        user.password = password;
        await user.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Logged in successfully', 
      user: { 
        id: user._id,
        email: user.email, 
        name: user.name,
        role: user.role,
        phone: user.phone || '',
        address: user.address || '',
        warehouse: user.warehouse,
        permissions: user.permissions,
        status: user.status
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const user = new User({
      name: name || email.split('@')[0],
      email,
      password,
      phone: phone || '',
      address: address || '',
      role: 'Customer',
      warehouse: 'All Warehouses',
      status: 'Active',
      permissions: ['customer']
    });

    await user.save();
    
    const userPayload = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone || '',
      address: user.address || '',
      warehouse: user.warehouse,
      permissions: user.permissions,
      status: user.status
    };
    
    res.status(201).json({ 
      success: true, 
      data: userPayload, 
      user: userPayload,
      message: 'Account created successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, warehouse, status, permissions, phone, address } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = new User({
      name,
      email,
      password,
      phone: phone || '',
      address: address || '',
      role: role || 'Admin',
      warehouse: warehouse || 'All Warehouses',
      status: status || 'Active',
      permissions: permissions || []
    });

    await user.save();
    
    // Don't send back password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({ success: true, data: userResponse, message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (password && password.trim() !== '') {
      user.password = password;
    }

    await user.save();

    const userPayload = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone || '',
      address: user.address || '',
      warehouse: user.warehouse,
      permissions: user.permissions,
      status: user.status
    };

    res.status(200).json({ 
      success: true, 
      data: userPayload, 
      user: userPayload, 
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, warehouse, status, permissions, phone, address } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (password && password.trim() !== '') {
      user.password = password;
    }
    user.role = role || user.role;
    user.warehouse = warehouse || user.warehouse;
    user.status = status || user.status;
    if (permissions) user.permissions = permissions;

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({ success: true, data: userResponse, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.role === 'Super Admin' || user.role === 'superadmin') {
      return res.status(400).json({ success: false, message: 'Cannot delete Super Admin user' });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
