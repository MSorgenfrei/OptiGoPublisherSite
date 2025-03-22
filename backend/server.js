require("dotenv").config(); 
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

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
        const { priceId, successUrl } = req.body; // Get success URL from frontend

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "payment",
            success_url: `${successUrl}?payment_success=true`, // Redirect back to original page
            cancel_url: successUrl, // Stay on the same page if canceled
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Use the correct port for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

