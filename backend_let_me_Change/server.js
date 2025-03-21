require("dotenv").config(); // Ensure you add this line at the top of your server.js
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Make sure you're using the key from the .env file

app.use(cors({ origin: "*" })); // Allows all domains (for testing)
app.use(express.json());

// Create a Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
    try {
        const { priceId } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "payment",
            success_url: "https://msorgenfrei.github.io/OptiGoPublisherSite/",
            cancel_url: "https://yourwebsite.com/cancel",
        });

        res.json({ url: session.url }); // Send URL back to frontend
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));
