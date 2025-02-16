document.getElementById('bpForm').addEventListener('submit', function(e) {
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
        document.getElementById('output').innerHTML = `<strong>AI Advice:</strong><br>${result.advice}`;
        // Optionally fetch historical data and plot charts here
    })
    .catch(error => console.error('Error:', error));
});
