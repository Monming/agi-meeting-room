const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/** Match how Mongoose stores emails (schema: lowercase + trim). */
function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

exports.register = async (req, res) => {
  console.log('[DEBUG] Register body:', req.body);
  try {
    const { name, password, role } = req.body;
    const email = normalizeEmail(req.body?.email);

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name: typeof name === 'string' ? name.trim() : name,
      email,
      password: hashedPassword,
      role: role || 'employee'
    });

    await user.save();
    console.log('[DEBUG] User saved:', { id: user._id, name: user.name, email: user.email, role: user.role });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('[ERROR] Registration error:', error.message);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecret_default_key',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: payload
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
