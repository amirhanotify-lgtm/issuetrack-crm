const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    await client.query('BEGIN');

    // --- Users ---
    const passwordHash = await bcrypt.hash('password123', 10);
    const usersRes = await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Sarah Chen',    'sarah@company.com',   $1, 'admin'),
        ('Marcus Webb',   'marcus@company.com',  $1, 'supervisor'),
        ('Aisha Patel',   'aisha@company.com',   $1, 'agent'),
        ('Tom Rivera',    'tom@company.com',     $1, 'agent'),
        ('Lily Nguyen',   'lily@company.com',    $1, 'agent')
      RETURNING id, name, role
    `, [passwordHash]);
    const [sarah, marcus, aisha, tom, lily] = usersRes.rows;
    console.log('✓ Users seeded');

    // --- Clients ---
    const clientsRes = await client.query(`
      INSERT INTO clients (name, phone, email, company) VALUES
        ('James Harmon',     '+1-555-0101', 'james@acme.com',      'Acme Corporation'),
        ('Priya Sharma',     '+1-555-0102', 'priya@globaltech.com','GlobalTech Ltd'),
        ('Carlos Mendez',    '+1-555-0103', 'carlos@nextgen.com',  'NextGen Solutions'),
        ('Rachel Kim',       '+1-555-0104', 'rachel@prime.com',    'Prime Retail Inc'),
        ('David Okafor',     '+1-555-0105', 'david@aurora.com',    'Aurora Systems'),
        ('Emma Laurent',     '+1-555-0106', 'emma@vertex.com',     'Vertex Partners'),
        ('Ravi Gupta',       '+1-555-0107', 'ravi@synapse.com',    'Synapse AI'),
        ('Mia Chen',         '+1-555-0108', 'mia@orbit.com',       'Orbit Media')
      RETURNING id, name
    `);
    const clients = clientsRes.rows;
    console.log('✓ Clients seeded');

    // --- Categories ---
    const catsRes = await client.query(`
      INSERT INTO categories (name, parent_id) VALUES
        ('Delivery',          NULL),
        ('Payment',           NULL),
        ('Product Quality',   NULL),
        ('Technical Support', NULL),
        ('Billing',           NULL)
      RETURNING id, name
    `);
    const [delivery, payment, productQ, tech, billing] = catsRes.rows;

    await client.query(`
      INSERT INTO categories (name, parent_id) VALUES
        ('Late Delivery',     $1),
        ('Wrong Item',        $1),
        ('Missing Package',   $1),
        ('Refund Request',    $2),
        ('Double Charge',     $2),
        ('Defective Product', $3),
        ('Missing Parts',     $3),
        ('Login Issues',      $4),
        ('App Crashes',       $4),
        ('Incorrect Invoice', $5)
    `, [delivery.id, payment.id, productQ.id, tech.id, billing.id]);
    console.log('✓ Categories seeded');

    // --- Notes ---
    const now = new Date();
    const daysAgo = (d) => new Date(now - d * 86400000).toISOString();

    await client.query(`
      INSERT INTO notes (client_id, agent_id, category_id, title, description, priority, status, counter, created_at, updated_at) VALUES
        ($1, $2, $3, 'Package not delivered on time', 'Customer reports package marked as delivered but was not received at the address. Third occurrence this month.', 'High', 'Open', 7, $4, $5),
        ($6, $7, $8, 'Payment failed at checkout', 'Card processing error during online checkout. Customer unable to complete purchase. Affects multiple payment methods.', 'High', 'In Progress', 12, $9, $10),
        ($11, $2, $12, 'Product arrived damaged', 'Packaging damage resulted in defective item on arrival. Customer requests replacement or full refund.', 'Medium', 'Open', 5, $13, $14),
        ($15, $16, $17, 'App crashes on login screen', 'Mobile app (iOS 17) crashes immediately when user attempts to enter credentials. Cannot reproduce on Android.', 'High', 'In Progress', 9, $18, $19),
        ($1, $2, $8, 'Double charged for single order', 'Customer was charged twice for the same order #4421. Second charge appeared 2 hours after the first.', 'High', 'Open', 3, $20, $21),
        ($6, $7, $12, 'Wrong item shipped', 'Customer ordered SKU-1042 (Blue, Large) but received SKU-1039 (Red, Small). Return label sent.', 'Medium', 'Resolved', 4, $22, $23),
        ($11, $2, $12, 'Missing parts in package', 'Product manual references 6 components but only 4 were included. Missing: power adapter and mounting bracket.', 'Low', 'Resolved', 2, $24, $25),
        ($15, $16, $17, 'Password reset email not arriving', 'Reset email not received within expected timeframe. Checked spam folder. Issue affects users on @gmail.com domains.', 'Medium', 'Resolved', 6, $26, $27),
        ($28, $29, $30, 'Incorrect invoice amount', 'Invoice #INV-2204 shows $1,240 but contracted rate is $1,100. Discrepancy of $140 needs credit note.', 'Medium', 'Open', 2, $31, $32),
        ($33, $34, $35, 'Subscription renewal failed', 'Annual subscription could not be auto-renewed. Card on file is valid. Manual renewal also failing.', 'High', 'In Progress', 8, $36, $37)
    `, [
      clients[0].id, aisha.id, delivery.id,
      daysAgo(10), daysAgo(2),
      clients[1].id, tom.id, payment.id,
      daysAgo(9), daysAgo(3),
      clients[2].id, productQ.id,
      daysAgo(8), daysAgo(4),
      clients[3].id, lily.id, tech.id,
      daysAgo(15), daysAgo(5),
      daysAgo(5), daysAgo(1),
      daysAgo(20), daysAgo(10),
      daysAgo(25), daysAgo(14),
      daysAgo(30), daysAgo(20),
      clients[6].id, tom.id, billing.id,
      daysAgo(4), daysAgo(1),
      clients[7].id, aisha.id, payment.id,
      daysAgo(7), daysAgo(2)
    ]);
    console.log('✓ Notes seeded');

    // --- Activity Logs ---
    await client.query(`
      INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name, created_at) VALUES
        ($1, 'increment_counter', 'note', 2, 'Payment failed at checkout',      NOW() - INTERVAL '5 minutes'),
        ($2, 'create_note',       'note', 4, 'App crashes on login screen',     NOW() - INTERVAL '1 hour'),
        ($3, 'resolve_note',      'note', 6, 'Wrong item shipped',              NOW() - INTERVAL '3 hours'),
        ($1, 'update_status',     'note', 1, 'Package not delivered on time',   NOW() - INTERVAL '5 hours'),
        ($2, 'create_client',     'client', 5, 'David Okafor',                  NOW() - INTERVAL '1 day'),
        ($4, 'create_note',       'note', 5, 'Double charged for single order', NOW() - INTERVAL '2 days'),
        ($1, 'update_note',       'note', 3, 'Product arrived damaged',         NOW() - INTERVAL '3 days'),
        ($3, 'increment_counter', 'note', 1, 'Package not delivered on time',   NOW() - INTERVAL '4 days')
    `, [aisha.id, tom.id, sarah.id, marcus.id]);
    console.log('✓ Activity logs seeded');

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  Admin:      sarah@company.com  / password123');
    console.log('  Supervisor: marcus@company.com / password123');
    console.log('  Agent:      aisha@company.com  / password123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
