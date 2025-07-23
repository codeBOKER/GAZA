from django.http import HttpResponse

def home_view(request):
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Product Analyzer</title>
    </head>
    <body>
        <h1>Product Identifier (WebSocket)</h1>
        <input type="file" id="imageFile" accept="image/*">
        <button onclick="sendImage()">Analyze Image</button>
        <div id="result"></div>

        <script>
            let socket = new WebSocket('ws://' + window.location.host + '/ws/analyze/');

            socket.onmessage = function(event) {
                const data = JSON.parse(event.data);
                const resultDiv = document.getElementById('result');
                if (data.type === "company") {
                    resultDiv.innerHTML += `<p><strong>Company:</strong> ${data.value}</p>`;
                } else if (data.type === "product_type") {
                    resultDiv.innerHTML += `<p><strong>Product Type:</strong> ${data.value}</p>`;
                } else if (data.type === "status") {
                    resultDiv.innerHTML += `<p><strong>status:</strong> ${data.value}</p>`;
                } else if (data.type === "case") {
                    resultDiv.innerHTML += `<p><strong>Case:</strong> ${data.value}</p>`;
                } else if (data.type === "error") {
                    resultDiv.innerHTML += `<p style="color:red;">Error: ${data.value}</p>`;
                }
            };

            function sendImage() {
                const file = document.getElementById('imageFile').files[0];
                const reader = new FileReader();
                reader.onload = function() {
                    const base64 = reader.result.split(',')[1];
                    socket.send(JSON.stringify({ image_data: base64 }));
                    document.getElementById('result').innerHTML = '<h3>Analyzing...</h3>';
                };
                reader.readAsDataURL(file);
            }
        </script>
    </body>
    </html>
    """
    return HttpResponse(html_content)
