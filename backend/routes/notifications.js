const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — Get user notifications
router.get('/', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const { unread_only, page = 1, limit = 20 } = req.query;

        let where = ['user_id = ?'];
        let params = [req.user.id];

        if (unread_only === 'true') {
            where.push('is_read = 0');
        }

        const whereClause = `WHERE ${where.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { total } = db.prepare(`SELECT COUNT(*) as total FROM notifications ${whereClause}`).get(...params);
        const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).count;

        const notifications = db.prepare(`
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

        res.json({
            notifications,
            unreadCount,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (err) {
        console.error('Notifications error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/notifications/:id/read — Mark as read
router.put('/:id/read', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const notif = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

        if (!notif) {
            return res.status(404).json({ error: 'Notification not found.' });
        }

        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Notification marked as read.' });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/notifications/read-all — Mark all as read
router.put('/read-all', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
        res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
