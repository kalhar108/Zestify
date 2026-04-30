const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { sendEmail, eventApprovalEmail } = require('../utils/email');

const router = express.Router();

// GET /api/admin/events — All events for moderation
router.get('/events', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();
        const { status, page = 1, limit = 20 } = req.query;

        let where = [];
        let params = [];

        if (status) {
            where.push('e.status = ?');
            params.push(status);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { total } = db.prepare(`SELECT COUNT(*) as total FROM events e ${whereClause}`).get(...params);

        const events = db.prepare(`
      SELECT e.*, u.name as organizer_name, u.email as organizer_email, c.name as category_name
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      LEFT JOIN categories c ON e.category_id = c.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

        res.json({
            events: events.map(e => ({
                ...e,
                schedule: JSON.parse(e.schedule || '[]'),
            })),
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (err) {
        console.error('Admin events error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/admin/events/:id/approve
router.put('/events/:id/approve', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        db.prepare("UPDATE events SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

        // Log admin action
        db.prepare(
            "INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (?, 'approve', 'event', ?, ?)"
        ).run(req.user.id, req.params.id, req.body.reason || '');

        // Notify organizer
        db.prepare(
            "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'event_approved', ?, ?, ?)"
        ).run(event.organizer_id, 'Event Approved', `Your event "${event.title}" has been approved!`, `/events/${event.id}`);

        // Send email
        const organizer = db.prepare('SELECT * FROM users WHERE id = ?').get(event.organizer_id);
        sendEmail(eventApprovalEmail(organizer, event, true)).catch(console.error);

        res.json({ message: 'Event approved.' });
    } catch (err) {
        console.error('Approve event error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/admin/events/:id/reject
router.put('/events/:id/reject', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        db.prepare("UPDATE events SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

        db.prepare(
            "INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (?, 'reject', 'event', ?, ?)"
        ).run(req.user.id, req.params.id, req.body.reason || '');

        // Notify organizer
        db.prepare(
            "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'event_rejected', ?, ?, ?)"
        ).run(event.organizer_id, 'Event Rejected', `Your event "${event.title}" was not approved. ${req.body.reason || ''}`, `/dashboard/my-events`);

        // Send email
        const organizer = db.prepare('SELECT * FROM users WHERE id = ?').get(event.organizer_id);
        sendEmail(eventApprovalEmail(organizer, event, false)).catch(console.error);

        res.json({ message: 'Event rejected.' });
    } catch (err) {
        console.error('Reject event error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/admin/users — All users
router.get('/users', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();
        const { role, search, page = 1, limit = 20 } = req.query;

        let where = [];
        let params = [];

        if (role) {
            where.push('role = ?');
            params.push(role);
        }

        if (search) {
            where.push('(name LIKE ? OR email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { total } = db.prepare(`SELECT COUNT(*) as total FROM users ${whereClause}`).get(...params);

        const users = db.prepare(`
      SELECT id, name, email, role, avatar, bio, phone, created_at, is_active
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

        // Get event & ticket counts for each user
        const enrichedUsers = users.map(u => {
            const eventCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE organizer_id = ?').get(u.id).count;
            const ticketCount = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = 'confirmed'").get(u.id).count;
            return { ...u, eventCount, ticketCount };
        });

        res.json({
            users: enrichedUsers,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/admin/users/:id/role — Change user role
router.put('/users/:id/role', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();
        const { role } = req.body;

        if (!['attendee', 'organizer', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);

        db.prepare(
            "INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (?, ?, 'user', ?, ?)"
        ).run(req.user.id, `change_role_to_${role}`, req.params.id, req.body.reason || '');

        res.json({ message: `User role changed to ${role}.` });
    } catch (err) {
        console.error('Change role error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/admin/users/:id/toggle — Toggle user active status
router.put('/users/:id/toggle', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'You cannot deactivate your own account.' });
        }

        const newStatus = user.is_active ? 0 : 1;
        db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, req.params.id);

        db.prepare(
            "INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (?, ?, 'user', ?, ?)"
        ).run(req.user.id, newStatus ? 'activate' : 'deactivate', req.params.id, req.body.reason || '');

        res.json({ message: `User ${newStatus ? 'activated' : 'deactivated'}.` });
    } catch (err) {
        console.error('Toggle user error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/admin/stats — Admin dashboard stats
router.get('/stats', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const db = getDb();

        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
        const pendingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'pending'").get().count;
        const approvedEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'approved'").get().count;
        const totalTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'confirmed'").get().count;
        const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM tickets WHERE payment_status = 'completed'").get().total;

        const usersByRole = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all();
        const recentActions = db.prepare(`
      SELECT aa.*, u.name as admin_name
      FROM admin_actions aa
      JOIN users u ON aa.admin_id = u.id
      ORDER BY aa.created_at DESC
      LIMIT 10
    `).all();

        res.json({
            stats: {
                totalUsers,
                totalEvents,
                pendingEvents,
                approvedEvents,
                totalTickets,
                totalRevenue,
                usersByRole,
                recentActions,
            },
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
