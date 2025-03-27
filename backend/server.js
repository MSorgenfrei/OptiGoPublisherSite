import "dotenv/config";
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import pkg from 'pg';
const { Client } = pkg;

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// 🚀 Apply JSON middleware at the top for all non-webhook routes
app.use(express.json());

// CORS configuration
app.use(cors({
    origin: [
        "https://msorgenfrei.github.io",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ]
}));

// Database connection setup
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Start server after database connection
const startServer = async () => {
  try {
    await client.connect();
    console.log('Connected to the database!');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(15),
        name VARCHAR(255),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS checkouts (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(255) NOT NULL,
        price_id VARCHAR(255) NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Error connecting to the database:', err.stack);
    process.exit(1);
  }
};

startServer();

// 🚀 Fix: Webhook route uses `express.raw()`
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Event received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      await client.query(
        `INSERT INTO checkouts (firebase_uid, price_id, amount, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [session.client_reference_id, session.amount_total, session.currency]
      );
      console.log(`✅ Checkout recorded for Firebase UID: ${session.client_reference_id}`);
    } catch (error) {
      console.error('❌ Error recording checkout:', error);
    }
  }

  res.status(200).json({ received: true });
});

// 🚀 Fix: Ensure express.json() is applied for all other routes

// Route to add user
app.post('/add-user', async (req, res) => {
  try {
    const { firebase_uid, phone_number = null, name = null, email = null } = req.body;

    if (!firebase_uid) {
      return res.status(400).json({ error: "firebase_uid is required" });
    }

    const result = await client.query(
      `SELECT * FROM users WHERE firebase_uid = $1`,
      [firebase_uid]
    );

    if (result.rows.length > 0) {
      const existingUser = result.rows[0];

      if (
        existingUser.phone_number === phone_number &&
        existingUser.name === name &&
        existingUser.email === email
      ) {
        return res.json({ message: 'No updates, user data is unchanged.' });
      }

      await client.query(
        `UPDATE users 
         SET phone_number = COALESCE($2, phone_number), 
             name = COALESCE($3, name), 
             email = COALESCE($4, email)
         WHERE firebase_uid = $1`,
        [firebase_uid, phone_number, name, email]
      );

      return res.json({ message: 'User updated successfully!', user: { firebase_uid, phone_number, name, email } });
    } else {
      await client.query(
        `INSERT INTO users (firebase_uid, phone_number, name, email) 
         VALUES ($1, $2, $3, $4)`,
        [firebase_uid, phone_number, name, email]
      );

      return res.json({ message: 'User added successfully!', user: { firebase_uid, phone_number, name, email } });
    }
  } catch (err) {
    console.error('Error adding/updating user:', err.stack);
    res.status(500).json({ error: 'Error adding/updating user', details: err });
  }
});

// Route to create checkout session
app.post("/create-checkout-session", async (req, res) => {
  console.log("Received checkout request:", req.body); // 🔍 Debugging log

  try {
    const { priceId, successUrl, cancelUrl, userUID } = req.body;

    if (!priceId || !successUrl || !cancelUrl || !userUID) {
      return res.status(400).json({ error: "Missing required fields", received: req.body });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userUID,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    res.status(400).json({ error: error.message });
  }
});

// Route to get all users
app.get('/users', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.stack);
    res.status(500).json({ error: 'Error fetching users', details: err });
  }
});
