import "dotenv/config"; // Use import if type is "module"
import express from "express";
import cors from "cors";
import Stripe from "stripe";

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
        const { priceId, successUrl, cancelUrl } = req.body; // Get both success and cancel URLs from the frontend

        // Create the Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "payment",
            success_url: successUrl, // Success URL
            cancel_url: cancelUrl,   // Cancel URL
        });

        // Respond with the session URL
        res.json({ url: session.url });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Use the correct port for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
