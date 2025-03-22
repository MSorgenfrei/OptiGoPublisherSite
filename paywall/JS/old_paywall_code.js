document.addEventListener("DOMContentLoaded", () => {
    // Get the current page URL to store per-page access
    const pageKey = `paywallPassed_${window.location.pathname}`;

    // Only run the paywall if the user hasn't completed it for this page
    if (sessionStorage.getItem(pageKey)) return;

    // Create modal HTML
    const modalHTML = `
        <div id="paywall-overlay">
            <div id="paywall-modal">
                <!-- Step 1 -->
                <div id="paywall-step-1">
                    <h1 class="text text-header">Pay As You Go.</h1>
                    <h2 class="text text-subheader">No subscriptions. No surprises.</h2>
                    <button class="btn" style="margin: 40px; border-radius: 5px; padding: 10px 20px" id="paywall-continue">Reveal Article $0.49</button>
                    <p class="text text-small">Powered by <span style="font-weight: 700;">OptiGo.</span></p>
                </div>

                <!-- Step 2: Phone Authentication -->
                <div id="paywall-step-2" class="hidden">
                    <h1 class="text text-header2">
                        <span style="font-weight: 700;">The Marina Daily</span> uses 
                        <span style="font-weight: 700;">OptiGo</span> for pay as you go access.
                    </h1>
                    <div style="text-align: center; margin: 30px 5px">
                        <h1 class="text text-body">Enter your phone number.</h1>
                        <input type="text" class="input-field text text-body" id="paywall-phone" placeholder="+155501234" required/>
                        <div id="recaptcha-container"></div>
                        <button class="btn" id="paywall-phone-btn">Send Code</button> 
                   
                        <input type="text" class="input-field text text-body hidden" id="paywall-otp" placeholder="Enter Code" />
                        <p id="paywall-status"></p>
                     </div>
                    <button class="btn hidden" id="paywall-verify-btn">Verify</button>
                    
                    <p class="text text-fineprint">By clicking "Verify" you agree to our <a href="#">Terms of Service</a>.</p>
                </div>

                <!-- Step 3: Fill wallet -->
                <div id="paywall-step-3" class="hidden">
                    <h1 class="text text-header2"><span style="font-weight: 700;">Load your wallet</span> for instant access.</h1>
                    <div style="text-align: center; margin: 30px 5px">
                        <p class="text text-body">Choose Amount.</p>
                        <div class="button-container">
                            <button class="btn btn-option" data-price-id="price_1R3SsrAxHGHXGLCj9DvF4cCc">$2.50</button>
                            <button class="btn btn-option" data-price-id="price_1R3StuAxHGHXGLCj0zgisAJv">$5</button>
                            <button class="btn btn-option" data-price-id="price_1R3SubAxHGHXGLCj82jflcUO">$10</button>
                        </div>
                        <p class="text text-fineprint">
                            <label class="custom-checkbox">
                                <input type="checkbox" class="checkbox" checked>
                                <span class="checkbox-label">Auto-reload my wallet at $0.50.</span>
                            </label>
                        </p>
                    </div>
                    <button class="btn" id="paywall-submit">Pay</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Select all payment buttons and enable single selection behavior
    const buttons = document.querySelectorAll('.btn-option');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            buttons.forEach(btn => btn.classList.remove('active')); // Remove active class from all buttons
            button.classList.add('active'); // Add active class to clicked button
        });
    });

    const overlay = document.getElementById("paywall-overlay");
    const step1 = document.getElementById("paywall-step-1");
    const step2 = document.getElementById("paywall-step-2");
    const step3 = document.getElementById("paywall-step-3");

    // Button references
    const continueBtn = document.getElementById("paywall-continue");
    const phoneBtn = document.getElementById("paywall-phone-btn");
    const verifyBtn = document.getElementById("paywall-verify-btn");
    const statusText = document.getElementById("paywall-status");

    //Check if the user has already completed the paywall
    const paywallFullyCompleted = sessionStorage.getItem("paywallFullyCompleted");

    // Hide steps until last one completed
    continueBtn.addEventListener("click", () => {
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
    });

    // Initialize Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyAbn5wdVquG2or6jA7yBZgqy2lolbmoPLc",
        authDomain: "optigo-publishing-demo.firebaseapp.com",
        projectId: "optigo-publishing-demo",
        storageBucket: "optigo-publishing-demo.appspot.com",
        messagingSenderId: "330666647467",
        appId: "1:330666647467:web:44e503b81534ffd87cbcee",
    };
    firebase.initializeApp(firebaseConfig);

    // Setup Invisible reCAPTCHA
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
            console.log('reCAPTCHA resolved');
        }
    });

    // Phone Auth: Send Code
    phoneBtn.addEventListener("click", () => {
        const phoneNumber = document.getElementById("paywall-phone").value;
        const appVerifier = window.recaptchaVerifier;

        firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
            .then((confirmationResult) => {
                window.confirmationResult = confirmationResult;
                statusText.innerText = "Code sent!"; // Message that shows up
                statusText.className = "text text-body"; // CHow to update style
                document.getElementById("paywall-otp").classList.remove("hidden");
                verifyBtn.classList.remove("hidden");
                phoneBtn.classList.add("hidden"); // Hide send OTP button
            })
            .catch((error) => {
                console.error(error);
                statusText.innerText = error.message;
            });
    });

    // Phone Auth: Verify OTP
    verifyBtn.addEventListener("click", () => {
        const otp = document.getElementById("paywall-otp").value;
        window.confirmationResult.confirm(otp)
            .then((result) => {
                statusText.innerText = "Phone number verified!";
                console.log("User:", result.user);
    
                // If the user has completed the full paywall before, skip Step 3
                if (paywallFullyCompleted) {
                    sessionStorage.setItem(pageKey, "true"); // Grant access
                    overlay.remove();
                } else {
                    step2.classList.add("hidden");
                    step3.classList.remove("hidden");
                }
            })
            .catch((error) => {
                console.error(error);
                statusText.innerText = "Invalid Code. Try again!";
            });
    });

    // Stripe Payment
    document.getElementById("paywall-submit").addEventListener("click", async () => {
        const selectedButton = document.querySelector(".btn-option.active");
        if (!selectedButton) {
            alert("Please select an amount.");
            return;
        }
    
        const priceId = selectedButton.getAttribute("data-price-id");
    
        if (!priceId) {
            alert("Invalid price ID selected.");
            return;
        }
    
        try {
            const response = await fetch("https://optigo-paywall-backend.onrender.com/create-checkout-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priceId })
            });
    
            const data = await response.json();
    
            if (data.url) {
                // Redirect user to Stripe Checkout
                window.location.href = data.url; 
    
                // Only remove the modal after a successful checkout session and user redirection
                sessionStorage.setItem(pageKey, "true"); // Grant access to current page
                sessionStorage.setItem("paywallFullyCompleted", "true"); // Mark full completion
                setTimeout(() => {
                    overlay.remove(); // Remove the modal after redirection
                }, 1000); // Small delay to ensure redirection happens first
            } else {
                console.error("Error creating checkout session:", data.error);
                alert("Failed to create checkout session. Please try again.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again.");
        }
    });
    

    // Show the paywall
    setTimeout(() => {
        overlay.style.display = "flex";
        overlay.style.backdropFilter = "blur(5px)";
    }, 1500);
});
