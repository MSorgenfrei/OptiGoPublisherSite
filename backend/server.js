import "dotenv/config";
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import pkg from 'pg';

const { Pool } = pkg;
const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// CORS configuration
const allowedOrigins = [
    "https://msorgenfrei.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    }
}));

// Database connection setup with pooling
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Webhook route to get Stripe events
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

    console.log('✅ Webhook event received:', JSON.stringify(event, null, 2));

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { client_reference_id: firebase_uid, amount_total: amount, metadata } = session;
        const page_id = metadata?.page_id || "unknown_page";

        // Fetch `price_id` from line items
        let priceId = null;
        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            if (lineItems.data.length > 0) {
                priceId = lineItems.data[0].price.id;
            }
            console.log("🔍 Extracted price_id:", priceId);
        } catch (err) {
            console.error("❌ Error fetching line items:", err);
        }

        // Insert into `checkouts` table
        try {
            await pool.query(
                `INSERT INTO checkouts (firebase_uid, price_id, amount, created_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                [firebase_uid, priceId, amount]
            );
            console.log(`✅ Checkout recorded for Firebase UID: ${firebase_uid}`);
        } catch (error) {
            console.error('❌ Error recording checkout:', error);
        }

        // Update user balance after successful payment
        try {
            // Ensure user exists
            const userExists = await pool.query(
                `SELECT 1 FROM users WHERE firebase_uid = $1`, 
                [firebase_uid]
            );

            if (userExists.rowCount === 0) {
                console.error(`❌ User not found in the database: ${firebase_uid}`);
            } else {
                await pool.query(
                    `UPDATE users SET balance = balance + $1 WHERE firebase_uid = $2`,
                    [amount, firebase_uid]
                );
                console.log(`✅ Balance updated: +$${amount / 100} for UID ${firebase_uid}`);
            }
        } catch (error) {
            console.error('❌ Error updating balance:', error);
        }

        const customerId = metadata?.customer_id || null;
        let payg_price = null;
        
        // Lookup payg_price from customers table
        if (customerId) {
            try {
                const result = await pool.query(
                    `SELECT payg_price FROM customers WHERE customer_id = $1`,
                    [customerId]
                );
                if (result.rows.length > 0) {
                    payg_price = result.rows[0].payg_price;
                }
            } catch (err) {
                console.error("❌ Error fetching payg_price:", err);
            }
        }

        // Prevent duplicate processing (idempotency)
        const alreadyProcessed = await pool.query(
            `SELECT 1 FROM done WHERE checkout_id = $1`,
            [session.id]
        );

        if (alreadyProcessed.rowCount > 0) {
            console.warn(`⚠️ Duplicate webhook: session ${session.id} already processed.`);
            return res.status(200).json({ received: true, duplicate: true });
        }
        
        // Insert into `done` table with new fields
        try {
            await pool.query(
                `INSERT INTO done (firebase_uid, checkout_id, page_id, customer_id, payg_price)
                 VALUES ($1, $2, $3, $4, $5)`,
                [firebase_uid, session.id, page_id, customerId, payg_price]
            );
            console.log(`✅ Done event recorded with customer_id ${customerId} and payg_price ${payg_price}`);
        } catch (error) {
            console.error('❌ Error recording done event:', error);
        }
    }

    res.status(200).json({ received: true });
});

// Middleware for JSON parsing (must be after webhook route)
app.use(express.json());

// Route to add or update a user
app.post('/add-user', async (req, res) => {
    try {
        const { firebase_uid, phone_number = null, name = null, email = null } = req.body;

        if (!firebase_uid) {
            return res.status(400).json({ error: "firebase_uid is required" });
        }

        const result = await pool.query(
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

            await pool.query(
                `UPDATE users 
                 SET phone_number = COALESCE($2, phone_number), 
                     name = COALESCE($3, name), 
                     email = COALESCE($4, email)
                 WHERE firebase_uid = $1`,
                [firebase_uid, phone_number, name, email]
            );

            return res.json({ message: 'User updated successfully!', user: { firebase_uid, phone_number, name, email } });
        } else {
            await pool.query(
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
    console.log("Received checkout request:", req.body);

    try {
        const { priceId, successUrl, cancelUrl, userUID, pageId, customerId } = req.body;

        if (!priceId || !successUrl || !cancelUrl || !userUID || !pageId || !customerId) {
            return res.status(400).json({ error: "Missing required fields", received: req.body });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: userUID,
            metadata: { 
                page_id: pageId,
                customer_id: customerId }
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
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err.stack);
        res.status(500).json({ error: 'Error fetching users', details: err });
    }
});

// Route to get "done" events
app.get('/done/:firebase_uid/:page_id', async (req, res) => {
    try {
        const { firebase_uid, page_id } = req.params;
        const result = await pool.query(
            `SELECT * FROM done WHERE firebase_uid = $1 AND page_id = $2 ORDER BY timestamp DESC`,
            [firebase_uid, page_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching done events:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to get payg_price for a customer
app.get('/get-price', async (req, res) => {
    const { customer_id } = req.query;

    if (!customer_id) {
        return res.status(400).json({ error: "customer_id is required" });
    }

    try {
        const result = await pool.query(
            `SELECT payg_price FROM customers WHERE customer_id = $1`,
            [customer_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }

        res.json({ payg_price: result.rows[0].payg_price });
    } catch (err) {
        console.error('Error fetching price:', err.stack);
        res.status(500).json({ error: 'Error fetching price', details: err });
    }
});

// Route to get customer name
app.get('/get-name', async (req, res) => {
    const { customer_id } = req.query;

    if (!customer_id) {
        return res.status(400).json({ error: "customer_id is required" });
    }

    try {
        const result = await pool.query(
            `SELECT name FROM customers WHERE customer_id = $1`,
            [customer_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }

        res.json({ name: result.rows[0].name });
    } catch (err) {
        console.error('Error fetching name:', err.stack);
        res.status(500).json({ error: 'Error fetching name', details: err });
    }
});

// Get User Balance
app.get('/get-balance', async (req, res) => {
   const { firebase_uid } = req.query;

   if (!firebase_uid) {
       return res.status(400).json({ error: "Missing required parameter: firebase_uid" });
   }

   try {
       const result = await pool.query(
           `SELECT balance FROM users WHERE firebase_uid = $1`,
           [firebase_uid]
       );

       if (result.rows.length === 0) {
           return res.status(404).json({ error: "User not found" });
       }

       return res.json({ balance: result.rows[0].balance });
   } catch (error) {
       console.error('❌ Error fetching balance:', error);
       res.status(500).json({ error: 'Internal Server Error' });
   }
});

// Deduct User Balance
app.post('/deduct-balance', async (req, res) => {
   const { firebase_uid, amount } = req.body;

   if (!firebase_uid || amount === undefined) {
       return res.status(400).json({ error: "Missing required fields: firebase_uid and amount" });
   }

   try {
       // Check user balance first
       const userResult = await pool.query(
           `SELECT balance FROM users WHERE firebase_uid = $1`,
           [firebase_uid]
       );

       if (userResult.rows.length === 0) {
           return res.status(404).json({ error: "User not found" });
       }

       let balance = userResult.rows[0].balance;

       if (balance < amount) {
           return res.status(402).json({ error: "Insufficient balance" });
       }

       // Deduct balance
       await pool.query(
           `UPDATE users SET balance = balance - $1 WHERE firebase_uid = $2`,
           [amount, firebase_uid]
       );

       return res.json({ success: true, new_balance: balance - amount });
   } catch (error) {
       console.error('❌ Error deducting balance:', error);
       res.status(500).json({ error: 'Internal Server Error' });
   }
});

// Increase User Balance
app.post('/add-balance', async (req, res) => {
   const { firebase_uid, amount } = req.body;

   if (!firebase_uid || amount === undefined || amount <= 0) {
       return res.status(400).json({ error: "Invalid input: firebase_uid and positive amount required" });
   }

   try {
       await pool.query(
           `UPDATE users SET balance = balance + $1 WHERE firebase_uid = $2`,
           [amount, firebase_uid]
       );

       return res.json({ success: true, message: `Balance increased by $${amount / 100}` });
   } catch (error) {
       console.error('❌ Error adding balance:', error);
       res.status(500).json({ error: 'Internal Server Error' });
   }
});

// Start server after database setup
const startServer = async () => {
    try {
        console.log('Connected to the database!');

        // Create tables if they don't exist
        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                firebase_uid VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(15),
                name VARCHAR(255),
                email VARCHAR(255),
                balance INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Checkouts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS checkouts (
                id SERIAL PRIMARY KEY,
                firebase_uid VARCHAR(255) NOT NULL,
                price_id VARCHAR(255) NOT NULL,
                amount INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Done table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS done (
                id SERIAL PRIMARY KEY,
                firebase_uid VARCHAR(255) NOT NULL,
                checkout_id VARCHAR(255) NOT NULL,
                page_id VARCHAR(255) NOT NULL,
                customer_id VARCHAR(255),
                payg_price INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        //Customers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                customer_id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                payg_price INTEGER NOT NULL,  -- Changed to INTEGER
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);        

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Error setting up database:', err.stack);
        process.exit(1);
    }
};

// Route to create a new customer
app.post('/create-customer', async (req, res) => {
    const { name, paygPrice } = req.body;

    if (!name || paygPrice === undefined) {
        return res.status(400).json({ error: "Name and PAYG Price are required" });
    }

    try {
        // Since the frontend sends paygPrice as an integer (e.g., 50 for $0.50, 150 for $1.50),
        // no need for conversion, store it as is.
        const paygPriceInUnits = paygPrice;  // Directly use the integer value received

        // Generate a random customer ID (short string)
        const customerId = Math.random().toString(36).substring(2, 10);

        // Insert customer into the database with paygPrice stored directly as an integer
        await pool.query(
            `INSERT INTO customers (customer_id, name, payg_price) 
            VALUES ($1, $2, $3)`,
            [customerId, name, paygPriceInUnits]
        );

        // Respond with the newly created customer
        res.json({
            success: true,
            customer: {
                customer_id: customerId,
                name,
                payg_price: paygPriceInUnits,  // Store the price as units (e.g., 50, 150)
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Error creating customer:', err.stack);
        res.status(500).json({ error: 'Error creating customer', details: err });
    }
});

// Route to get all customers
app.get('/customers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM customers');
        
        // Display payg_price as integer (no conversion to dollars)
        const customers = result.rows.map(customer => {
            let paygPrice = customer.payg_price;

            // Ensure paygPrice is a valid number
            if (isNaN(paygPrice)) {
                console.error(`Invalid payg_price for customer ${customer.customer_id}: ${paygPrice}`);
                paygPrice = 0; // Default to 0 if the value is invalid
            }

            // Optionally, convert cents to dollars for display (e.g., 50 -> 0.50)
            const paygPriceInDollars = (paygPrice / 100).toFixed(2); // Convert to dollars for display

            return {
                ...customer,
                payg_price: paygPriceInDollars  // Display as dollars (e.g., 0.50, 1.50)
            };
        });

        res.json(customers);
    } catch (err) {
        console.error('Error fetching customers:', err.stack);
        res.status(500).json({ error: 'Error fetching customers', details: err });
    }
});

// Route to delete a customer
app.delete('/delete-customer/:customer_id', async (req, res) => {
    const { customer_id } = req.params;

    try {
        // Delete customer from the database
        const result = await pool.query(
            `DELETE FROM customers WHERE customer_id = $1`,
            [customer_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (err) {
        console.error('Error deleting customer:', err.stack);
        res.status(500).json({ error: 'Error deleting customer', details: err });
    }
});

// Route to delete all customers
app.delete('/delete-all-customers', async (req, res) => {
    try {
        // Delete all customers
        await pool.query('DELETE FROM customers');

        res.json({ success: true, message: 'All customers deleted successfully' });
    } catch (err) {
        console.error('Error deleting all customers:', err.stack);
        res.status(500).json({ error: 'Error deleting all customers', details: err });
    }
});


startServer();
