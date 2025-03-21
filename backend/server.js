require("dotenv").config(); 
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 

app.use(cors({ origin: "https://msorgenfrei.github.io" })); // Allow only your frontend domain
app.use(express.json());

// Create a Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
    try {
        const { priceId } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: "payment",
            success_url: "https://msorgenfrei.github.io/OptiGoPublisherSite/", // Update to your actual frontend
            cancel_url: "https://msorgenfrei.github.io/OptiGoPublisherSite/cancel",
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Use the correct port for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

