// 🔹 **Existing User ID Check**
document.getElementById('existingUser').addEventListener('change', function () {
    const isExistingUser = this.checked;
    const userIdInput = document.getElementById('userId');
    const nameInput = document.getElementById('name');
    const ageInput = document.getElementById('age');
    const genderInput = document.getElementById('gender');
    const languageInput = document.getElementById('language');
    const problemInput = document.getElementById('problem');

    document.getElementById('userIdSection').classList.toggle('hidden', !isExistingUser);

    nameInput.disabled = isExistingUser;
    genderInput.disabled = isExistingUser;

    if (!isExistingUser) {
        nameInput.value = "";
        genderInput.value = "";
        ageInput.value = "";
        languageInput.value = "";
        problemInput.value = "";
        return;
    }

    const userId = userIdInput.value.trim();
    if (!userId || !/^\d+$/.test(userId)) {
        alert('⚠️ User ID must be a valid number.');
        this.checked = false;
        nameInput.disabled = false;
        genderInput.disabled = false;
        return;
    }

    fetch(`/api/users/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('⚠️ User ID not found. Please check your ID.');
            this.checked = false;
            nameInput.disabled = false;
            genderInput.disabled = false;
        } else {
            nameInput.value = data.name || "";
            genderInput.value = data.gender || "";
            ageInput.value = data.age || "";
            problemInput.value = data.problem || "";
            languageInput.value = data.language || "";
            nameInput.disabled = true;
            genderInput.disabled = true;
        }
    })
    .catch(error => {
        console.error('❌ Error fetching user info:', error);
        alert('⚠️ Server error. Please try again.');
        this.checked = false;
        nameInput.disabled = false;
        genderInput.disabled = false;
    });
});

// 🔹 **BP Data Submission**
document.getElementById('bpForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const isExistingUser = document.getElementById('existingUser').checked;
    const userId = document.getElementById('userId').value.trim();
    const systolic = parseInt(document.getElementById('systolic').value, 10);
    const diastolic = parseInt(document.getElementById('diastolic').value, 10);
    const problem = document.getElementById('problem').value.trim();

    if (isExistingUser && (!userId || !/^\d+$/.test(userId))) {
        alert('⚠️ User ID must be a valid number.');
        return;
    }

    if (systolic <= 0 || diastolic <= 0) {
        alert('⚠️ Please enter valid BP values.');
        return;
    }

    const data = isExistingUser ? {
        userId,
        systolic,
        diastolic,
        problem
    } : {
        name: document.getElementById('name').value,
        age: document.getElementById('age').value,
        gender: document.getElementById('gender').value,
        language: document.getElementById('language').value,
        problem,
        systolic,
        diastolic
    };

    const apiUrl = isExistingUser ? '/api/check-bp' : '/register';

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

            renderBPChart(result.history);
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

    fetch('/api/send-report', {
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
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Systolic Pressure',
                    data: systolicData,
                    borderColor: 'red',
                    fill: false,
                    tension: 0.4
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
