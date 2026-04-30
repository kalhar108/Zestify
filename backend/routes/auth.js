const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/register
router.post('/register', validate({
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string', minLength: 6 },
    role: { required: false, type: 'string', enum: ['attendee', 'organizer'] },
}), (req, res) => {
    try {
        const db = getDb();
        const { name, email, password, role = 'attendee', bio = '', phone = '' } = req.body;

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO users (name, email, password, role, bio, phone) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(name, email, hashedPassword, role, bio, phone);

        const user = db.prepare('SELECT id, name, email, role, bio, phone, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
        const token = generateToken(user);

        res.status(201).json({
            message: 'Account created successfully.',
            token,
            user,
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/auth/login
router.post('/login', validate({
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string' },
}), (req, res) => {
    try {
        const db = getDb();
        const { email, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Your account has been deactivated.' });
        }

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = generateToken(user);
        const { password: _, ...safeUser } = user;

        res.json({
            message: 'Login successful.',
            token,
            user: safeUser,
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare('SELECT id, name, email, role, avatar, bio, phone, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const { name, bio, phone } = req.body;

        db.prepare('UPDATE users SET name = COALESCE(?, name), bio = COALESCE(?, bio), phone = COALESCE(?, phone), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(name, bio, phone, req.user.id);

        const user = db.prepare('SELECT id, name, email, role, avatar, bio, phone, created_at FROM users WHERE id = ?').get(req.user.id);
        res.json({ message: 'Profile updated.', user });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
