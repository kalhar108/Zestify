const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, closeDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5001'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database on startup
getDb();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    closeDb();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Zestify API running on http://localhost:${PORT}`);
    console.log(`📚 Endpoints available:`);
    console.log(`   POST   /api/auth/register`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/me`);
    console.log(`   GET    /api/events`);
    console.log(`   GET    /api/events/:id`);
    console.log(`   POST   /api/events`);
    console.log(`   GET    /api/tickets/my`);
    console.log(`   POST   /api/tickets`);
    console.log(`   GET    /api/admin/events`);
    console.log(`   GET    /api/admin/users`);
    console.log(`   GET    /api/notifications`);
    console.log(`   GET    /api/health\n`);
});

module.exports = app;
