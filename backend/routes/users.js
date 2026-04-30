const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();

// GET /api/users/me/events — Get organizer's events
router.get('/me/events', authenticateToken, requireRole('organizer', 'admin'), (req, res) => {
    try {
        const db = getDb();
        const { status, page = 1, limit = 20 } = req.query;

        let where = ['e.organizer_id = ?'];
        let params = [req.user.id];

        if (status) {
            where.push('e.status = ?');
            params.push(status);
        }

        const whereClause = `WHERE ${where.join(' AND ')}`;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { total } = db.prepare(`SELECT COUNT(*) as total FROM events e ${whereClause}`).get(...params);

        const events = db.prepare(`
      SELECT e.*, c.name as category_name, c.icon as category_icon,
        (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'confirmed') as confirmed_tickets
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

        res.json({
            events: events.map(e => ({
                ...e,
                schedule: JSON.parse(e.schedule || '[]'),
                spots_left: e.capacity - e.tickets_sold,
            })),
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (err) {
        console.error('My events error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/users/me/stats — Organizer stats
router.get('/me/stats', authenticateToken, requireRole('organizer', 'admin'), (req, res) => {
    try {
        const db = getDb();

        const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events WHERE organizer_id = ?').get(req.user.id).count;
        const approvedEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE organizer_id = ? AND status = 'approved'").get(req.user.id).count;
        const pendingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE organizer_id = ? AND status = 'pending'").get(req.user.id).count;
        const totalAttendees = db.prepare(`
      SELECT COUNT(*) as count FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE e.organizer_id = ? AND t.status = 'confirmed'
    `).get(req.user.id).count;
        const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(t.total_price), 0) as total FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE e.organizer_id = ? AND t.payment_status = 'completed'
    `).get(req.user.id).total;

        res.json({
            stats: { totalEvents, approvedEvents, pendingEvents, totalAttendees, totalRevenue },
        });
    } catch (err) {
        console.error('Organizer stats error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
