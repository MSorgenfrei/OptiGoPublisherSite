document.addEventListener("DOMContentLoaded", () => {
    // Get the current page URL to store per-page access
    const pageKey = `paywallPassed_${window.location.pathname}`;

    // Only run the paywall if the user hasn't completed it for this page
    if (sessionStorage.getItem(pageKey)) return;

    // Create modal HTML
    const modalHTML = `
        <div id="paywall-overlay">
            <div id="paywall-modal">
                <div id="paywall-step-1">
                    <h1 class="paywall-header">Pay As You Go.</h1>
                    <h2 class="paywall-subheader">No subscriptions. No surprises.</h2>
                    <button id="paywall-continue">REVEAL ARTICLE $0.49</button>
                    <p class="paywall-small">Powered by OptiGo</p>
                </div>
                <div id="paywall-step-2" class="hidden">
                    <p class="paywall-fineprint" style="margin-bottom: -10px;">The Marina Daily uses OptiGo for</p>
                    <h1 class="paywall-header">Pay As You Go.</h1>
                    <h2 class="paywall-subheader">No subscriptions. No surprises.</h2>
                    <p class="paywall-body">Enter Phone Number:</p>
                    <input type="text" id="paywall-phone" />
                    <button id="paywall-phone-btn">Next</button>
                    <p class="paywall-fineprint">By clicking "Next" you agree to our <a href="#">Terms of Service</a>.</p>
                    <div id="recaptcha-container"></div>
                </div>
                <div id="paywall-step-3" class="hidden">
                    <h1 class="paywall-header">Load Your Wallet.</h1>
                    <h2 class="paywall-subheader">Keep a balance with OptiGo for instant access to sites. Withdraw anytime at <a href="https://msorgenfrei.github.io/OptiGoPublisherSite/">OptiGo.com</a></h2>
                    <button id="paywall-submit">Finish</button>
                </div>
            </div>
        </div>
    `;

    // Inject modal into the page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.filter = "none";

    // Element references
    const overlay = document.getElementById("paywall-overlay");
    const modal = document.getElementById("paywall-modal");
    const step1 = document.getElementById("paywall-step-1");
    const step2 = document.getElementById("paywall-step-2");
    const step3 = document.getElementById("paywall-step-3");
    const phoneInput = document.getElementById("paywall-phone");
    const phoneBtn = document.getElementById("paywall-phone-btn");

    document.getElementById("paywall-continue").addEventListener("click", () => {
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
    });

    phoneBtn.addEventListener("click", () => {
        const phoneNumber = phoneInput.value;
        const appVerifier = window.recaptchaVerifier;

        firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
            .then((confirmationResult) => {
                window.confirmationResult = confirmationResult;
                phoneInput.value = ""; // Clear input for OTP entry
                phoneInput.placeholder = "Enter OTP";
                phoneBtn.textContent = "Submit OTP";
                phoneBtn.removeEventListener("click", handlePhoneVerification);
                phoneBtn.addEventListener("click", handleOTPVerification);
            })
            .catch((error) => {
                console.error("SMS not sent", error);
            });
    });

    function handleOTPVerification() {
        const otpCode = phoneInput.value;
        window.confirmationResult.confirm(otpCode)
            .then((result) => {
                step2.classList.add("hidden");
                step3.classList.remove("hidden");
            })
            .catch((error) => {
                console.error("OTP verification failed", error);
            });
    }

    // Required recaptcha verifier
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
            console.log("Recaptcha solved");
        }
    });

    // Function to show the paywall when scrolling below 25% of the page
    function checkScroll() {
        const scrollPosition = window.scrollY;
        const pageHeight = document.documentElement.scrollHeight;

        // If user scrolls below 25% of the total page height, show paywall
        if (scrollPosition > (pageHeight * 0.25)) {
            overlay.style.display = "flex";
            modal.style.display = "block";
            document.getElementById("paywall-overlay").style.backdropFilter = "blur(5px)";
            window.removeEventListener("scroll", checkScroll); // Remove event listener once triggered
        }
    }

    // Attach scroll event listener
    window.addEventListener("scroll", checkScroll);
});
