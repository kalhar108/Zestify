const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendEmail, ticketConfirmationEmail } = require('../utils/email');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /api/tickets — Register / Purchase ticket
router.post('/', authenticateToken, validate({
    event_id: { required: true, type: 'number' },
    quantity: { required: false, type: 'number', min: 1, max: 10 },
}), (req, res) => {
    try {
        const db = getDb();
        const { event_id, quantity = 1, payment_method = 'free' } = req.body;

        // Check event exists and is approved
        const event = db.prepare("SELECT * FROM events WHERE id = ? AND status = 'approved'").get(event_id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found or not available.' });
        }

        // Check if already registered
        const existingTicket = db.prepare("SELECT * FROM tickets WHERE user_id = ? AND event_id = ? AND status != 'cancelled'").get(req.user.id, event_id);
        if (existingTicket) {
            return res.status(409).json({ error: 'You already have a ticket for this event.' });
        }

        // Check capacity
        const spotsLeft = event.capacity - event.tickets_sold;
        if (quantity > spotsLeft) {
            return res.status(400).json({ error: `Only ${spotsLeft} spots remaining.` });
        }

        const ticketCode = uuidv4().slice(0, 8).toUpperCase();
        const totalPrice = event.price * quantity;

        const result = db.prepare(`
      INSERT INTO tickets (ticket_code, user_id, event_id, quantity, total_price, status, payment_method, payment_status)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?, 'completed')
    `).run(ticketCode, req.user.id, event_id, quantity, totalPrice, totalPrice > 0 ? 'mock_card' : 'free');

        // Update tickets_sold
        db.prepare('UPDATE events SET tickets_sold = tickets_sold + ? WHERE id = ?').run(quantity, event_id);

        // Create notification for attendee
        db.prepare(
            "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'ticket_confirmation', ?, ?, ?)"
        ).run(req.user.id, 'Ticket Confirmed!', `Your ticket for ${event.title} has been confirmed.`, `/events/${event_id}`);

        // Create notification for organizer
        const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
        db.prepare(
            "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'info', ?, ?, ?)"
        ).run(event.organizer_id, 'New Registration', `${user.name} registered for ${event.title}.`, `/dashboard/attendees/${event_id}`);

        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);

        // Send confirmation email (async, don't block response)
        const userFull = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        sendEmail(ticketConfirmationEmail(userFull, event, ticket)).catch(console.error);

        res.status(201).json({
            message: 'Ticket confirmed!',
            ticket,
        });
    } catch (err) {
        console.error('Create ticket error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// GET /api/tickets/my — My tickets
router.get('/my', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const tickets = db.prepare(`
      SELECT t.*, e.title as event_title, e.date as event_date, e.time as event_time,
             e.location as event_location, e.image as event_image, e.slug as event_slug,
             e.is_online as event_is_online, e.online_url as event_online_url,
             c.name as category_name, c.icon as category_icon
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `).all(req.user.id);

        res.json({ tickets });
    } catch (err) {
        console.error('My tickets error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// DELETE /api/tickets/:id — Cancel ticket
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const db = getDb();
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }

        if (ticket.status === 'cancelled') {
            return res.status(400).json({ error: 'Ticket is already cancelled.' });
        }

        db.prepare("UPDATE tickets SET status = 'cancelled' WHERE id = ?").run(req.params.id);
        db.prepare('UPDATE events SET tickets_sold = tickets_sold - ? WHERE id = ?').run(ticket.quantity, ticket.event_id);

        // Notify user
        const event = db.prepare('SELECT title FROM events WHERE id = ?').get(ticket.event_id);
        db.prepare(
            "INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'warning', ?, ?, ?)"
        ).run(req.user.id, 'Ticket Cancelled', `Your ticket for ${event.title} has been cancelled.`, `/events/${ticket.event_id}`);

        res.json({ message: 'Ticket cancelled successfully.' });
    } catch (err) {
        console.error('Cancel ticket error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
