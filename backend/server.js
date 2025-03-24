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

// Create a Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
    try {
        const { priceId, successUrl, cancelUrl } = req.body;

        // Create the Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        // Respond with the session URL
        res.json({ url: session.url });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Set up PostgreSQL connection using environment variables
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Required for Render's SSL connection
  },
});

// Connect to the database
client.connect()
  .then(() => {
    console.log('Connected to the database!');
  })
  .catch(err => {
    console.error('Error connecting to the database:', err.stack);
  });

// SQL to create a new users table
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(15),
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

client
  .query(createTableQuery)
  .then(() => console.log("Users table created"))
  .catch((err) => console.error("Error creating table:", err));

// Route to add a new user to the database
app.post('/add-user', async (req, res) => {
    try {
        const { firebase_uid, phone_number = null, name = null, email = null } = req.body;

        // Upsert user (insert if new, ignore if exists)
        const result = await client.query(
            `INSERT INTO users (firebase_uid, phone_number, name, email)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (firebase_uid) DO UPDATE 
             SET phone_number = EXCLUDED.phone_number
             RETURNING *`,
            [firebase_uid, phone_number, name, email]
        );

        res.json({
            message: 'User added or updated successfully!',
            user: result.rows[0], 
        });
    } catch (err) {
        console.error('Error adding user:', err.stack);
        res.status(500).json({ error: 'Error adding user', details: err });
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
  

  // Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
