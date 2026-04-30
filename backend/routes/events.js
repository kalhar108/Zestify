const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { validate } = require('../middleware/validate');
const { generateCalendarFile, generateGoogleCalendarUrl } = require('../utils/calendar');

const router = express.Router();

// GET /api/events — List/search events
router.get('/', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const {
            search, category, city, date_from, date_to,
            is_online, is_featured, status = 'approved',
            sort = 'date', order = 'asc',
            page = 1, limit = 12,
        } = req.query;

        let where = ['e.status = ?'];
        let params = [status];

        if (search) {
            where.push('(e.title LIKE ? OR e.description LIKE ? OR e.tags LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        if (category) {
            where.push('c.slug = ?');
            params.push(category);
        }

        if (city) {
            where.push('e.city LIKE ?');
            params.push(`%${city}%`);
        }

        if (date_from) {
            where.push('e.date >= ?');
            params.push(date_from);
        }

        if (date_to) {
            where.push('e.date <= ?');
            params.push(date_to);
        }

        if (is_online !== undefined) {
            where.push('e.is_online = ?');
            params.push(is_online === 'true' ? 1 : 0);
        }

        if (is_featured !== undefined) {
            where.push('e.is_featured = ?');
            params.push(is_featured === 'true' ? 1 : 0);
        }

        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

        const validSorts = { date: 'e.date', title: 'e.title', created: 'e.created_at', price: 'e.price' };
        const sortCol = validSorts[sort] || 'e.date';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Count total
        const countQuery = `SELECT COUNT(*) as total FROM events e LEFT JOIN categories c ON e.category_id = c.id ${whereClause}`;
        const { total } = db.prepare(countQuery).get(...params);

        // Fetch events
        const query = `
      SELECT e.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon, c.color as category_color,
             u.name as organizer_name, u.email as organizer_email, u.avatar as organizer_avatar
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.organizer_id = u.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
        params.push(parseInt(limit), offset);

        const events = db.prepare(query).all(...params);

        res.json({
            events: events.map(e => ({
                ...e,
                schedule: JSON.parse(e.schedule || '[]'),
                spots_left: e.capacity - e.tickets_sold,
            })),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error('List events error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/events/categories — get all categories
router.get('/categories', (req, res) => {
    try {
        const db = getDb();
        const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
        res.json({ categories });
    } catch (err) {
        console.error('Categories error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/events/featured — get featured events
router.get('/featured', (req, res) => {
    try {
        const db = getDb();
        const events = db.prepare(`
      SELECT e.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon, c.color as category_color,
             u.name as organizer_name
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.organizer_id = u.id
      WHERE e.status = 'approved' AND e.is_featured = 1
      ORDER BY e.date ASC
      LIMIT 6
    `).all();

        res.json({
            events: events.map(e => ({
                ...e,
                schedule: JSON.parse(e.schedule || '[]'),
                spots_left: e.capacity - e.tickets_sold,
            })),
        });
    } catch (err) {
        console.error('Featured events error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/events/stats — get platform stats
router.get('/stats', (req, res) => {
    try {
        const db = getDb();
        const totalEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'approved'").get().count;
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'confirmed'").get().count;
        const totalOrganizers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'organizer'").get().count;

        res.json({ stats: { totalEvents, totalUsers, totalTickets, totalOrganizers } });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/events/:id — Get single event
router.get('/:id', optionalAuth, (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare(`
      SELECT e.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon, c.color as category_color,
             u.name as organizer_name, u.email as organizer_email, u.avatar as organizer_avatar, u.bio as organizer_bio
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.organizer_id = u.id
      WHERE e.id = ?
    `).get(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        let hasTicket = false;
        let userTicket = null;
        if (req.user) {
            userTicket = db.prepare('SELECT * FROM tickets WHERE user_id = ? AND event_id = ? AND status != ?').get(req.user.id, event.id, 'cancelled');
            hasTicket = !!userTicket;
        }

        const calendarUrl = generateGoogleCalendarUrl(event);

        res.json({
            event: {
                ...event,
                schedule: JSON.parse(event.schedule || '[]'),
                spots_left: event.capacity - event.tickets_sold,
                google_calendar_url: calendarUrl,
            },
            hasTicket,
            userTicket,
        });
    } catch (err) {
        console.error('Get event error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/events/:id/calendar — Download .ics file
router.get('/:id/calendar', (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        const ical = generateCalendarFile(event);
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="${event.slug}.ics"`);
        res.send(ical);
    } catch (err) {
        console.error('Calendar error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/events — Create event (organizer only)
router.post('/', authenticateToken, requireRole('organizer', 'admin'), validate({
    title: { required: true, type: 'string', minLength: 3, maxLength: 200 },
    description: { required: true, type: 'string', minLength: 10 },
    date: { required: true, type: 'string' },
    time: { required: true, type: 'string' },
    location: { required: true, type: 'string' },
    capacity: { required: true, type: 'number', min: 1 },
}), (req, res) => {
    try {
        const db = getDb();
        const {
            title, description, short_description = '', date, end_date = null,
            time, end_time = null, location, venue_name = '', address = '',
            city = '', state = '', zip = '', latitude = null, longitude = null,
            is_online = 0, online_url = '', capacity, price = 0,
            category_id = null, tags = '', schedule = '[]', image = null,
        } = req.body;

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const result = db.prepare(`
      INSERT INTO events (title, slug, description, short_description, date, end_date, time, end_time,
        location, venue_name, address, city, state, zip, latitude, longitude, is_online, online_url,
        capacity, price, image, organizer_id, category_id, status, tags, schedule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
            title, slug, description, short_description, date, end_date,
            time, end_time, location, venue_name, address, city, state, zip,
            latitude, longitude, is_online ? 1 : 0, online_url, capacity, price,
            image, req.user.id, category_id, tags,
            typeof schedule === 'string' ? schedule : JSON.stringify(schedule)
        );

        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({
            message: 'Event created successfully. Pending admin approval.',
            event: { ...event, schedule: JSON.parse(event.schedule || '[]') },
        });
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// PUT /api/events/:id — Update event
router.put('/:id', authenticateToken, requireRole('organizer', 'admin'), (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        if (req.user.role !== 'admin' && event.organizer_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own events.' });
        }

        const {
            title, description, short_description, date, end_date,
            time, end_time, location, venue_name, address,
            city, state, zip, latitude, longitude,
            is_online, online_url, capacity, price,
            category_id, tags, schedule, image,
        } = req.body;

        db.prepare(`
      UPDATE events SET
        title = COALESCE(?, title), description = COALESCE(?, description),
        short_description = COALESCE(?, short_description),
        date = COALESCE(?, date), end_date = COALESCE(?, end_date),
        time = COALESCE(?, time), end_time = COALESCE(?, end_time),
        location = COALESCE(?, location), venue_name = COALESCE(?, venue_name),
        address = COALESCE(?, address), city = COALESCE(?, city),
        state = COALESCE(?, state), zip = COALESCE(?, zip),
        latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
        is_online = COALESCE(?, is_online), online_url = COALESCE(?, online_url),
        capacity = COALESCE(?, capacity), price = COALESCE(?, price),
        category_id = COALESCE(?, category_id), tags = COALESCE(?, tags),
        schedule = COALESCE(?, schedule), image = COALESCE(?, image),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
            title, description, short_description, date, end_date,
            time, end_time, location, venue_name, address,
            city, state, zip, latitude, longitude,
            is_online !== undefined ? (is_online ? 1 : 0) : undefined,
            online_url, capacity, price, category_id, tags,
            schedule ? (typeof schedule === 'string' ? schedule : JSON.stringify(schedule)) : undefined,
            image, req.params.id
        );

        const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
        res.json({
            message: 'Event updated.',
            event: { ...updated, schedule: JSON.parse(updated.schedule || '[]') },
        });
    } catch (err) {
        console.error('Update event error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// DELETE /api/events/:id
router.delete('/:id', authenticateToken, requireRole('organizer', 'admin'), (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        if (req.user.role !== 'admin' && event.organizer_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own events.' });
        }

        db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
        res.json({ message: 'Event deleted.' });
    } catch (err) {
        console.error('Delete event error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/events/:id/attendees — Event attendees (organizer/admin)
router.get('/:id/attendees', authenticateToken, requireRole('organizer', 'admin'), (req, res) => {
    try {
        const db = getDb();
        const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found.' });
        }

        if (req.user.role !== 'admin' && event.organizer_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only view attendees of your own events.' });
        }

        const attendees = db.prepare(`
      SELECT t.*, u.name, u.email, u.phone, u.avatar
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = ? AND t.status != 'cancelled'
      ORDER BY t.created_at DESC
    `).all(req.params.id);

        res.json({
            event: { id: event.id, title: event.title },
            attendees,
            total: attendees.length,
        });
    } catch (err) {
        console.error('Attendees error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
