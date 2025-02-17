document.getElementById('bpForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};
    formData.forEach((value, key) => data[key] = value);

    fetch('http://localhost:3000/api/check-bp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        document.getElementById('output').innerHTML = `<strong>AI Diagnosis:</strong><br>${result.advice}`;
        document.getElementById('output').classList.remove('hidden');

        // Show BP history button if previous data exists
        if (result.previousData.length > 0) {
            document.getElementById('showHistoryBtn').classList.remove('hidden');
        }

        // Store previous data for graph
        localStorage.setItem('bpHistory', JSON.stringify(result.previousData.concat([{
            systolic: data.systolic,
            diastolic: data.diastolic,
            recorded_at: new Date().toISOString()
        }])));
    })
    .catch(error => console.error('Error:', error));
});

// Show BP History Chart on Button Click
document.getElementById('showHistoryBtn').addEventListener('click', function () {
    const bpHistory = JSON.parse(localStorage.getItem('bpHistory')) || [];
    if (bpHistory.length > 0) {
        document.getElementById('bpHistory').classList.remove('hidden');
        renderBPChart(bpHistory);
    }
});

// Function to Render BP Chart
function renderBPChart(bpHistory) {
    const ctx = document.getElementById('bpChart').getContext('2d');
    const labels = bpHistory.map(record => new Date(record.recorded_at).toLocaleDateString());
    const systolicData = bpHistory.map(record => record.systolic);
    const diastolicData = bpHistory.map(record => record.diastolic);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Systolic Pressure', data: systolicData, borderColor: 'red', fill: false },
                { label: 'Diastolic Pressure', data: diastolicData, borderColor: 'blue', fill: false }
            ]
        },
        options: { responsive: true }
    });
}
