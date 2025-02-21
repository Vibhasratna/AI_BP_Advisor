// 🔹 **Existing User ID Check**
document.getElementById('existingUser').addEventListener('change', function () {
    const isExistingUser = this.checked;
    const userIdInput = document.getElementById('userId');
    const nameInput = document.getElementById('name');
    const ageInput = document.getElementById('age');
    const genderInput = document.getElementById('gender');

    document.getElementById('generateId').classList.toggle('hidden', isExistingUser);

    nameInput.disabled = isExistingUser;
    genderInput.disabled = isExistingUser;
    ageInput.disabled = isExistingUser;

    if (!isExistingUser) {
        nameInput.value = "";
        genderInput.value = "";
        ageInput.value = "";
        return;
    }

    const userId = userIdInput.value.trim();
    if (!userId || !/^\d+$/.test(userId)) {
        alert('⚠️ User ID must be a valid number.');
        this.checked = false;
        nameInput.disabled = false;
        genderInput.disabled = false;
        ageInput.disabled = false;
        return;
    }

    fetch(`http://localhost:3000/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('⚠️ User ID not found. Please check your ID.');
            this.checked = false;
            nameInput.disabled = false;
            genderInput.disabled = false;
            ageInput.disabled = false;
        } else {
            nameInput.value = data.user.name || "";
            genderInput.value = data.user.gender || "";
            ageInput.value = data.user.age || "";
            nameInput.disabled = true;
            genderInput.disabled = true;
            ageInput.disabled = true;
        }
    })
    .catch(error => {
        console.error('❌ Error fetching user info:', error);
        alert('⚠️ Server error. Please try again.');
        this.checked = false;
        nameInput.disabled = false;
        genderInput.disabled = false;
        ageInput.disabled = false;
    });
});

// 🔹 **BP Data Submission**
document.getElementById('bpForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => data[key] = value);

    const isExistingUser = document.getElementById('existingUser').checked;
    const userId = document.getElementById('userId').value.trim();
    const systolic = parseInt(data.systolic, 10);
    const diastolic = parseInt(data.diastolic, 10);

    if (isExistingUser && (!userId || !/^\d+$/.test(userId))) {
        alert('⚠️ User ID must be a valid number.');
        return;
    }

    if (systolic <= 0 || diastolic <= 0) {
        alert('⚠️ Please enter valid BP values.');
        return;
    }

    const apiUrl = isExistingUser ? 'http://localhost:3000/api/check-bp' : 'http://localhost:3000/register';

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.error) {
            alert(result.error);
            return;
        }

        document.getElementById('output').innerHTML = `<strong>💡 AI Diagnosis:</strong><br>${result.advice}`;
        document.getElementById('output').classList.remove('hidden');

        if (result.history && result.history.length > 0) {
            document.getElementById('showHistoryBtn').classList.remove('hidden');
            document.getElementById('emailSection').classList.remove('hidden');

            localStorage.setItem('bpHistory', JSON.stringify(result.history));
            localStorage.setItem('aiAdvice', result.advice);

            renderBPChart(result.history); // ✅ Use all historical data
        } else {
            document.getElementById('bpHistory').classList.add('hidden');
        }
    })
    .catch(error => console.error('❌ Error:', error));
});

// 🔹 **Show BP History**
document.getElementById('showHistoryBtn').addEventListener('click', function () {
    const bpHistory = JSON.parse(localStorage.getItem('bpHistory')) || [];
    if (bpHistory.length > 0) {
        document.getElementById('bpHistory').classList.remove('hidden');
        renderBPChart(bpHistory);
    }
});

// 🔹 **Send BP Report via Email**
document.getElementById('sendEmail').addEventListener('click', function () {
    const email = document.getElementById('email').value.trim();
    const history = JSON.parse(localStorage.getItem('bpHistory'));
    const advice = localStorage.getItem('aiAdvice');

    if (!email || !history || history.length === 0) {
        alert('⚠️ Please enter a valid email and check your BP history.');
        return;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alert('⚠️ Please enter a valid email address.');
        return;
    }

    fetch('http://localhost:3000/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, history, advice })
    })
    .then(response => response.json())
    .then(result => alert(result.message))
    .catch(error => console.error('❌ Error:', error));
});

// 📊 **Render BP Chart**
function renderBPChart(bpHistory) {
    const ctx = document.getElementById('bpChart').getContext('2d');

    if (window.bpChartInstance) {
        window.bpChartInstance.destroy();
    }

    const labels = bpHistory.map(record => new Date(record.recorded_at).toLocaleDateString());
    const systolicData = bpHistory.map(record => record.systolic);
    const diastolicData = bpHistory.map(record => record.diastolic);

    window.bpChartInstance = new Chart(ctx, {
        type: 'line', // ✅ Use a line chart for time-series data
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Systolic Pressure',
                    data: systolicData,
                    borderColor: 'red',
                    fill: false,
                    tension: 0.4 // ✅ Adds a slight curve for better visualization
                },
                {
                    label: 'Diastolic Pressure',
                    data: diastolicData,
                    borderColor: 'blue',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Date' } },
                y: { title: { display: true, text: 'BP (mmHg)' } }
            }
        }
    });
}
