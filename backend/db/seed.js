const { getDb } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function seed() {
    const db = getDb();

    // Clear existing data
    db.exec('DELETE FROM admin_actions');
    db.exec('DELETE FROM notifications');
    db.exec('DELETE FROM tickets');
    db.exec('DELETE FROM events');
    db.exec('DELETE FROM categories');
    db.exec('DELETE FROM users');

    // Reset auto-increment
    db.exec("DELETE FROM sqlite_sequence");

    // --- USERS ---
    const hashedPassword = bcrypt.hashSync('password123', 10);

    const insertUser = db.prepare(
        'INSERT INTO users (name, email, password, role, bio, phone) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const users = [
        ['Admin User', 'admin@zestify.com', hashedPassword, 'admin', 'Platform administrator', '555-0100'],
        ['Sarah Chen', 'sarah@zestify.com', hashedPassword, 'organizer', 'Tech event organizer & community builder based in San Francisco', '555-0101'],
        ['Marcus Johnson', 'marcus@zestify.com', hashedPassword, 'organizer', 'Music festival curator and live event specialist', '555-0102'],
        ['Elena Rodriguez', 'elena@zestify.com', hashedPassword, 'organizer', 'Wellness coach & retreat organizer', '555-0103'],
        ['David Kim', 'david@zestify.com', hashedPassword, 'organizer', 'Professional chef & culinary event host', '555-0104'],
        ['Alex Thompson', 'alex@zestify.com', hashedPassword, 'attendee', 'Tech enthusiast and startup founder', '555-0201'],
        ['Maya Patel', 'maya@zestify.com', hashedPassword, 'attendee', 'Digital artist and music lover', '555-0202'],
        ['James Wilson', 'james@zestify.com', hashedPassword, 'attendee', 'Software engineer & conference regular', '555-0203'],
        ['Lisa Wang', 'lisa@zestify.com', hashedPassword, 'attendee', 'Marketing professional exploring new events', '555-0204'],
        ['Chris Brown', 'chris@zestify.com', hashedPassword, 'attendee', 'Fitness enthusiast & outdoor adventurer', '555-0205'],
    ];

    const insertManyUsers = db.transaction((users) => {
        for (const u of users) {
            insertUser.run(...u);
        }
    });
    insertManyUsers(users);

    // --- CATEGORIES ---
    const insertCategory = db.prepare(
        'INSERT INTO categories (name, slug, icon, color, description) VALUES (?, ?, ?, ?, ?)'
    );

    const categories = [
        ['Technology', 'technology', '💻', '#7c3aed', 'Tech conferences, hackathons, and meetups'],
        ['Music', 'music', '🎵', '#ec4899', 'Concerts, festivals, and live performances'],
        ['Food & Drink', 'food-drink', '🍕', '#f97316', 'Food festivals, tastings, and culinary workshops'],
        ['Business', 'business', '💼', '#0ea5e9', 'Networking events, seminars, and workshops'],
        ['Health & Wellness', 'health-wellness', '🧘', '#10b981', 'Yoga retreats, fitness classes, and wellness workshops'],
        ['Arts & Culture', 'arts-culture', '🎨', '#f43f5e', 'Exhibitions, theater, and cultural events'],
        ['Sports', 'sports', '⚽', '#eab308', 'Sports events, tournaments, and outdoor activities'],
        ['Education', 'education', '📚', '#6366f1', 'Workshops, courses, and educational seminars'],
        ['Charity', 'charity', '❤️', '#ef4444', 'Fundraisers, volunteer events, and charity galas'],
        ['Outdoors', 'outdoors', '🏕️', '#22c55e', 'Hiking, camping, and outdoor adventures'],
    ];

    const insertManyCategories = db.transaction((cats) => {
        for (const c of cats) {
            insertCategory.run(...c);
        }
    });
    insertManyCategories(categories);

    // --- EVENTS ---
    const insertEvent = db.prepare(`
    INSERT INTO events (title, slug, description, short_description, date, end_date, time, end_time,
      location, venue_name, address, city, state, zip, latitude, longitude, is_online, online_url,
      capacity, tickets_sold, price, image, organizer_id, category_id, status, is_featured, tags, schedule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const events = [
        {
            title: 'SF Tech Summit 2026',
            slug: 'sf-tech-summit-2026',
            description: 'Join the biggest tech conference on the West Coast! Featuring keynotes from industry leaders, hands-on workshops, and unparalleled networking opportunities. Explore cutting-edge topics including AI, cloud computing, cybersecurity, and the future of software development. Whether you\'re a seasoned developer or just starting your tech journey, this summit has something for everyone.',
            short_description: 'The biggest tech conference on the West Coast with keynotes, workshops, and networking.',
            date: '2026-04-15', end_date: '2026-04-17', time: '09:00', end_time: '18:00',
            location: 'Moscone Center, San Francisco, CA', venue_name: 'Moscone Center',
            address: '747 Howard St', city: 'San Francisco', state: 'CA', zip: '94103',
            lat: 37.7849, lng: -122.4005, is_online: 0, online_url: '',
            capacity: 500, tickets_sold: 342, price: 0, image: null,
            organizer_id: 2, category_id: 1, status: 'approved', is_featured: 1,
            tags: 'tech,ai,cloud,networking',
            schedule: JSON.stringify([
                { time: '09:00', title: 'Registration & Welcome Coffee', description: 'Check in and grab your badge' },
                { time: '10:00', title: 'Opening Keynote: The Future of AI', description: 'Industry leader shares insights on AI trends' },
                { time: '12:00', title: 'Lunch & Networking', description: 'Catered lunch with networking opportunities' },
                { time: '14:00', title: 'Workshop: Building with LLMs', description: 'Hands-on workshop on large language models' },
                { time: '16:00', title: 'Panel: Future of Software Development', description: 'Expert panel discussion' },
            ])
        },
        {
            title: 'Neon Nights Music Festival',
            slug: 'neon-nights-music-festival',
            description: 'Experience three nights of incredible live music under the stars! Featuring top artists across genres including electronic, indie, hip-hop, and rock. Enjoy food trucks, art installations, and VIP lounges. The Neon Nights Music Festival is more than just a concert—it\'s a complete sensory experience that brings together music lovers from across the country.',
            short_description: 'Three nights of incredible live music under the stars with top artists.',
            date: '2026-05-22', end_date: '2026-05-24', time: '16:00', end_time: '23:00',
            location: 'Golden Gate Park, San Francisco, CA', venue_name: 'Golden Gate Park Bandshell',
            address: '75 Hagiwara Tea Garden Dr', city: 'San Francisco', state: 'CA', zip: '94118',
            lat: 37.7694, lng: -122.4862, is_online: 0, online_url: '',
            capacity: 2000, tickets_sold: 1456, price: 49.99, image: null,
            organizer_id: 3, category_id: 2, status: 'approved', is_featured: 1,
            tags: 'music,festival,live,outdoor',
            schedule: JSON.stringify([
                { time: '16:00', title: 'Gates Open', description: 'Welcome to Neon Nights!' },
                { time: '17:00', title: 'Opening Act', description: 'Local emerging artists' },
                { time: '19:00', title: 'Main Stage: Headliner Set 1', description: 'First headliner performance' },
                { time: '21:00', title: 'Main Stage: Headliner Set 2', description: 'Second headliner performance' },
            ])
        },
        {
            title: 'Mindful Living Retreat',
            slug: 'mindful-living-retreat',
            description: 'Escape the hustle and reconnect with yourself at our weekend wellness retreat. Enjoy guided meditation sessions, yoga classes, nature walks, and nutrition workshops led by certified wellness professionals. Set in the beautiful Napa Valley, this retreat is designed to help you find balance, reduce stress, and develop lasting healthy habits.',
            short_description: 'A weekend wellness retreat with meditation, yoga, and nature walks in Napa Valley.',
            date: '2026-03-28', end_date: '2026-03-29', time: '08:00', end_time: '17:00',
            location: 'Wellness Valley Resort, Napa, CA', venue_name: 'Wellness Valley Resort',
            address: '1000 Main St', city: 'Napa', state: 'CA', zip: '94559',
            lat: 38.2975, lng: -122.2869, is_online: 0, online_url: '',
            capacity: 50, tickets_sold: 38, price: 0, image: null,
            organizer_id: 4, category_id: 5, status: 'approved', is_featured: 1,
            tags: 'wellness,yoga,meditation,retreat',
            schedule: JSON.stringify([
                { time: '08:00', title: 'Morning Meditation', description: 'Guided sunrise meditation' },
                { time: '09:30', title: 'Yoga Flow', description: '90-minute vinyasa flow class' },
                { time: '12:00', title: 'Healthy Lunch', description: 'Plant-based organic lunch' },
                { time: '14:00', title: 'Nature Walk', description: 'Guided mindfulness nature walk' },
                { time: '16:00', title: 'Wellness Workshop', description: 'Nutrition and stress management' },
            ])
        },
        {
            title: 'Gourmet Street Food Festival',
            slug: 'gourmet-street-food-festival',
            description: 'Taste your way through the world\'s best street food! Over 50 vendors from 20+ countries will be serving up authentic dishes, fusion creations, and innovative culinary delights. Live cooking demos from celebrity chefs, cocktail workshops, and a dessert alley you won\'t want to miss. Bring your appetite and discover your new favorite dish!',
            short_description: 'Over 50 vendors from 20+ countries serving authentic and fusion street food.',
            date: '2026-06-14', end_date: '2026-06-14', time: '11:00', end_time: '21:00',
            location: 'Ferry Building, San Francisco, CA', venue_name: 'Ferry Building Marketplace',
            address: '1 Ferry Building', city: 'San Francisco', state: 'CA', zip: '94105',
            lat: 37.7956, lng: -122.3934, is_online: 0, online_url: '',
            capacity: 1000, tickets_sold: 678, price: 15.00, image: null,
            organizer_id: 5, category_id: 3, status: 'approved', is_featured: 1,
            tags: 'food,festival,street-food,culinary',
            schedule: JSON.stringify([
                { time: '11:00', title: 'Festival Opens', description: 'Start exploring the food stalls!' },
                { time: '13:00', title: 'Live Cooking Demo', description: 'Celebrity chef demonstration' },
                { time: '15:00', title: 'Cocktail Workshop', description: 'Learn to make craft cocktails' },
                { time: '18:00', title: 'Dessert Alley Opens', description: 'Sweet treats from around the world' },
            ])
        },
        {
            title: 'Startup Pitch Night',
            slug: 'startup-pitch-night',
            description: 'Watch 10 of the most promising startups pitch their ideas to a panel of top VCs and angel investors. Network with founders, investors, and tech professionals. Whether you\'re looking for your next investment opportunity or seeking inspiration for your own venture, Startup Pitch Night delivers an exciting evening of innovation and entrepreneurship.',
            short_description: 'Watch promising startups pitch to top VCs and network with founders.',
            date: '2026-04-08', end_date: null, time: '18:00', end_time: '21:00',
            location: 'WeWork, 535 Mission St, San Francisco', venue_name: 'WeWork Mission',
            address: '535 Mission St', city: 'San Francisco', state: 'CA', zip: '94105',
            lat: 37.7890, lng: -122.3983, is_online: 0, online_url: '',
            capacity: 150, tickets_sold: 112, price: 0, image: null,
            organizer_id: 2, category_id: 4, status: 'approved', is_featured: 0,
            tags: 'startup,pitch,investing,networking',
            schedule: JSON.stringify([
                { time: '18:00', title: 'Networking & Drinks', description: 'Casual networking with refreshments' },
                { time: '19:00', title: 'Pitch Session', description: '10 startups, 5 minutes each' },
                { time: '20:30', title: 'Q&A Panel', description: 'VCs share feedback and insights' },
            ])
        },
        {
            title: 'Virtual Design Systems Workshop',
            slug: 'virtual-design-systems-workshop',
            description: 'Learn how to build and maintain a scalable design system from scratch. This hands-on virtual workshop covers component libraries, design tokens, documentation, and collaboration between design and engineering teams. You\'ll leave with a working design system starter kit and actionable strategies for your organization.',
            short_description: 'Build a scalable design system from scratch in this hands-on virtual workshop.',
            date: '2026-03-20', end_date: null, time: '10:00', end_time: '16:00',
            location: 'Online (Zoom)', venue_name: '',
            address: '', city: '', state: '', zip: '',
            lat: null, lng: null, is_online: 1, online_url: 'https://zoom.us/j/example',
            capacity: 200, tickets_sold: 89, price: 0, image: null,
            organizer_id: 2, category_id: 1, status: 'approved', is_featured: 0,
            tags: 'design,workshop,virtual,ui-ux',
            schedule: JSON.stringify([
                { time: '10:00', title: 'Introduction to Design Systems', description: 'Why design systems matter' },
                { time: '11:30', title: 'Building Components', description: 'Hands-on component creation' },
                { time: '13:00', title: 'Lunch Break', description: '' },
                { time: '14:00', title: 'Design Tokens & Documentation', description: 'Scaling your system' },
            ])
        },
        {
            title: 'Bay Area Marathon 2026',
            slug: 'bay-area-marathon-2026',
            description: 'Run through San Francisco\'s most scenic routes in the annual Bay Area Marathon! Choose from full marathon, half marathon, or 10K distances. All participants receive a finisher medal, race shirt, and access to the post-race celebration with food, music, and awards. Professional timing and hydration stations provided throughout the course.',
            short_description: 'Run through SF\'s most scenic routes — marathon, half, or 10K distances.',
            date: '2026-07-12', end_date: null, time: '06:00', end_time: '14:00',
            location: 'Embarcadero, San Francisco, CA', venue_name: 'Embarcadero Plaza',
            address: 'Embarcadero', city: 'San Francisco', state: 'CA', zip: '94111',
            lat: 37.7949, lng: -122.3946, is_online: 0, online_url: '',
            capacity: 5000, tickets_sold: 3200, price: 75.00, image: null,
            organizer_id: 4, category_id: 7, status: 'approved', is_featured: 0,
            tags: 'marathon,running,sports,fitness',
            schedule: JSON.stringify([
                { time: '06:00', title: 'Full Marathon Start', description: '26.2 miles' },
                { time: '07:00', title: 'Half Marathon Start', description: '13.1 miles' },
                { time: '08:00', title: '10K Start', description: '6.2 miles' },
                { time: '12:00', title: 'Post-Race Celebration', description: 'Food, music, and awards' },
            ])
        },
        {
            title: 'Community Art Exhibition',
            slug: 'community-art-exhibition',
            description: 'Discover amazing local talent at our community art exhibition featuring paintings, sculptures, photography, and digital art from over 40 local artists. Enjoy wine and cheese while exploring the gallery, and meet the artists behind the works. Selected pieces will be available for purchase, with proceeds supporting local art education programs.',
            short_description: 'Featuring 40+ local artists with paintings, sculptures, photography & digital art.',
            date: '2026-04-25', end_date: '2026-04-27', time: '10:00', end_time: '20:00',
            location: 'SoMa Arts Center, San Francisco, CA', venue_name: 'SoMa Arts Center',
            address: '934 Brannan St', city: 'San Francisco', state: 'CA', zip: '94103',
            lat: 37.7731, lng: -122.4053, is_online: 0, online_url: '',
            capacity: 300, tickets_sold: 145, price: 0, image: null,
            organizer_id: 3, category_id: 6, status: 'approved', is_featured: 0,
            tags: 'art,exhibition,gallery,community',
            schedule: JSON.stringify([
                { time: '10:00', title: 'Gallery Opens', description: 'Browse the exhibition' },
                { time: '14:00', title: 'Artist Talk', description: 'Q&A with featured artists' },
                { time: '17:00', title: 'Wine & Cheese Reception', description: 'Evening reception' },
            ])
        },
        {
            title: 'Python for Data Science Bootcamp',
            slug: 'python-data-science-bootcamp',
            description: 'An intensive 2-day bootcamp covering Python fundamentals for data science. Learn pandas, NumPy, matplotlib, and scikit-learn through real-world projects. No prior Python experience required — just bring your laptop and curiosity! Certificate of completion provided to all participants.',
            short_description: 'Intensive 2-day bootcamp covering Python for data science with real-world projects.',
            date: '2026-05-10', end_date: '2026-05-11', time: '09:00', end_time: '17:00',
            location: 'UC Berkeley Extension, Berkeley, CA', venue_name: 'UC Berkeley Extension',
            address: '1995 University Ave', city: 'Berkeley', state: 'CA', zip: '94704',
            lat: 37.8716, lng: -122.2727, is_online: 0, online_url: '',
            capacity: 40, tickets_sold: 35, price: 0, image: null,
            organizer_id: 2, category_id: 8, status: 'approved', is_featured: 0,
            tags: 'python,data-science,bootcamp,education',
            schedule: JSON.stringify([
                { time: '09:00', title: 'Python Fundamentals', description: 'Variables, functions, and data structures' },
                { time: '11:00', title: 'Pandas & NumPy', description: 'Data manipulation and analysis' },
                { time: '14:00', title: 'Data Visualization', description: 'Matplotlib and seaborn' },
                { time: '16:00', title: 'Machine Learning Intro', description: 'Scikit-learn basics' },
            ])
        },
        {
            title: 'Charity Gala: Hope for Tomorrow',
            slug: 'charity-gala-hope-for-tomorrow',
            description: 'Join us for an elegant evening of giving at the Hope for Tomorrow Charity Gala. Enjoy a gourmet dinner, live entertainment, silent auction, and inspiring speeches from community leaders. All proceeds go to supporting youth education programs in underserved communities. Black-tie attire encouraged.',
            short_description: 'Elegant charity gala with dinner, entertainment, and silent auction for youth education.',
            date: '2026-06-05', end_date: null, time: '18:00', end_time: '23:00',
            location: 'The Ritz-Carlton, San Francisco, CA', venue_name: 'The Ritz-Carlton',
            address: '600 Stockton St', city: 'San Francisco', state: 'CA', zip: '94108',
            lat: 37.7910, lng: -122.4085, is_online: 0, online_url: '',
            capacity: 250, tickets_sold: 189, price: 150.00, image: null,
            organizer_id: 4, category_id: 9, status: 'approved', is_featured: 1,
            tags: 'charity,gala,fundraiser,community',
            schedule: JSON.stringify([
                { time: '18:00', title: 'Cocktail Reception', description: 'Welcome drinks and networking' },
                { time: '19:00', title: 'Dinner Service', description: 'Three-course gourmet dinner' },
                { time: '20:30', title: 'Keynote & Silent Auction', description: 'Inspiring speeches and bidding' },
                { time: '22:00', title: 'Live Entertainment', description: 'Live band and dancing' },
            ])
        },
        {
            title: 'Sunset Hike & Photography Walk',
            slug: 'sunset-hike-photography-walk',
            description: 'Join local photographer and hiking enthusiast for a scenic sunset hike through the Marin Headlands. Perfect for all skill levels — bring your camera (or phone!) and learn landscape photography tips while enjoying breathtaking views of the Golden Gate Bridge and the Pacific Ocean. Limited to 25 hikers for an intimate experience.',
            short_description: 'Scenic sunset hike with photography tips and Golden Gate Bridge views.',
            date: '2026-04-05', end_date: null, time: '16:30', end_time: '20:00',
            location: 'Marin Headlands, Sausalito, CA', venue_name: 'Marin Headlands Visitor Center',
            address: 'Field Rd', city: 'Sausalito', state: 'CA', zip: '94965',
            lat: 37.8270, lng: -122.4994, is_online: 0, online_url: '',
            capacity: 25, tickets_sold: 22, price: 0, image: null,
            organizer_id: 5, category_id: 10, status: 'approved', is_featured: 0,
            tags: 'hiking,photography,outdoors,sunset',
            schedule: JSON.stringify([
                { time: '16:30', title: 'Meet & Greet', description: 'Introduction and trail briefing' },
                { time: '17:00', title: 'Hike Begins', description: '3 mile scenic loop trail' },
                { time: '18:30', title: 'Sunset Photography', description: 'Golden hour photography session' },
                { time: '19:30', title: 'Group Photo & Wrap Up', description: 'Share your best shots' },
            ])
        },
        {
            title: 'Blockchain & Web3 Developer Conference',
            slug: 'blockchain-web3-dev-conference',
            description: 'Dive into the world of blockchain and Web3 development at this full-day conference. Featuring talks on smart contract development, DeFi protocols, NFT standards, and decentralized application architecture. Hands-on coding sessions and networking with the bay area\'s top blockchain developers.',
            short_description: 'Full-day conference on blockchain development, smart contracts, and Web3.',
            date: '2026-05-15', end_date: null, time: '09:00', end_time: '18:00',
            location: 'Computer History Museum, Mountain View, CA', venue_name: 'Computer History Museum',
            address: '1401 N Shoreline Blvd', city: 'Mountain View', state: 'CA', zip: '94043',
            lat: 37.4143, lng: -122.0777, is_online: 0, online_url: '',
            capacity: 300, tickets_sold: 0, price: 0, image: null,
            organizer_id: 2, category_id: 1, status: 'pending', is_featured: 0,
            tags: 'blockchain,web3,crypto,developer',
            schedule: JSON.stringify([])
        },
        {
            title: 'Jazz in the Park',
            slug: 'jazz-in-the-park',
            description: 'Enjoy a relaxing afternoon of live jazz music in beautiful Dolores Park. Bring your picnic blankets and enjoy performances from local jazz ensembles. Food trucks and beverage vendors will be on site. A family-friendly event celebrating San Francisco\'s vibrant jazz scene.',
            short_description: 'Live jazz performances in Dolores Park with food trucks and picnic vibes.',
            date: '2026-06-20', end_date: null, time: '12:00', end_time: '18:00',
            location: 'Dolores Park, San Francisco, CA', venue_name: 'Dolores Park',
            address: 'Dolores St & 19th St', city: 'San Francisco', state: 'CA', zip: '94114',
            lat: 37.7596, lng: -122.4269, is_online: 0, online_url: '',
            capacity: 500, tickets_sold: 0, price: 0, image: null,
            organizer_id: 3, category_id: 2, status: 'pending', is_featured: 0,
            tags: 'jazz,music,outdoor,park',
            schedule: JSON.stringify([])
        },
    ];

    const insertManyEvents = db.transaction((events) => {
        for (const e of events) {
            insertEvent.run(
                e.title, e.slug, e.description, e.short_description,
                e.date, e.end_date, e.time, e.end_time,
                e.location, e.venue_name, e.address, e.city, e.state, e.zip,
                e.lat, e.lng, e.is_online, e.online_url,
                e.capacity, e.tickets_sold, e.price, e.image,
                e.organizer_id, e.category_id, e.status, e.is_featured,
                e.tags, e.schedule
            );
        }
    });
    insertManyEvents(events);

    // --- TICKETS ---
    const insertTicket = db.prepare(
        'INSERT INTO tickets (ticket_code, user_id, event_id, quantity, total_price, status, payment_method, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const tickets = [
        [uuidv4().slice(0, 8).toUpperCase(), 6, 1, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 7, 1, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 8, 1, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 6, 2, 2, 99.98, 'confirmed', 'mock_card', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 9, 2, 1, 49.99, 'confirmed', 'mock_card', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 10, 3, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 7, 4, 1, 15.00, 'confirmed', 'mock_card', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 8, 5, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 9, 6, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 10, 7, 1, 75.00, 'confirmed', 'mock_card', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 6, 8, 1, 0, 'confirmed', 'free', 'completed'],
        [uuidv4().slice(0, 8).toUpperCase(), 7, 9, 1, 0, 'confirmed', 'free', 'completed'],
    ];

    const insertManyTickets = db.transaction((tickets) => {
        for (const t of tickets) {
            insertTicket.run(...t);
        }
    });
    insertManyTickets(tickets);

    // --- NOTIFICATIONS ---
    const insertNotification = db.prepare(
        'INSERT INTO notifications (user_id, type, title, message, link, is_read) VALUES (?, ?, ?, ?, ?, ?)'
    );

    const notifications = [
        [6, 'ticket_confirmation', 'Ticket Confirmed!', 'Your ticket for SF Tech Summit 2026 has been confirmed.', '/events/1', 1],
        [6, 'event_reminder', 'Event Reminder', 'SF Tech Summit 2026 is happening in 3 days!', '/events/1', 0],
        [7, 'ticket_confirmation', 'Ticket Confirmed!', 'Your ticket for SF Tech Summit 2026 has been confirmed.', '/events/1', 1],
        [2, 'event_approved', 'Event Approved', 'Your event "SF Tech Summit 2026" has been approved by an admin.', '/events/1', 1],
        [2, 'info', 'New Registration', 'Alex Thompson registered for SF Tech Summit 2026.', '/dashboard/attendees/1', 0],
        [3, 'event_approved', 'Event Approved', 'Your event "Neon Nights Music Festival" has been approved.', '/events/2', 1],
        [9, 'ticket_confirmation', 'Ticket Confirmed!', 'Your ticket for Virtual Design Systems Workshop has been confirmed.', '/events/6', 0],
        [10, 'ticket_confirmation', 'Ticket Confirmed!', 'Your ticket for Bay Area Marathon 2026 has been confirmed.', '/events/7', 0],
    ];

    const insertManyNotifications = db.transaction((notifs) => {
        for (const n of notifs) {
            insertNotification.run(...n);
        }
    });
    insertManyNotifications(notifications);

    console.log('✅ Database seeded successfully!');
    console.log(`   📊 ${users.length} users`);
    console.log(`   📁 ${categories.length} categories`);
    console.log(`   📅 ${events.length} events`);
    console.log(`   🎫 ${tickets.length} tickets`);
    console.log(`   🔔 ${notifications.length} notifications`);
}

seed();
