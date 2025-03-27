import "dotenv/config"; // Use import if type is "module"
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import pkg from 'pg';  // Correct import for 'pg'
const { Client } = pkg;  // Destructure Client from the imported package

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// CORS configuration
app.use(cors({
    origin: [
        "https://msorgenfrei.github.io",  // Production domain
        "http://127.0.0.1:5500",          // Local development domain
        "http://localhost:5500"            // Local development domain (alternative)
    ]
}));

app.use(express.json());

// SQL to create a new checkouts table
const createCheckoutsTableQuery = `
  CREATE TABLE IF NOT EXISTS checkouts (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) NOT NULL,
    price_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// SQL to create a new users table
const createUsersTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(15),
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Set up PostgreSQL connection using environment variables
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Required for Render's SSL connection
  },
});

// Function to start the server after DB connection
const startServer = async () => {
  try {
    await client.connect();
    console.log('Connected to the database!');

    // Create tables if they don't exist
    await client.query(createUsersTableQuery);
    console.log("Users table checked/created.");
    await client.query(createCheckoutsTableQuery);
    console.log("Checkouts table checked/created.");

    // Start the server only after the database is ready
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Error connecting to the database:', err.stack);
    process.exit(1);  // Exit process if connection fails
  }
};

// Start the server
startServer();

// Create checkout session endpoint
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl, userUID } = req.body;

    // Create the Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userUID,  // Use userUID to associate with Stripe session
    });

    // Respond with the session URL
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to add a new user to the database
app.post('/add-user', async (req, res) => {
  try {
    const { firebase_uid, phone_number = null, name = null, email = null } = req.body;

    // Check if the user already exists by firebase_uid
    const result = await client.query(
      `SELECT * FROM users WHERE firebase_uid = $1`,
      [firebase_uid]
    );

    if (result.rows.length > 0) {
      // If user exists, check if any new information has been provided
      const existingUser = result.rows[0];

      // If the existing user data is the same, do nothing
      if (
        existingUser.phone_number === phone_number &&
        existingUser.name === name &&
        existingUser.email === email
      ) {
        return res.json({ message: 'No updates, user data is unchanged.' });
      }

      // Otherwise, update the user with new info
      await client.query(
        `UPDATE users 
        SET phone_number = COALESCE($2, phone_number), 
            name = COALESCE($3, name), 
            email = COALESCE($4, email)
        WHERE firebase_uid = $1`,
        [firebase_uid, phone_number, name, email]
      );

      return res.json({
        message: 'User updated successfully!',
        user: { firebase_uid, phone_number, name, email }
      });
    } else {
      // If the user does not exist, insert the new user
      await client.query(
        `INSERT INTO users (firebase_uid, phone_number, name, email) 
         VALUES ($1, $2, $3, $4)`,
        [firebase_uid, phone_number, name, email]
      );

      return res.json({
        message: 'User added successfully!',
        user: { firebase_uid, phone_number, name, email }
      });
    }
  } catch (err) {
    console.error('Error adding/updating user:', err.stack);
    res.status(500).json({ error: 'Error adding/updating user', details: err });
  }
});

// Route to get all users
app.get('/users', async (req, res) => {
  try {
    // Query to select all users
    const result = await client.query('SELECT * FROM users');

    // Respond with the users data
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.stack);
    res.status(500).json({ error: 'Error fetching users', details: err });
  }
});

// Handle Stripe Webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log('Webhook signature verification failed:', err);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  // Handle successful checkout session completion
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Get the information you need from the session
    const priceId = session.line_items?.[0]?.price?.id || 'UNKNOWN'; // Extract the price ID
    const amount = session.amount_total; // Extract the total amount

    const firebaseUid = session.client_reference_id; // Assuming you're using the `client_reference_id` to store the Firebase UID

    // Insert data into the database
    try {
      await client.query(
        `INSERT INTO checkouts (firebase_uid, price_id, amount, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [firebaseUid, priceId, amount]
      );
      console.log('Checkout recorded for Firebase UID:', firebaseUid);
    } catch (error) {
      console.error('Error recording checkout:', error);
    }
  }

  res.status(200).send('Event received');
});
