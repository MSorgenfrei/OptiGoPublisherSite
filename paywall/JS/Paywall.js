document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get("payment_success") === "true";

    const pageKey = `paywallPassed_${window.location.pathname}`;
    const isPageUnlocked = localStorage.getItem(pageKey) === "done";

    if (paymentSuccess) {
        localStorage.setItem(pageKey, "done");
        setTimeout(() => {
            window.location.href = window.location.pathname; // Reload without query params
        }, 500);
    }

    if (isPageUnlocked) {
        console.log("✅ Page is unlocked. No paywall required.");
        return; // Exit early if the page is already unlocked
    }

    console.log("🚧 Paywall required for this page.");

    // Inject the paywall modal into the page
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
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <select id="paywall-country-code" class="input-field-small text text-body">
                                <option value="+1" selected>+1</option>
                                <option value="+44">+44</option>
                                <option value="+91">+91</option>
                                <option value="+61">+61</option>
                                <option value="+49">+49</option>
                                <!-- Add more country codes as needed -->
                            </select>
                            <input type="text" class="input-field-medium text text-body" id="paywall-phone" placeholder="55501234" required/>
                        </div>

                        <div id="recaptcha-container"></div>
                        <button class="btn" id="paywall-phone-btn">Send Code</button> 
                   
                        <input type="text" class="input-field text text-body hidden" style="width: 215px" id="paywall-otp" placeholder="Enter Code" />
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

       // 🚀 Define showPaywall function BEFORE calling it
       function showPaywall() {
        const overlay = document.getElementById("paywall-overlay");
        if (!overlay) return; // Prevent error if paywall is not injected
    
        setTimeout(() => {
            overlay.style.display = "flex";
            overlay.style.backdropFilter = "blur(5px)";
        }, 1500);
    }

    // ✅ Now it's safe to call showPaywall()
    showPaywall();

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
        'size': 'invisible', // Invisible reCAPTCHA
        'callback': (response) => {
            console.log('reCAPTCHA resolved');
        }
    });

    // Ensure the reCAPTCHA widget is rendered before proceeding
    window.recaptchaVerifier.render().then(function(widgetId) {
        window.recaptchaWidgetId = widgetId; // Store the widget ID if needed
        console.log('reCAPTCHA widget rendered');
    });

    // Phone Auth: Send Code
    phoneBtn.addEventListener("click", () => {
        const countryCode = document.getElementById("paywall-country-code").value;
        const phoneNumber = document.getElementById("paywall-phone").value.trim();
        const fullPhoneNumber = `${countryCode}${phoneNumber}`; // Concatenating country code with number

        const appVerifier = window.recaptchaVerifier;

        // Ensure that the reCAPTCHA widget is rendered before sending the verification code
        if (!window.recaptchaVerifier) {
            console.error("reCAPTCHA not initialized correctly.");
            statusText.innerText = "reCAPTCHA not ready. Please try again.";
            return;
        }

        firebase.auth().signInWithPhoneNumber(fullPhoneNumber, appVerifier)
            .then((confirmationResult) => {
                window.confirmationResult = confirmationResult;
                statusText.innerText = "Code sent!"; // Message that shows up
                statusText.className = "text text-body"; // Update style
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
        console.log("Attempting to confirm OTP:", otp);
    
        window.confirmationResult.confirm(otp)
            .then((result) => {
                console.log("OTP confirmed. User:", result.user);
    
                const firebaseUid = result.user.uid;
                console.log("Firebase UID:", firebaseUid);

                const phone_number = result.user.phoneNumber; // caputre phone number
                console.log("Phone Number:", phone_number); // store in console log
    
                // Send data to backend
                fetch('https://optigo-paywall-backend.onrender.com/add-user', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        firebase_uid: firebaseUid, // Send  the UID
                        phone_number: phone_number, // Send the phone number
                    }),
                })
                .then(response => response.json())
                .then(data => {
                    console.log("User added:", data);
                    step2.classList.add("hidden");
                    step3.classList.remove("hidden");
                })
                .catch(error => {
                    console.error("Error sending UID to backend:", error);
                });
            })
            .catch((error) => {
                console.error("Error confirming OTP:", error);
                statusText.innerText = "Invalid Code. Try again!";
            });
    });

    // Stripe Checkout
    document.getElementById("paywall-submit").addEventListener("click", async () => {
        const selectedButton = document.querySelector(".btn-option.active");
        if (!selectedButton) {
            alert("Please select an amount.");
            return;
        }

        const priceId = selectedButton.getAttribute("data-price-id");
        const currentPage = window.location.href; // Get the current page URL dynamically
        const successUrl = `${currentPage}?payment_success=true`; // Add query params for success
        const cancelUrl = `${currentPage}?payment_cancelled=true`; // Add query params for cancel

        // Ensure user is logged in
        const user = firebase.auth().currentUser;
        if (!user) {
            alert("You must verify your phone number first.");
            console.error("Error: No authenticated user found.");
            return;
        }

        const userUID = user.uid; // Get Firebase UID

        // Get the current page path as pageId
        const pageId = window.location.pathname; // or any other identifier for the page

        // Include pageId in the request
        const requestBody = {
            priceId,
            successUrl,
            cancelUrl,
            userUID, // Add userUID to the payload
            pageId, // Add pageId here
        };

        console.log("🛒 Sending checkout request:", requestBody);

        try {
            const response = await fetch("https://optigo-paywall-backend.onrender.com/create-checkout-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();
            console.log("💳 Checkout response:", data);

            if (response.ok && data.url) {
                window.location.href = data.url; // Redirect to Stripe checkout
            } else {
                console.error("❌ Error:", data.error);
                alert("Checkout failed. Please try again.");
            }
        } catch (error) {
            console.error("❌ Network error:", error);
            alert("An error occurred. Please try again.");
        }
    });

    // Show paywall
    function showPaywall() {
        const overlay = document.getElementById("paywall-overlay");
        if (!overlay) return; // Prevent error if paywall is not injected
    
        setTimeout(() => {
            overlay.style.display = "flex";
            overlay.style.backdropFilter = "blur(5px)";
        }, 1500);
    }
    }    
);