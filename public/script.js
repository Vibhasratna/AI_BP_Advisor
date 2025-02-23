// Toggle between new and existing user forms
document.getElementById('existingUser').addEventListener('change', function () {
    const isExistingUser = this.checked;
    document.getElementById('newUserIdSection').classList.toggle('hidden', isExistingUser);
    document.getElementById('existingUserIdSection').classList.toggle('hidden', !isExistingUser);
    document.getElementById('newUserFields').classList.toggle('hidden', isExistingUser);
    document.getElementById('existingUserFields').classList.toggle('hidden', !isExistingUser);
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('analyzeBtn').disabled = true;
});

// Check User ID Availability for New Users
document.getElementById('checkUserId').addEventListener('click', async function () {
    const userId = document.getElementById('newUserId').value.trim();
    const availabilitySpan = document.getElementById('userIdAvailability');

    if (!userId || !/^\d{4}$/.test(userId)) {
        alert('⚠️ Please enter a valid 4-digit User ID');
        return;
    }

    availabilitySpan.textContent = '⌛ Checking availability...';
    availabilitySpan.className = 'checking';

    try {
        const response = await fetch(`/api/verify-userid/${userId}`);
        const data = await response.json();

        if (data.available) {
            availabilitySpan.textContent = '✅ User ID is available';
            availabilitySpan.className = 'available';
            document.getElementById('analyzeBtn').disabled = false;
        } else {
            availabilitySpan.textContent = '⚠️ User ID is already taken. Please try another ID';
            availabilitySpan.className = 'unavailable';
        }
    } catch (error) {
        console.error('Availability check error:', error);
        availabilitySpan.textContent = '⚠️ Error checking availability. Please try again';
        availabilitySpan.className = 'unavailable';
    }
});

// Verify Existing User ID
document.getElementById('verifyUserId').addEventListener('click', async function () {
    const userId = document.getElementById('userId').value.trim();
    const verificationStatus = document.getElementById('userVerificationStatus');

    if (!userId || !/^\d{4}$/.test(userId)) {
        alert('⚠️ Please enter a valid 4-digit User ID');
        return;
    }

    try {
        const response = await fetch('/api/verify-existing-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        if (response.ok) {
            verificationStatus.textContent = '✅ User verified successfully';
            verificationStatus.className = 'verified';
            document.getElementById('analyzeBtn').disabled = false;
        } else {
            verificationStatus.textContent = '⚠️ User ID not found. Please check and try again';
            verificationStatus.className = 'not-verified';
        }
    } catch (error) {
        console.error('Verification error:', error);
        verificationStatus.textContent = '⚠️ Error verifying user. Please try again';
        verificationStatus.className = 'not-verified';
    }
});

// Analyze Blood Pressure (New and Existing Users)
document.getElementById('analyzeBtn').addEventListener('click', async function (e) {
    e.preventDefault();

    // Disable button to prevent multiple clicks
    this.disabled = true;

    const isExistingUser = document.getElementById('existingUser').checked;
    const userId = isExistingUser ? document.getElementById('userId').value.trim() : document.getElementById('newUserId').value.trim();
    const name = isExistingUser ? null : document.getElementById('name').value.trim();
    const age = isExistingUser ? null : parseInt(document.getElementById('age').value, 10);
    const gender = isExistingUser ? null : document.getElementById('gender').value.trim();
    const language = isExistingUser ? document.getElementById('existingLanguage').value.trim() : document.getElementById('language').value.trim();
    const problem = isExistingUser ? document.getElementById('existingProblem').value.trim() : document.getElementById('problem').value.trim();
    const systolic = parseInt(document.getElementById('systolic').value, 10);
    const diastolic = parseInt(document.getElementById('diastolic').value, 10);
    const email = document.getElementById('email').value.trim();

    if (!userId || !/^\d{4}$/.test(userId)) {
        alert('⚠️ Please enter a valid 4-digit User ID');
        this.disabled = false;
        return;
    }

    if (!systolic || !diastolic || systolic < 60 || systolic > 250 || diastolic < 40 || diastolic > 150) {
        alert('⚠️ Blood pressure values are out of valid range');
        this.disabled = false;
        return;
    }

    if (!isExistingUser && (!name || !gender || !age || !language)) {
        alert('⚠️ Please fill in all required fields for new user registration');
        this.disabled = false;
        return;
    }

    try {
        const output = document.getElementById('output');
        output.innerHTML = '<div class="loading">Analyzing data...</div>';
        output.classList.remove('hidden');

        const apiUrl = isExistingUser ? '/api/update-bp' : '/api/register';
        const payload = {
            userId: parseInt(userId),
            language,
            problem,
            systolic,
            diastolic,
            email,
        };

        // Add additional fields for new user registration
        if (!isExistingUser) {
            payload.name = name;
            payload.age = age;
            payload.gender = gender;
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        // Display AI diagnosis result (limit to 5 lines)
        let aiAdvice = "AI analysis temporarily unavailable due to rate limiting. Please try again later.";
        try {
            aiAdvice = await generateAIAdvice(userId, systolic, diastolic);
        } catch (aiError) {
            console.error('AI Advice Generation Error:', aiError);
        }

        output.innerHTML = `
            <h2>AI Analysis Results</h2>
            <div class="diagnosis-content">
                <strong>💡 AI Diagnosis:</strong><br>
                <pre>${aiAdvice}</pre>
            </div>
        `;
        output.classList.add('show');

        // Show BP history for existing users
        if (isExistingUser && result.history) {
            document.getElementById('bpHistory').classList.remove('hidden');
            renderBPChart(result.history);
        }

        // Show email section
        document.getElementById('emailSection').classList.remove('hidden');
    } catch (error) {
        console.error('Processing error:', error);
        output.innerHTML = `
            <h2>Error</h2>
            <div class="diagnosis-content">
                <strong>⚠️ Error:</strong><br>
                AI analysis is temporarily unavailable. Please try again later.
            </div>
        `;
    } finally {
        // Re-enable the button
        this.disabled = false;
    }
});

// Render BP Chart
function renderBPChart(bpHistory) {
    const ctx = document.getElementById('bpChart').getContext('2d');

    if (window.bpChartInstance) {
        window.bpChartInstance.destroy();
    }

    const labels = bpHistory.map(record => new Date(record.recorded_at).toLocaleDateString());
    const systolicData = bpHistory.map(record => record.systolic);
    const diastolicData = bpHistory.map(record => record.diastolic);

    window.bpChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Systolic Pressure',
                    data: systolicData,
                    borderColor: '#ff0000',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    fill: true,
                    tension: 0.4,
                },
                {
                    label: 'Diastolic Pressure',
                    data: diastolicData,
                    borderColor: '#007BFF',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Date' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                },
                y: {
                    title: { display: true, text: 'BP (mmHg)' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        font: {
                            family: "'Arial', sans-serif",
                        },
                    },
                },
            },
        },
    });
}

// Send Report via Email
document.getElementById('sendEmail').addEventListener('click', async function () {
    const email = document.getElementById('email').value.trim();
    const userId = document.getElementById('existingUser').checked ? document.getElementById('userId').value.trim() : document.getElementById('newUserId').value.trim();
    const problem = document.getElementById('existingUser').checked ? document.getElementById('existingProblem').value.trim() : document.getElementById('problem').value.trim();
    const systolic = parseInt(document.getElementById('systolic').value, 10);
    const diastolic = parseInt(document.getElementById('diastolic').value, 10);
    const advice = document.getElementById('output').innerText;

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alert('⚠️ Please enter a valid email address');
        return;
    }

    try {
        const response = await fetch('/api/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, userId, problem, systolic, diastolic, advice }),
        });

        if (!response.ok) {
            throw new Error('Failed to send email');
        }

        alert('✅ Report sent successfully!');
        window.location.reload(); // Refresh the page
    } catch (error) {
        console.error('Email error:', error);
        alert('⚠️ Error sending email. Please try again');
    }
});