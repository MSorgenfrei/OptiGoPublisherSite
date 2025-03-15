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
                    </div>
                    <input type="text" class="input-field text text-body hidden" id="paywall-otp" placeholder="Enter Code" />
                    <button class="btn hidden" id="paywall-verify-btn">Verify</button>
                    <p id="paywall-status"></p>
                    <p class="text text-fineprint">By clicking "Verify" you agree to our <a href="#">Terms of Service</a>.</p>
                </div>

                <!-- Step 3: Payment -->
                <div id="paywall-step-3" class="hidden">
                    <h1 class="text text-header2"><span style="font-weight: 700;">Load your wallet</span> for instant access.</h1>
                    <div style="text-align: center; margin: 30px 5px">
                        <p class="text text-body">Choose Amount.</p>
                        <div class="button-container">
                            <button class="btn btn-option" data-amount="$2.50">$2.50</button>
                            <button class="btn btn-option" data-amount="$5">$5</button>
                            <button class="btn btn-option" data-amount="$10">$10</button>
                        </div>
                        <p class="text text-fineprint">
                            <label class="custom-checkbox">
                                <input type="checkbox" class="checkbox" checked>
                                <span class="checkbox-label">Auto-reload my wallet at $0.50.</span>
                            </label>
                        </p>
                    </div>
                    <button class="btn" id="paywall-submit">Finish</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById("paywall-overlay");
    const step1 = document.getElementById("paywall-step-1");
    const step2 = document.getElementById("paywall-step-2");
    const step3 = document.getElementById("paywall-step-3");

    // Button references
    const continueBtn = document.getElementById("paywall-continue");
    const phoneBtn = document.getElementById("paywall-phone-btn");
    const verifyBtn = document.getElementById("paywall-verify-btn");
    const statusText = document.getElementById("paywall-status");

    // Step 1 → Step 2
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

    // Step 2: Send Code
    phoneBtn.addEventListener("click", () => {
        const phoneNumber = document.getElementById("paywall-phone").value;
        const appVerifier = window.recaptchaVerifier;

        firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
            .then((confirmationResult) => {
                window.confirmationResult = confirmationResult;
                statusText.innerText = "Code Sent!"; // Message that shows up
                statusText.style = "text text-fineprint";
                document.getElementById("paywall-otp").classList.remove("hidden");
                verifyBtn.classList.remove("hidden");
                phoneBtn.classList.add("hidden"); // Hide send OTP button
            })
            .catch((error) => {
                console.error(error);
                statusText.innerText = error.message;
            });
    });

    // Step 2: Verify OTP
    verifyBtn.addEventListener("click", () => {
        const otp = document.getElementById("paywall-otp").value;
        window.confirmationResult.confirm(otp)
            .then((result) => {
                statusText.innerText = "Phone number verified!";
                console.log("User:", result.user);
                step2.classList.add("hidden");
                step3.classList.remove("hidden");
            })
            .catch((error) => {
                console.error(error);
                statusText.innerText = "Invalid Code. Try again!";
            });
    });

    // Select all payment buttons
    const buttons = document.querySelectorAll('.btn-option');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Step 3: Remove paywall & grant access
    document.getElementById("paywall-submit").addEventListener("click", () => {
        sessionStorage.setItem(pageKey, "true");
        overlay.remove();
    });

    // Show the paywall
    setTimeout(() => {
        overlay.style.display = "flex";
        overlay.style.backdropFilter = "blur(5px)";
    }, 1500);
});
