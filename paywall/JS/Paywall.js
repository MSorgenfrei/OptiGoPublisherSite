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
                    <h1 class="text text-header">Pay As You Go.</h1>
                    <h2 class="text text-subheader">No subscriptions. No surprises.</h2>
                    <button class="btn" style="margin: 40px; border-radius: 5px; padding: 10px 20px" id="paywall-continue">Reveal Article $0.49</button>
                    <p class="text text-small">Powered by <syle="font-weight: 700;">OptiGo</p>
                </div>
                <div id="paywall-step-2" class="hidden">
                    <h1 class="text text-header2">
                        <span syle="font-weight: 700;">The Marina Daily</span> uses 
                        <span syle="font-weight: 700;">OptiGo</span> for pay-as-you-go access.
                    </h1>
                    <div style="text-align: center; margin: 30px 5px">
                        <p class="text text-body">Enter your phone number.</p>
                        <input type="text" class="input-field text text-body" id="paywall-phone" placeholder="1 650 421 1988" required/>
                    </div>
                 <button class="btn" id="paywall-phone-btn">Next</button> 
                 <p class="text text-fineprint" style="margin-top: 10px";>By clicking "Next" you agree to our <a href="#">Terms of Service</a>.</p>
                </div>
                <div id="paywall-step-3" class="hidden">
                    <h1 class="text text-header2">
                        <span style="font-weight: 700;">Load your wallet</span> for instant access to all OptiGo sites.
                    </h1>
                    <div style="text-align: center; margin: 30px 5px">
                        <p class="text text-body">Choose Amount.</p> 
                        <p class="text text-body">Withdraw anytime at <a href="https://msorgenfrei.github.io/OptiGoPublisherSite/">OptiGo.</a></p>
                        <div class="button-container" style="margin: 10px;">
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
    const finishButton = document.getElementById("paywall-submit");

    //Hide step 1 and show step 2 when 1 is done
    document.getElementById("paywall-continue").addEventListener("click", () => {
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
    });
    //Hide step 2 and show step 3 when 2 is done
    document.getElementById("paywall-phone-btn").addEventListener("click", () => {
        step2.classList.add("hidden");
        step3.classList.remove("hidden");
    });

    // Select all the buttons with the class "btn-option"
    const buttons = document.querySelectorAll('.btn-option');

    // Loop through each button and add an event listener for clicks
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove the 'active' class from all buttons
            buttons.forEach(btn => btn.classList.remove('active'));
        
        // Add the 'active' class to the clicked button
        button.classList.add('active');
    });
});

      // Remove paywall on "Finish" and grant access to the page
      finishButton.addEventListener("click", () => {
        sessionStorage.setItem(pageKey, "true"); // Store session access for this page
        overlay.remove(); // Remove paywall from page
    });

    setTimeout(() => {
        overlay.style.display = "flex";  // Show the overlay
        overlay.style.backdropFilter = "blur(5px)";
    }, 2000);  // Delay in milliseconds (2000ms = 2 seconds)
    

});
